'use client';

import { useState, useRef } from 'react';
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

type Step = 'select' | 'upload' | 'confirm' | 'success';

export default function SubmitFlow({ games, teams }: { games: Game[]; teams: Team[] }) {
  const [step, setStep] = useState<Step>('select');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [submitterName, setSubmitterName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const selectedTeamName = teams.find(t => t.id === selectedTeamId)?.name ?? '';

  // When a team is selected, filter games to only those involving that team
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
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Select game ────────────────────────────────────────────────────
  function handleGameSelect() {
    if (!selectedGame || !submitterName.trim() || !selectedTeamId) return;
    setStep('upload');
  }

  // ── Step 2: Upload + pre-flight ────────────────────────────────────────────
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
        // Pre-flight quality check
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
    setLoadingMsg('מחלץ נתונים מהטופס...');
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
      const data: ExtractedData = await res.json();
      setExtractedData(data);
      setEditedData(JSON.parse(JSON.stringify(data))); // deep copy for editing
      setStep('confirm');
    } catch {
      alert('שגיאה בחילוץ הנתונים. נסה שוב.');
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

  // ── Step 3: Edit extracted data ────────────────────────────────────────────
  function updateScore(team: 'home' | 'away', val: string) {
    if (!editedData) return;
    setEditedData({
      ...editedData,
      [`${team}_score`]: parseInt(val) || 0,
    });
  }

  function updatePlayer(team: 'home' | 'away', idx: number, field: keyof ExtractedPlayer, val: string) {
    if (!editedData) return;
    const key = `${team}_players` as 'home_players' | 'away_players';
    const players = [...editedData[key]];
    players[idx] = { ...players[idx], [field]: field === 'name' ? val : (parseInt(val) || 0) };
    setEditedData({ ...editedData, [key]: players });
  }

  // ── Step 4: Submit ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!editedData || !selectedGame) return;
    setLoading(true);
    setLoadingMsg('שולח נתונים...');
    setSubmitError('');

    const result = await submitGameResult({
      gameId: selectedGame.id,
      submittedBy: selectedTeamName ? `${submitterName.trim()} · ${selectedTeamName}` : submitterName.trim(),
      homeScore: editedData.home_score,
      awayScore: editedData.away_score,
      extractedStats: editedData,
      confidenceScore: analysisResult?.confidence_score ?? 0,
      qualityStatus: isNeedsReview ? 'fail' : 'pass',
      status: isNeedsReview ? 'needs_review' : 'pending',
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

        {/* ── Step 1: Select game + name ───────────────────────────────────── */}
        {step === 'select' && (
          <div className="space-y-5">

            {/* Team selector */}
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

            {/* Game selector — filtered by team once selected */}
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

        {/* ── Step 2: Upload ───────────────────────────────────────────────── */}
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

            <button
              onClick={() => setStep('select')}
              className="text-[#5a7a9a] text-sm hover:text-white transition-colors"
            >
              ← חזור
            </button>
          </div>
        )}

        {/* ── Step 3: Confirm extracted stats ─────────────────────────────── */}
        {step === 'confirm' && editedData && selectedGame && (
          <div className="space-y-5">
            {isNeedsReview && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-300">
                ⚠️ איכות תמונה נמוכה — אנא בדוק את הנתונים שחולצו ותקן שגיאות לפני שליחה
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
              const players = editedData[`${team}_players`];
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
                        {players.map((p, i) => (
                          <tr key={i}>
                            <td className="py-1.5 pr-1">
                              <input
                                value={p.name}
                                onChange={e => updatePlayer(team, i, 'name', e.target.value)}
                                className="w-full bg-transparent text-white text-xs focus:outline-none focus:text-orange-300"
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

        {/* ── Step 4: Success ──────────────────────────────────────────────── */}
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

      {/* Quality modal */}
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
