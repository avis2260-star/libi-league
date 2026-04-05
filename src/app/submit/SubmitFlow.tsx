'use client';

import { useState, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import ImageQualityModal from '@/components/ImageQualityModal';
import { submitGameResult } from '@/app/admin/actions';

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
  jersey: number | null;
  points: number;
  three_pointers: number;
  fouls: number;
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

type Step = 'select' | 'upload' | 'confirm' | 'success';

// ── Player name cell with OCR hint + optional dropdown ────────────────────────
function NameCell({
  match,
  value,
  onChange,
  roster,
}: {
  match: NameMatch | null;
  value: string;
  onChange: (v: string) => void;
  roster: RosterPlayer[];
}) {
  const showSuggestion = match && match.score > 0 && match.ocr !== match.matched;
  const isLowConfidence = match && match.score < (1 - DROPDOWN_THRESHOLD) && match.score > 0;

  if (isLowConfidence && roster.length > 0) {
    // Show a dropdown with roster options
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
        <p className="text-[9px] text-yellow-500/70">⚠ בחר שחקן מהרשימה</p>
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
      {showSuggestion && (
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
    setStep('upload');
  }

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setMediaType(file.type || 'image/jpeg');
    setLoading(true);
    setLoadingMsg('בודק איכות תמונה...');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1];
      setBase64(b64);

      try {
        const res = await fetch('/api/analyze-scoresheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: b64, mediaType: file.type }),
        });
        const analysis = await res.json();
        setAnalysisResult(analysis);

        if (analysis.status === 'fail') {
          setLoading(false);
          setShowModal(true);
        } else {
          await extractStats(b64, file.type, false);
        }
      } catch {
        setLoading(false);
        alert('שגיאה בניתוח התמונה. נסה שוב.');
      }
    };
  }

  async function extractStats(b64: string, type: string, needsReview: boolean) {
    setLoading(true);
    setExtractError('');
    setLoadingMsg('מחלץ נתונים מהטופס... (עד 30 שניות)');
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
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setExtractError(`שגיאה: ${data.error ?? 'תגובה לא תקינה מהשרת'}`);
        setLoading(false);
        return;
      }

      const extracted = data as ExtractedData;

      // ── Fuzzy-match extracted names against official rosters ──────────────
      setLoadingMsg('מתאים שמות לרשימת שחקנים...');
      const homeMatches = extracted.home_players.map(p => matchName(p.name, homeFuse));
      const awayMatches = extracted.away_players.map(p => matchName(p.name, awayFuse));
      setNameMatches({ home: homeMatches, away: awayMatches });

      const patched: ExtractedData = {
        ...extracted,
        home_players: extracted.home_players.map((p, i) => ({ ...p, name: homeMatches[i].matched })),
        away_players: extracted.away_players.map((p, i) => ({ ...p, name: awayMatches[i].matched })),
      };

      setExtractedData(extracted);
      setEditedData(JSON.parse(JSON.stringify(patched)));
      setStep('confirm');
    } catch (err) {
      setExtractError(`שגיאת רשת: ${err instanceof Error ? err.message : 'נסה שוב'}`);
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
    ps[idx] = { ...ps[idx], [field]: field === 'name' ? val : (parseInt(val) || 0) };
    setEditedData({ ...editedData, [key]: ps });
  }

  // ── Step 4 ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!editedData || !selectedGame) return;
    setLoading(true);
    setSubmitError('');

    let scoresheetImageUrl: string | undefined;
    if (base64 && mediaType) {
      setLoadingMsg('מעלה תמונה...');
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

    setLoadingMsg('שולח נתונים...');
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
      <div className="w-full max-w-xl space-y-6">

        {/* ── Step 1 ── */}
        {step === 'select' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#8aaac8]">הקבוצה שלך *</label>
              <select
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500/50"
                style={{ backgroundColor: '#0f1e30' }}
                value={selectedTeamId}
                onChange={e => { setSelectedTeamId(e.target.value); setSelectedGame(null); }}
              >
                <option value="" style={{ backgroundColor: '#0f1e30', color: 'white' }}>-- בחר קבוצה --</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id} style={{ backgroundColor: '#0f1e30', color: 'white' }}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#8aaac8]">בחר משחק</label>
              <select
                className="w-full rounded-xl border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500/50"
                style={{ backgroundColor: '#0f1e30' }}
                value={selectedGame?.id ?? ''}
                onChange={e => setSelectedGame(visibleGames.find(g => g.id === e.target.value) ?? null)}
                disabled={!selectedTeamId}
              >
                <option value="" style={{ backgroundColor: '#0f1e30', color: 'white' }}>
                  {selectedTeamId ? '-- בחר משחק --' : '-- בחר קבוצה תחילה --'}
                </option>
                {visibleGames.map(g => (
                  <option
                    key={g.id}
                    value={g.id}
                    disabled={g.is_locked}
                    style={{ backgroundColor: '#0f1e30', color: g.is_locked ? '#5a7a9a' : 'white' }}
                  >
                    {g.home_name} נגד {g.away_name} · {g.game_date}{g.is_locked ? ' 🔒 כבר הוגש' : ''}
                  </option>
                ))}
              </select>
              {selectedTeamId && visibleGames.length === 0 && (
                <p className="text-xs text-[#5a7a9a]">לא נמצאו משחקים שהסתיימו לקבוצה זו</p>
              )}
              {selectedGame?.is_locked && (
                <p className="text-xs text-red-400">משחק זה כבר הוגש ונמצא בבדיקה. פנה למנהל הליגה לביטול.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#8aaac8]">שמך המלא *</label>
              <input
                type="text"
                placeholder="ישראל ישראלי"
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
              המשך להעלאת טופס ←
            </button>
          </div>
        )}

        {/* ── Step 2: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-[#8aaac8]">
                {selectedGame?.home_name} נגד {selectedGame?.away_name}
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

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center space-y-3">
                <div className="animate-spin text-3xl">⚙️</div>
                <p className="text-[#8aaac8] font-medium">{loadingMsg}</p>
              </div>
            ) : preview ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="תצוגה מקדימה" className="w-full rounded-xl object-contain max-h-64 border border-white/10" />
                <button
                  onClick={handleReupload}
                  className="w-full border border-white/10 text-[#8aaac8] hover:text-white font-medium py-2.5 rounded-xl transition-all text-sm hover:bg-white/5"
                >
                  החלף תמונה
                </button>
              </div>
            ) : (
              <label htmlFor="scoresheet-input" className="cursor-pointer block">
                <div className="rounded-2xl border-2 border-dashed border-white/20 hover:border-orange-500/50 bg-white/[0.02] hover:bg-white/5 p-16 text-center transition-all space-y-3">
                  <div className="text-5xl">📋</div>
                  <p className="text-white font-bold">העלה טופס משחק</p>
                  <p className="text-sm text-[#5a7a9a]">צלם את דף הסטטיסטיקות של המשחק</p>
                  <span className="inline-block mt-2 bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all">
                    📷 צלם / בחר תמונה
                  </span>
                </div>
              </label>
            )}

            {/* Extraction error — shown inline with retry */}
            {extractError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-3">
                <p className="text-sm text-red-300 font-medium">⚠️ {extractError}</p>
                <p className="text-xs text-[#5a7a9a]">הניתוח עשוי לקחת עד 30 שניות. לחץ על ״נסה שוב״ כדי לנסות מחדש.</p>
                <button
                  onClick={() => {
                    setExtractError('');
                    extractStats(base64!, mediaType, isNeedsReview);
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 rounded-xl transition-all text-sm"
                >
                  🔄 נסה שוב
                </button>
              </div>
            )}

            <button
              onClick={() => setStep('select')}
              className="text-[#5a7a9a] text-sm hover:text-white transition-colors"
            >
              ← חזור
            </button>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === 'confirm' && editedData && selectedGame && (
          <div className="space-y-5">
            {isNeedsReview && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-300">
                ⚠️ איכות תמונה נמוכה — אנא בדוק את הנתונים שחולצו ותקן שגיאות לפני שליחה
              </div>
            )}

            {/* Fuzzy matching legend */}
            {nameMatches && (
              <div className="flex flex-wrap gap-3 text-[10px] text-[#4a6a8a] bg-white/[0.02] rounded-xl px-3 py-2 border border-white/[0.05]">
                <span>🔍 שמות תואמו אוטומטית לרשימת השחקנים</span>
                <span className="text-[#5a7a9a]">· שורת ה-OCR (מה שנקרא מהטופס) מוצגת בצבע אפור מתחת לכל שם</span>
              </div>
            )}

            {/* Scores */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-[#8aaac8] uppercase tracking-wide">תוצאת המשחק</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#5a7a9a] mb-1">{selectedGame.home_name}</p>
                  <input
                    type="number"
                    value={editedData.home_score}
                    onChange={e => updateScore('home', e.target.value)}
                    className="w-20 text-center text-2xl font-black text-orange-400 bg-black/30 border border-white/10 rounded-lg py-2 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <span className="text-[#4a6a8a] font-bold text-xl">:</span>
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#5a7a9a] mb-1">{selectedGame.away_name}</p>
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

              return (
                <div key={team} className="bg-white/5 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-[#8aaac8] uppercase tracking-wide">{teamName}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[#4a6a8a] border-b border-white/5">
                          <th className="text-right pb-2 font-medium">שם</th>
                          <th className="text-center pb-2 font-medium w-10">#</th>
                          <th className="text-center pb-2 font-medium w-12">נק׳</th>
                          <th className="text-center pb-2 font-medium w-12">3נק׳</th>
                          <th className="text-center pb-2 font-medium w-12">פאול</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {ps.map((p, i) => (
                          <tr key={i}>
                            <td className="py-1.5 pr-1">
                              <NameCell
                                match={matches[i] ?? null}
                                value={p.name}
                                onChange={v => updatePlayer(team, i, 'name', v)}
                                roster={roster}
                              />
                            </td>
                            <td className="py-1.5">
                              <input
                                type="number"
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
              {loading ? loadingMsg : '✅ שלח נתונים לאישור'}
            </button>
            <button
              onClick={() => setStep('upload')}
              className="text-[#5a7a9a] text-sm hover:text-white transition-colors"
            >
              ← חזור
            </button>
          </div>
        )}

        {/* ── Step 4: Success ── */}
        {step === 'success' && (
          <div className="text-center space-y-4 py-16">
            <div className="text-6xl">✅</div>
            <h2 className="text-2xl font-black text-white">תודה!</h2>
            <p className="text-[#8aaac8]">הנתונים התקבלו וממתינים לאישור מנהל הליגה</p>
            {isNeedsReview && (
              <p className="text-xs text-yellow-300 bg-yellow-500/10 rounded-xl p-3">
                הגשה זו תסומן לבדיקה ידנית עקב איכות תמונה נמוכה
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
