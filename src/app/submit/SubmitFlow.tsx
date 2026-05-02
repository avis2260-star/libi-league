'use client';

import { useState, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import ImageQualityModal from '@/components/ImageQualityModal';
import ImageCropper from '@/components/ImageCropper';
import { submitGameResult } from '@/app/admin/actions';
import { useLang } from '@/components/TranslationProvider';
import SubmitInstructionsModal from '@/components/SubmitInstructionsModal';

type Game = {
  id: string;
  home_name: string;
  away_name: string;
  game_date: string;
  game_time: string | null;
  is_locked: boolean;
};

type Team = { id: string; name: string };

type RosterPlayer = {
  id: string;
  name: string;
  jersey_number: number | null;
  team_id: string | null;
};

type ExtractedPlayer = {
  name: string;
  ocr_name?: string;   // raw text Gemini read from the form before roster matching
  jersey: number | null;
  points: number;
  three_pointers: number;
  fouls: number;
  played?: boolean;    // whether this player actually participated in the game
};

type ExtractedData = {
  home_score: number;
  away_score: number;
  home_players: ExtractedPlayer[];
  away_players: ExtractedPlayer[];
};

// Fuzzy match result
type NameMatch = {
  ocr: string;           // raw text Claude transcribed
  matched: string;       // best official name (or ocr if no match)
  score: number;         // 0–1, higher = more confident
  candidates: string[];  // top alternatives for dropdown
};

const FUZZY_THRESHOLD = 0.4; // fuse score below this = high confidence (fuse uses 0=perfect, 1=no match)
const DROPDOWN_THRESHOLD = 0.7; // above this = show dropdown instead of auto-filling

function buildFuse(roster: RosterPlayer[]) {
  return new Fuse(roster, {
    keys: ['name'],
    includeScore: true,
    threshold: 0.6,
    distance: 100,
  });
}

function matchName(ocr: string, fuse: Fuse<RosterPlayer> | null): NameMatch {
  if (!fuse || !ocr || ocr === '?') {
    return { ocr, matched: ocr, score: 0, candidates: [] };
  }
  const results = fuse.search(ocr, { limit: 4 });
  if (!results.length) {
    return { ocr, matched: ocr, score: 0, candidates: [] };
  }
  const best = results[0];
  const fuseScore = best.score ?? 1;
  const confidence = 1 - fuseScore; // flip: 1 = perfect match
  return {
    ocr,
    matched: confidence >= (1 - FUZZY_THRESHOLD) ? best.item.name : ocr,
    score: confidence,
    candidates: results.slice(1).map(r => r.item.name),
  };
}

type Step = 'select' | 'instructions' | 'upload' | 'confirm' | 'success';

// ── Player name cell with OCR hint + optional dropdown ────────────────────────
function NameCell({
  match,
  value,
  onChange,
  roster,
  ocrName,
}: {
  match: NameMatch | null;
  value: string;
  onChange: (v: string) => void;
  roster: RosterPlayer[];
  ocrName?: string;
}) {
  const { lang } = useLang();
  const showSuggestion = match && match.score > 0 && match.ocr !== match.matched;
  const isLowConfidence = match && match.score < (1 - DROPDOWN_THRESHOLD) && match.score > 0;

  // Show raw OCR hint if it differs from the official name
  const ocrHint = ocrName && ocrName !== value ? ocrName : null;

  if (isLowConfidence && roster.length > 0) {
    return (
      <div className="space-y-0.5">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-transparent text-white text-xs focus:outline-none focus:text-orange-300 border-b border-white/10 pb-0.5"
          style={{ backgroundColor: 'transparent' }}
        >
          <option value={match.ocr} style={{ backgroundColor: '#0d1a28' }}>
            {match.ocr} (OCR)
          </option>
          {roster.map(p => (
            <option key={p.id} value={p.name} style={{ backgroundColor: '#0d1a28' }}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="text-[9px] text-yellow-500/70">{lang === 'en' ? '⚠ Select player from list' : '⚠ בחר שחקן מהרשימה'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent text-white text-xs focus:outline-none focus:text-orange-300"
      />
      {ocrHint && (
        <p className="text-[9px] text-[#4a6a8a]">
          OCR: <span className="text-[#5a7a9a]">{ocrHint}</span>
        </p>
      )}
      {!ocrHint && showSuggestion && (
        <p className="text-[9px] text-[#4a6a8a]">
          OCR: <span className="text-[#5a7a9a]">{match.ocr}</span>
        </p>
      )}
    </div>
  );
}

export default function SubmitFlow({
  games,
  teams,
  players,
}: {
  games: Game[];
  teams: Team[];
  players: RosterPlayer[];
}) {
  const { t, lang } = useLang();
  const en = lang === 'en';
  const [step, setStep] = useState<Step>('select');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [submitterName, setSubmitterName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const selectedTeamName = teams.find(t => t.id === selectedTeamId)?.name ?? '';

  const visibleGames = selectedTeamId
    ? games.filter(g => g.home_name === selectedTeamName || g.away_name === selectedTeamName)
    : games;

  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>('image/jpeg');
  const [cropMode, setCropMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ confidence_score: number; issues: string[]; recommendation: string } | null>(null);
  const [isNeedsReview, setIsNeedsReview] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);
  // Stores original OCR names so we can show them as hints alongside matched names
  const [nameMatches, setNameMatches] = useState<{
    home: NameMatch[];
    away: NameMatch[];
  } | null>(null);
  const [extractError, setExtractError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build Fuse instances per team once game is selected
  const homeFuse = useMemo(() => {
    if (!selectedGame) return null;
    const roster = players.filter(p => {
      const team = teams.find(t => t.name === selectedGame.home_name);
      return team && p.team_id === team.id;
    });
    return roster.length ? buildFuse(roster) : null;
  }, [selectedGame, players, teams]);

  const awayFuse = useMemo(() => {
    if (!selectedGame) return null;
    const roster = players.filter(p => {
      const team = teams.find(t => t.name === selectedGame.away_name);
      return team && p.team_id === team.id;
    });
    return roster.length ? buildFuse(roster) : null;
  }, [selectedGame, players, teams]);

  const homeRoster = useMemo(() => {
    if (!selectedGame) return [];
    const team = teams.find(t => t.name === selectedGame.home_name);
    return team ? players.filter(p => p.team_id === team.id) : [];
  }, [selectedGame, players, teams]);

  const awayRoster = useMemo(() => {
    if (!selectedGame) return [];
    const team = teams.find(t => t.name === selectedGame.away_name);
    return team ? players.filter(p => p.team_id === team.id) : [];
  }, [selectedGame, players, teams]);

  // ── Step 1 ─────────────────────────────────────────────────────────────────
  function handleGameSelect() {
    if (!selectedGame || !submitterName.trim() || !selectedTeamId) return;
    setStep('instructions');
  }

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset all previous extraction state before processing new image
    setExtractedData(null);
    setEditedData(null);
    setNameMatches(null);
    setExtractError('');
    setSubmitError('');
    setAnalysisResult(null);

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setMediaType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      setBase64(b64);
      // Open the cropper instead of analyzing immediately
      setCropMode(true);
    };
  }

  async function analyzeImage(b64: string, type: string) {
    setLoading(true);
    setLoadingMsg(en ? 'Checking image quality...' : 'בודק איכות תמונה...');
    try {
      const res = await fetch('/api/analyze-scoresheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mediaType: type }),
      });
      const analysis = await res.json();
      setAnalysisResult(analysis);

      if (analysis.status === 'fail') {
        setLoading(false);
        setShowModal(true);
      } else {
        await extractStats(b64, type, false);
      }
    } catch {
      setLoading(false);
      alert(en ? 'Image analysis error. Try again.' : 'שגיאה בניתוח התמונה. נסה שוב.');
    }
  }

  function handleCropConfirm(croppedB64: string) {
    setBase64(croppedB64);
    const dataUrl = `data:${mediaType};base64,${croppedB64}`;
    setPreview(dataUrl);
    setCropMode(false);
    analyzeImage(croppedB64, mediaType);
  }

  function handleCropSkip() {
    setCropMode(false);
    if (base64) analyzeImage(base64, mediaType);
  }

  async function extractStats(b64: string, type: string, needsReview: boolean) {
    setLoading(true);
    setExtractError('');
    setLoadingMsg(en ? 'Extracting data from form... (up to 30 seconds)' : 'מחלץ נתונים מהטופס... (עד 30 שניות)');
    setIsNeedsReview(needsReview);
    try {
      const res = await fetch('/api/extract-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: b64,
          mediaType: type,
          homeName: selectedGame!.home_name,
          awayName: selectedGame!.away_name,
          homePlayers: homeRoster,
          awayPlayers: awayRoster,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setExtractError(en
          ? `Error: ${data.error ?? 'Invalid server response'}`
          : `שגיאה: ${data.error ?? 'תגובה לא תקינה מהשרת'}`);
        setLoading(false);
        return;
      }

      const extracted = data as ExtractedData;

      // ── Merge full roster with extracted stats ────────────────────────────
      setLoadingMsg(en ? 'Matching names to roster...' : 'מתאים שמות לרשימת שחקנים...');

      function mergeRosterWithExtracted(
        roster: RosterPlayer[],
        extractedPlayers: ExtractedPlayer[],
        fuse: import('fuse.js').default<RosterPlayer> | null
      ): ExtractedPlayer[] {
        if (!roster.length) return extractedPlayers;
        return roster.map(rp => {
          // find the best match from extracted players for this roster player
          const results = fuse ? fuse.search(rp.name) : [];
          const best = results[0];
          const ep = best && best.score !== undefined && best.score < 0.5
            ? extractedPlayers.find(e => e.name === best.item.name) ?? null
            : null;
          return {
            name: rp.name,
            ocr_name: ep ? best?.item.name : undefined, // store what Gemini originally read
            jersey: rp.jersey_number ?? null,
            points: ep?.points ?? 0,
            three_pointers: ep?.three_pointers ?? 0,
            fouls: ep?.fouls ?? 0,
            // Default: a player is "played" if OCR matched them (any stats present)
            played: !!ep,
          };
        });
      }

      const mergedHome = mergeRosterWithExtracted(homeRoster, extracted.home_players, homeFuse);
      const mergedAway = mergeRosterWithExtracted(awayRoster, extracted.away_players, awayFuse);

      // name matches are now just identity (names come from roster already)
      const homeMatches = mergedHome.map(p => ({ ocr: p.name, matched: p.name, score: 1, candidates: [] }));
      const awayMatches = mergedAway.map(p => ({ ocr: p.name, matched: p.name, score: 1, candidates: [] }));
      setNameMatches({ home: homeMatches, away: awayMatches });

      const patched: ExtractedData = {
        ...extracted,
        home_players: mergedHome,
        away_players: mergedAway,
      };

      setExtractedData(extracted);
      setEditedData(JSON.parse(JSON.stringify(patched)));
      setStep('confirm');
    } catch (err) {
      setExtractError(en
        ? `Network error: ${err instanceof Error ? err.message : 'Try again'}`
        : `שגיאת רשת: ${err instanceof Error ? err.message : 'נסה שוב'}`);
    } finally {
      setLoading(false);
    }
  }

  function handleReupload() {
    setShowModal(false);
    setPreview(null);
    setBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleProceedAnyway() {
    setShowModal(false);
    await extractStats(base64!, mediaType, true);
  }

  // ── Step 3 ─────────────────────────────────────────────────────────────────
  function updateScore(team: 'home' | 'away', val: string) {
    if (!editedData) return;
    setEditedData({ ...editedData, [`${team}_score`]: parseInt(val) || 0 });
  }

  function updatePlayer(team: 'home' | 'away', idx: number, field: keyof ExtractedPlayer, val: string) {
    if (!editedData) return;
    const key = `${team}_players` as 'home_players' | 'away_players';
    const ps = [...editedData[key]];
    let parsed: string | number | null;
    if (field === 'name') {
      parsed = val;
    } else if (field === 'jersey') {
      if (val === '') {
        parsed = null;
      } else {
        const n = parseInt(val, 10);
        parsed = Number.isNaN(n) ? null : n;
      }
    } else {
      parsed = parseInt(val) || 0;
    }
    ps[idx] = { ...ps[idx], [field]: parsed };
    setEditedData({ ...editedData, [key]: ps });
  }

  function togglePlayed(team: 'home' | 'away', idx: number) {
    if (!editedData) return;
    const key = `${team}_players` as 'home_players' | 'away_players';
    const ps = [...editedData[key]];
    ps[idx] = { ...ps[idx], played: !ps[idx].played };
    setEditedData({ ...editedData, [key]: ps });
  }

  // ── Step 4 ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!editedData || !selectedGame) return;
    setLoading(true);
    setSubmitError('');

    let scoresheetImageUrl: string | undefined;
    if (base64 && mediaType) {
      setLoadingMsg(en ? 'Uploading image...' : 'מעלה תמונה...');
      try {
        const byteChars = atob(base64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const ext = mediaType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
        const blob = new Blob([byteArr], { type: mediaType });
        const file = new File([blob], `scoresheet.${ext}`, { type: mediaType });
        const fd = new FormData();
        fd.append('file', file);
        const uploadRes = await fetch('/api/upload-scoresheet', { method: 'POST', body: fd });
        const uploadData = await uploadRes.json();
        if (uploadData.url) scoresheetImageUrl = uploadData.url;
      } catch {
        // Non-fatal
      }
    }

    setLoadingMsg(en ? 'Sending data...' : 'שולח נתונים...');
    const result = await submitGameResult({
      gameId: selectedGame.id,
      submittedBy: selectedTeamName ? `${submitterName.trim()} · ${selectedTeamName}` : submitterName.trim(),
      homeScore: editedData.home_score,
      awayScore: editedData.away_score,
      extractedStats: editedData,
      confidenceScore: analysisResult?.confidence_score ?? 0,
      qualityStatus: isNeedsReview ? 'fail' : 'pass',
      status: isNeedsReview ? 'needs_review' : 'pending',
      scoresheetImageUrl,
    });

    setLoading(false);
    if (result.error) {
      setSubmitError(result.error);
    } else {
      setStep('success');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[60vh] flex items-start justify-center pt-8 px-4">
      <SubmitInstructionsModal />
      <div className="w-full max-w-xl space-y-6">

        {/* ── Step 1 ── */}
        {step === 'select' && (
          <div className="space-y-5">

            {/* One-time upload notice */}
            <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3" dir={en ? 'ltr' : 'rtl'}>
              <span className="text-yellow-400 text-lg shrink-0">⚠️</span>
              <p className="text-sm font-bold text-yellow-300">
                {en ? 'Game form upload is one-time — please pay attention' : 'העלאת טופס המשחק היא חד פעמית — נא לשים לב'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#8aaac8]">{t('הקבוצה שלך *')}</label>
              <select
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500/50"
                style={{ backgroundColor: '#0f1e30' }}
                value={selectedTeamId}
                onChange={e => { setSelectedTeamId(e.target.value); setSelectedGame(null); }}
              >
                <option value="" style={{ backgroundColor: '#0f1e30', color: 'white' }}>
                  {en ? '-- Select team --' : '-- בחר קבוצה --'}
                </option>
                {teams.map(team => (
                  <option key={team.id} value={team.id} style={{ backgroundColor: '#0f1e30', color: 'white' }}>
                    {t(team.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#8aaac8]">{t('בחר משחק')}</label>
              <select
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500/50"
                style={{ backgroundColor: '#0f1e30' }}
                value={selectedGame?.id ?? ''}
                onChange={e => setSelectedGame(visibleGames.find(g => g.id === e.target.value) ?? null)}
                disabled={!selectedTeamId}
              >
                <option value="" style={{ backgroundColor: '#0f1e30', color: 'white' }}>
                  {selectedTeamId
                    ? (en ? '-- Select game --' : '-- בחר משחק --')
                    : (en ? '-- Select team first --' : '-- בחר קבוצה תחילה --')}
                </option>
                {visibleGames.map(g => (
                  <option
                    key={g.id}
                    value={g.id}
                    disabled={g.is_locked}
                    style={{ backgroundColor: '#0f1e30', color: g.is_locked ? '#5a7a9a' : 'white' }}
                  >
                    {t(g.home_name)} {en ? 'vs' : 'נגד'} {t(g.away_name)} · {g.game_date}{g.is_locked ? (en ? ' 🔒 already submitted' : ' 🔒 כבר הוגש') : ''}
                  </option>
                ))}
              </select>
              {selectedTeamId && visibleGames.length === 0 && (
                <p className="text-xs text-[#5a7a9a]">{en ? 'No finished games found for this team' : 'לא נמצאו משחקים שהסתיימו לקבוצה זו'}</p>
              )}
              {selectedGame?.is_locked && (
                <p className="text-xs text-red-400">{en ? 'This game has already been submitted and is under review. Contact the league admin to cancel.' : 'משחק זה כבר הוגש ונמצא בבדיקה. פנה למנהל הליגה לביטול.'}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#8aaac8]">{t('שמך המלא *')}</label>
              <input
                type="text"
                placeholder={en ? 'John Doe' : 'ישראל ישראלי'}
                value={submitterName}
                onChange={e => setSubmitterName(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-[#4a6a8a] text-sm focus:outline-none focus:border-orange-500/50"
              />
            </div>

            <button
              onClick={handleGameSelect}
              disabled={!selectedGame || !submitterName.trim() || !selectedTeamId || selectedGame.is_locked}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all"
            >
              {t('המשך להעלאת טופס ←')}
            </button>
          </div>
        )}

        {/* ── Step 1.5: Instructions ── */}
        {step === 'instructions' && (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <div className="text-5xl mb-2">📋</div>
              <h2 className="text-xl font-black text-white">{en ? 'Submission Instructions' : 'הוראות הגשה'}</h2>
              <p className="text-sm text-[#5a7a9a]">{selectedGame ? t(selectedGame.home_name) : ''} {en ? 'vs' : 'נגד'} {selectedGame ? t(selectedGame.away_name) : ''}</p>
            </div>

            <div className={`rounded-2xl border border-orange-500/25 bg-orange-500/[0.06] p-5 space-y-4 ${en ? 'text-left' : 'text-right'}`}>
              <p className="text-sm font-black text-orange-300 flex items-center gap-2">
                <span>⚠️</span> {en ? 'Important before uploading' : 'חשוב לפני ההעלאה'}
              </p>
              <ul className="space-y-3 text-sm text-[#c8d8e8]">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-orange-400 mt-0.5">•</span>
                  <span>
                    {en
                      ? <>Photograph the <strong className="text-white">official game statistics sheet</strong> — not any other sheet.</>
                      : <>יש לצלם את <strong className="text-white">דף הסטטיסטיקות הרשמי</strong> של המשחק — לא גיליון אחר.</>}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-orange-400 mt-0.5">•</span>
                  <span>
                    {en
                      ? <>Make sure the form is <strong className="text-white">fully legible</strong> — all names, numbers and points are visible.</>
                      : <>ודא שהטופס <strong className="text-white">קריא לחלוטין</strong> — כל השמות, המספרים והנקודות גלויים.</>}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-orange-400 mt-0.5">•</span>
                  <span>
                    {en
                      ? <>The system will try to extract the data <strong className="text-white">automatically from the image</strong> — you can verify and correct before sending.</>
                      : <>המערכת תנסה לחלץ את הנתונים <strong className="text-white">אוטומטית מהתמונה</strong> — תוכל לאמת ולתקן לפני השליחה.</>}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-orange-400 mt-0.5">•</span>
                  <span>
                    {en
                      ? <>After submission, the data awaits <strong className="text-white">league admin approval</strong> before appearing in the standings.</>
                      : <>לאחר הגשה, הנתונים ממתינים <strong className="text-white">לאישור מנהל הליגה</strong> לפני שיופיעו בטבלאות.</>}
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="flex-1 border border-white/10 bg-white/5 text-[#8aaac8] hover:border-white/20 hover:text-white font-bold py-3 rounded-xl transition-all text-sm"
              >
                {t('← חזור')}
              </button>
              <button
                onClick={() => setStep('upload')}
                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl transition-all text-sm"
              >
                {en ? 'Upload game form →' : 'העלה טופס משחק ←'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-[#8aaac8]">
                {selectedGame ? t(selectedGame.home_name) : ''} {en ? 'vs' : 'נגד'} {selectedGame ? t(selectedGame.away_name) : ''}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
              id="scoresheet-input"
              disabled={loading}
            />

            {cropMode && preview ? (
              <ImageCropper
                imageSrc={preview}
                mimeType={mediaType}
                onConfirm={handleCropConfirm}
                onSkip={handleCropSkip}
              />
            ) : loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center space-y-3">
                <div className="animate-spin text-3xl">⚙️</div>
                <p className="text-[#8aaac8] font-medium">{loadingMsg}</p>
              </div>
            ) : preview ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={en ? 'Preview' : 'תצוגה מקדימה'} className="w-full rounded-xl object-contain max-h-64 border border-white/10" />
                <button
                  onClick={handleReupload}
                  className="w-full border border-white/10 text-[#8aaac8] hover:text-white font-medium py-2.5 rounded-xl transition-all text-sm hover:bg-white/5"
                >
                  {t('החלף תמונה')}
                </button>
              </div>
            ) : (
              <label htmlFor="scoresheet-input" className="cursor-pointer block">
                <div className="rounded-2xl border-2 border-dashed border-white/20 hover:border-orange-500/50 bg-white/[0.02] hover:bg-white/5 p-16 text-center transition-all space-y-3">
                  <div className="text-5xl">📋</div>
                  <p className="text-white font-bold">{t('העלה טופס משחק')}</p>
                  <p className="text-sm text-[#5a7a9a]">{t('צלם את דף הסטטיסטיקות של המשחק')}</p>
                  <span className="inline-block mt-2 bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all">
                    {t('📷 צלם / בחר תמונה')}
                  </span>
                </div>
              </label>
            )}

            {/* Extraction error — shown inline with retry */}
            {extractError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-3">
                <p className="text-sm text-red-300 font-medium">⚠️ {extractError}</p>
                <p className="text-xs text-[#5a7a9a]">
                  {en
                    ? 'Analysis may take up to 30 seconds. Click "Try again" to retry.'
                    : 'הניתוח עשוי לקחת עד 30 שניות. לחץ על ״נסה שוב״ כדי לנסות מחדש.'}
                </p>
                <button
                  onClick={() => {
                    setExtractError('');
                    extractStats(base64!, mediaType, isNeedsReview);
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 rounded-xl transition-all text-sm"
                >
                  {en ? '🔄 Try again' : '🔄 נסה שוב'}
                </button>
              </div>
            )}

            <button
              onClick={() => setStep('select')}
              className="text-[#5a7a9a] text-sm hover:text-white transition-colors"
            >
              {t('← חזור')}
            </button>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 'confirm' && editedData && selectedGame && (() => {
          const allPlayers = [...editedData.home_players, ...editedData.away_players];
          const allZeros = allPlayers.length > 0 && allPlayers.every(
            p => p.points === 0 && p.three_pointers === 0 && p.fouls === 0
          );
          return (
          <div className="space-y-5">
            {isNeedsReview && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-300">
                {en
                  ? '⚠️ Low image quality — please check the extracted data and fix errors before sending'
                  : '⚠️ איכות תמונה נמוכה — אנא בדוק את הנתונים שחולצו ותקן שגיאות לפני שליחה'}
              </div>
            )}
            {allZeros && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-sm text-orange-300">
                {en
                  ? '⚠️ The data looks empty — all points, fouls and threes are zero. Was the form legible? Please check and fix before sending.'
                  : '⚠️ הנתונים נראים ריקים — כל הנקודות, הפאולים והשלשות הם אפס. האם הטופס היה קריא? אנא בדוק ותקן לפני שליחה.'}
              </div>
            )}

            {/* Fuzzy matching legend */}
            {nameMatches && (
              <div className="flex flex-wrap gap-3 text-[10px] text-[#4a6a8a] bg-white/[0.02] rounded-xl px-3 py-2 border border-white/[0.05]">
                <span>{en ? '🔍 Names auto-matched to roster' : '🔍 שמות תואמו אוטומטית לרשימת השחקנים'}</span>
                <span className="text-[#5a7a9a]">{en ? '· OCR row (what was read from form) shown in gray below each name' : '· שורת ה-OCR (מה שנקרא מהטופס) מוצגת בצבע אפור מתחת לכל שם'}</span>
              </div>
            )}

            {/* Scores */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-[#8aaac8] uppercase tracking-wide">{en ? 'Game Result' : 'תוצאת המשחק'}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#5a7a9a] mb-1">{t(selectedGame.home_name)}</p>
                  <input
                    type="number"
                    value={editedData.home_score}
                    onChange={e => updateScore('home', e.target.value)}
                    className="w-20 text-center text-2xl font-black text-orange-400 bg-black/30 border border-white/10 rounded-lg py-2 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <span className="text-[#4a6a8a] font-bold text-xl">:</span>
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#5a7a9a] mb-1">{t(selectedGame.away_name)}</p>
                  <input
                    type="number"
                    value={editedData.away_score}
                    onChange={e => updateScore('away', e.target.value)}
                    className="w-20 text-center text-2xl font-black text-orange-400 bg-black/30 border border-white/10 rounded-lg py-2 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Players */}
            {(['home', 'away'] as const).map(team => {
              const ps      = editedData[`${team}_players`];
              const matches = nameMatches?.[team] ?? [];
              const roster  = team === 'home' ? homeRoster : awayRoster;
              const teamName = team === 'home' ? selectedGame.home_name : selectedGame.away_name;

              const playedCount = ps.filter(p => p.played).length;
              return (
                <div key={team} className="bg-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white">{teamName}</p>
                    <p className="text-[10px] text-[#5a7a9a]">
                      {en
                        ? `✓ Mark players who played (${playedCount}/${ps.length})`
                        : `✓ סמן את השחקנים ששיחקו (${playedCount}/${ps.length})`}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[#4a6a8a] border-b border-white/5">
                          <th className="text-center pb-2 font-medium w-8">{en ? 'Played' : 'שיחק'}</th>
                          <th className={`pb-2 font-medium ${en ? 'text-left' : 'text-right'}`}>{en ? 'Name' : 'שם'}</th>
                          <th className="text-center pb-2 font-medium w-10">#</th>
                          <th className="text-center pb-2 font-medium w-12">{t('נק׳')}</th>
                          <th className="text-center pb-2 font-medium w-12">{t('3נק׳')}</th>
                          <th className="text-center pb-2 font-medium w-12">{en ? 'Foul' : 'פאול'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {ps.map((p, i) => (
                          <tr key={i} className={p.played ? '' : 'opacity-40'}>
                            <td className="py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={!!p.played}
                                onChange={() => togglePlayed(team, i)}
                                className="w-4 h-4 accent-orange-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-1.5 pr-1">
                              <NameCell
                                match={matches[i] ?? null}
                                value={p.name}
                                onChange={v => updatePlayer(team, i, 'name', v)}
                                roster={roster}
                                ocrName={p.ocr_name}
                              />
                            </td>
                            <td className="py-1.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={p.jersey ?? ''}
                                onChange={e => updatePlayer(team, i, 'jersey', e.target.value)}
                                className="w-10 text-center bg-transparent text-[#8aaac8] focus:outline-none focus:text-white"
                              />
                            </td>
                            <td className="py-1.5">
                              <input
                                type="number"
                                value={p.points}
                                onChange={e => updatePlayer(team, i, 'points', e.target.value)}
                                className="w-12 text-center bg-transparent text-white focus:outline-none focus:text-orange-300"
                              />
                            </td>
                            <td className="py-1.5">
                              <input
                                type="number"
                                value={p.three_pointers}
                                onChange={e => updatePlayer(team, i, 'three_pointers', e.target.value)}
                                className="w-12 text-center bg-transparent text-white focus:outline-none focus:text-orange-300"
                              />
                            </td>
                            <td className="py-1.5">
                              <input
                                type="number"
                                value={p.fouls}
                                onChange={e => updatePlayer(team, i, 'fouls', e.target.value)}
                                className="w-12 text-center bg-transparent text-white focus:outline-none focus:text-orange-300"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {submitError && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-xl p-3">{submitError}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all"
            >
              {loading ? loadingMsg : t('✅ שלח נתונים לאישור')}
            </button>
            <button
              onClick={() => setStep('upload')}
              className="text-[#5a7a9a] text-sm hover:text-white transition-colors"
            >
              {t('← חזור')}
            </button>
          </div>
          );
        })()}

        {/* ── Step 4: Success ── */}
        {step === 'success' && (
          <div className="text-center space-y-4 py-16">
            <div className="text-6xl">✅</div>
            <h2 className="text-2xl font-black text-white">{t('תודה!')}</h2>
            <p className="text-[#8aaac8]">{t('הנתונים התקבלו וממתינים לאישור מנהל הליגה')}</p>
            {isNeedsReview && (
              <p className="text-xs text-yellow-300 bg-yellow-500/10 rounded-xl p-3">
                {en
                  ? 'This submission will be flagged for manual review due to low image quality'
                  : 'הגשה זו תסומן לבדיקה ידנית עקב איכות תמונה נמוכה'}
              </p>
            )}
          </div>
        )}
      </div>

      <ImageQualityModal
        isOpen={showModal}
        imagePreview={preview}
        issues={analysisResult?.issues ?? []}
        recommendation={analysisResult?.recommendation ?? ''}
        confidenceScore={analysisResult?.confidence_score ?? 0}
        onReupload={handleReupload}
        onProceed={handleProceedAnyway}
      />
    </div>
  );
}
