'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { upsertPlayoffGameStat, savePlayoffGameQuarters } from '@/app/admin/actions';
import GameStatsEditor, { type RosterPlayer } from '@/components/admin/GameStatsEditor';

interface Series {
  series_number: number;
  team_a: string;
  team_a_label: string;
  team_b: string;
  team_b_label: string;
}
interface Game {
  series_number: number;
  game_number: number;
  home_score: number | null;
  away_score: number | null;
  played: boolean;
  game_date: string | null;
  game_time: string | null;
  home_quarters: number[] | null;
  away_quarters: number[] | null;
  video_url: string | null;
  location: string | null;
}
interface PlayoffStatRow {
  series_number: number;
  game_number: number;
  player_id: string;
  points: number;
  three_pointers: number;
  fouls: number;
}

function homeFor(s: Series, gNum: number) { return gNum === 2 ? s.team_b : s.team_a; }
function awayFor(s: Series, gNum: number) { return gNum === 2 ? s.team_a : s.team_b; }

// Matches the public site: a game counts once both scores are in, even if the
// "shown" flag wasn't ticked (saving auto-publishes it anyway).
function isPlayed(g: Game) { return g.played || (g.home_score !== null && g.away_score !== null); }

function seriesWins(s: Series, games: Game[]) {
  let winsA = 0; let winsB = 0;
  for (const g of games.filter(g => g.series_number === s.series_number && isPlayed(g))) {
    const home = homeFor(s, g.game_number);
    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
    if ((homeWon && home === s.team_a) || (!homeWon && home !== s.team_a)) winsA++;
    else winsB++;
  }
  return { winsA, winsB };
}

// Determine which division a slot belongs to by reading its label
function divisionOf(label: string): 'North' | 'South' {
  return label.includes('צפון') ? 'North' : 'South';
}

function TeamSelect({
  value, label, teams, onChange, onClear, saving,
}: {
  value: string;
  label: string;
  teams: string[];
  onChange: (v: string) => void;
  onClear: () => void;
  saving: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
        >
          <option value="">— בחר קבוצה —</option>
          {teams.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {value && (
          <button
            onClick={onClear}
            disabled={saving}
            title="נקה קבוצה"
            className="rounded-lg border border-red-700 px-3 py-2 text-sm text-red-400 hover:bg-red-500/15 transition disabled:opacity-40"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function PlayoffTab() {
  const [series, setSeries]         = useState<Series[]>([]);
  const [games, setGames]           = useState<Game[]>([]);
  const [northTeams, setNorthTeams] = useState<string[]>([]);
  const [southTeams, setSouthTeams] = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [msg, setMsg]               = useState<{ ok: boolean; text: string } | null>(null);
  const [teamDraft, setTeamDraft]   = useState<Record<number, { a: string; b: string }>>({});
  const [gameDraft, setGameDraft]   = useState<Record<string, { hs: string; as: string; date: string; time: string; played: boolean; vu: string; loc: string }>>({});
  const [saving, setSaving]         = useState<string | null>(null);
  const [rostersByTeam, setRostersByTeam] = useState<Record<string, RosterPlayer[]>>({});
  const [stats, setStats]           = useState<PlayoffStatRow[]>([]);
  const [statsOpenKey, setStatsOpenKey] = useState<string | null>(null);
  // Bumped on every (re)load so an open GameStatsEditor remounts and re-seeds
  // its inputs from fresh data after an import — its player/quarter inputs use
  // seed-once useState, so a re-fetch alone wouldn't repaint them.
  const [dataVersion, setDataVersion] = useState(0);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/admin/playoff');
    const { series: s, games: g, northTeams: nt, southTeams: st, rostersByTeam: rb, stats: stt } = await res.json();
    setSeries(s);
    setGames(g);
    setNorthTeams(nt ?? []);
    setSouthTeams(st ?? []);
    setRostersByTeam(rb ?? {});
    setStats(stt ?? []);
    const td: Record<number, { a: string; b: string }> = {};
    for (const sr of s) td[sr.series_number] = { a: sr.team_a, b: sr.team_b };
    setTeamDraft(td);
    const gd: Record<string, { hs: string; as: string; date: string; time: string; played: boolean; vu: string; loc: string }> = {};
    for (const gm of g) {
      gd[`${gm.series_number}-${gm.game_number}`] = {
        hs: gm.home_score?.toString() ?? '',
        as: gm.away_score?.toString() ?? '',
        date: gm.game_date ?? '',
        time: gm.game_time ? gm.game_time.slice(0, 5) : '',
        played: gm.played,
        vu: gm.video_url ?? '',
        loc: gm.location ?? '',
      };
    }
    setGameDraft(gd);
    setDataVersion(v => v + 1);
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // "series-game" → { player_id → stat values }
  const statsByGame = useMemo(() => {
    const m: Record<string, Record<string, { points: number; three_pointers: number; fouls: number }>> = {};
    for (const s of stats) {
      const key = `${s.series_number}-${s.game_number}`;
      (m[key] ??= {})[s.player_id] = { points: s.points, three_pointers: s.three_pointers, fouls: s.fouls };
    }
    return m;
  }, [stats]);

  function gameRow(sNum: number, gNum: number): Game | undefined {
    return games.find(g => g.series_number === sNum && g.game_number === gNum);
  }

  function getGD(sNum: number, gNum: number) {
    return gameDraft[`${sNum}-${gNum}`] ?? { hs: '', as: '', date: '', time: '', played: false, vu: '', loc: '' };
  }
  function setGD(sNum: number, gNum: number, patch: Partial<{ hs: string; as: string; date: string; time: string; played: boolean; vu: string; loc: string }>) {
    const key = `${sNum}-${gNum}`;
    setGameDraft(prev => ({ ...prev, [key]: { ...getGD(sNum, gNum), ...patch } }));
  }

  function teamsFor(label: string) {
    // SF/final slots ("נצח סדרה N") carry no division — offer all playoff teams.
    if (!label.includes('צפון') && !label.includes('דרום')) return [...northTeams, ...southTeams];
    return divisionOf(label) === 'North' ? northTeams : southTeams;
  }

  async function createMissingSeries() {
    setSaving('create-series'); setMsg(null);
    const res = await fetch('/api/admin/playoff', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ ok: false, text: `❌ ${data.error ?? 'שגיאה ביצירת הסדרות'}` });
    } else {
      await loadData();
      setMsg({ ok: true, text: `✅ נוצרו ${data.created} סדרות — קבוצות מנצחות מולאו אוטומטית` });
    }
    setSaving(null);
  }

  async function saveTeams(sNum: number) {
    const draft = teamDraft[sNum];
    if (!draft) return;
    setSaving(`team-${sNum}`); setMsg(null);
    const res = await fetch('/api/admin/playoff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series_number: sNum, team_a: draft.a, team_b: draft.b }),
    });
    setSaving(null);
    if (res.ok) {
      setSeries(prev => prev.map(s => s.series_number === sNum ? { ...s, team_a: draft.a, team_b: draft.b } : s));
      setMsg({ ok: true, text: `✅ סדרה ${sNum} עודכנה` });
    } else {
      setMsg({ ok: false, text: 'שגיאה בשמירה' });
    }
  }

  async function clearTeam(sNum: number, slot: 'a' | 'b') {
    setTeamDraft(prev => ({ ...prev, [sNum]: { ...prev[sNum], [slot]: '' } }));
    const draft = { ...teamDraft[sNum], [slot]: '' };
    setSaving(`team-${sNum}`); setMsg(null);
    const res = await fetch('/api/admin/playoff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series_number: sNum, team_a: draft.a, team_b: draft.b }),
    });
    setSaving(null);
    if (res.ok) {
      setSeries(prev => prev.map(s => s.series_number === sNum
        ? { ...s, team_a: slot === 'a' ? '' : s.team_a, team_b: slot === 'b' ? '' : s.team_b }
        : s));
      setMsg({ ok: true, text: `✅ קבוצה הוסרה מסדרה ${sNum}` });
    } else {
      setMsg({ ok: false, text: 'שגיאה' });
    }
  }

  async function saveGame(sNum: number, gNum: number) {
    const d = getGD(sNum, gNum);
    const key = `game-${sNum}-${gNum}`;
    // Auto-publish: a game with both scores entered is a real result, so mark it
    // "shown" automatically. Saves the admin from having to also tick הוצג —
    // forgetting it used to silently hide the scores from the public site.
    const played = d.played || (d.hs !== '' && d.as !== '');
    if (played !== d.played) setGD(sNum, gNum, { played });
    setSaving(key); setMsg(null);
    const res = await fetch('/api/admin/playoff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        series_number: sNum, game_number: gNum,
        home_score: d.hs !== '' ? parseInt(d.hs) : null,
        away_score: d.as !== '' ? parseInt(d.as) : null,
        played,
        game_date: d.date || null,
        game_time: d.time || null,
        video_url: d.vu.trim() || null,
        location: d.loc.trim() || null,
      }),
    });
    setSaving(null);
    if (res.ok) {
      const prevGame = gameRow(sNum, gNum);
      const updated: Game = {
        series_number: sNum, game_number: gNum,
        home_score: d.hs !== '' ? parseInt(d.hs) : null,
        away_score: d.as !== '' ? parseInt(d.as) : null,
        played, game_date: d.date || null, game_time: d.time || null,
        home_quarters: prevGame?.home_quarters ?? null,
        away_quarters: prevGame?.away_quarters ?? null,
        video_url: d.vu.trim() || null,
        location: d.loc.trim() || null,
      };
      setGames(prev => {
        const exists = prev.find(g => g.series_number === sNum && g.game_number === gNum);
        return exists ? prev.map(g => g.series_number === sNum && g.game_number === gNum ? updated : g) : [...prev, updated];
      });
      setMsg({ ok: true, text: `✅ G${gNum} בסדרה ${sNum} נשמר` });
    } else {
      setMsg({ ok: false, text: 'שגיאה בשמירה' });
    }
  }

  if (loading) return <p className="text-center text-gray-500 py-12">טוען...</p>;

  return (
    <div className="space-y-8">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-white">ניהול פלייאוף</h2>
        <p className="mt-1 text-sm text-gray-400">הגדר קבוצות ורשום תוצאות — הרשימה מציגה 4 מובילות בכל מחוז</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium text-right ${msg.ok ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {northTeams.length === 0 && southTeams.length === 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400 text-right">
          ⚠️ לא נמצאו קבוצות בטבלת העמדות — יש לסנכרן נתוני ליגה תחילה
        </div>
      )}

      {/* Missing rounds (e.g. only the QF exists) — one click creates the rest
          of the bracket, prefilled with decided winners. */}
      {series.length < 7 && (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/[0.06] px-5 py-4 text-right sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">
              {series.length === 0 ? 'הפלייאוף עדיין לא הוגדר' : 'חסרות סדרות בעץ — חצי גמר / גמר'}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              יצירת הסדרות החסרות תמלא אוטומטית קבוצות שכבר הוכרעו בשלב הקודם
            </p>
          </div>
          <button
            onClick={createMissingSeries}
            disabled={saving === 'create-series'}
            className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-400 disabled:opacity-50"
          >
            {saving === 'create-series' ? 'יוצר...' : '➕ צור את הסדרות החסרות'}
          </button>
        </div>
      )}

      {series.map((s) => {
        const { winsA, winsB } = seriesWins(s, games);
        const seriesOver = winsA >= 2 || winsB >= 2;
        const isSavingTeams = saving === `team-${s.series_number}`;

        return (
          <div key={s.series_number} className="rounded-2xl border border-gray-700 bg-gray-800/40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-800/60 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-orange-400">
                  סדרה {s.series_number} · {s.series_number >= 7 ? 'גמר' : s.series_number >= 5 ? 'חצי גמר' : 'רבע גמר'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${seriesOver ? 'bg-green-900/40 text-green-400' : 'bg-orange-900/30 text-orange-400'}`}>
                  {seriesOver ? '✓ הסתיים' : `${winsA}–${winsB}`}
                </span>
              </div>
              <span className="text-xs text-gray-500">{s.team_a_label} vs {s.team_b_label}</span>
            </div>

            <div className="p-5 space-y-6">
              {/* Team dropdowns */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 text-right uppercase tracking-wider">קבוצות</p>
                <div className="grid grid-cols-2 gap-3">
                  <TeamSelect
                    label={`${s.team_a_label} · ביתי G1+G3`}
                    value={teamDraft[s.series_number]?.a ?? ''}
                    teams={teamsFor(s.team_a_label)}
                    onChange={v => setTeamDraft(p => ({ ...p, [s.series_number]: { ...p[s.series_number], a: v } }))}
                    onClear={() => clearTeam(s.series_number, 'a')}
                    saving={isSavingTeams}
                  />
                  <TeamSelect
                    label={`${s.team_b_label} · ביתי G2`}
                    value={teamDraft[s.series_number]?.b ?? ''}
                    teams={teamsFor(s.team_b_label)}
                    onChange={v => setTeamDraft(p => ({ ...p, [s.series_number]: { ...p[s.series_number], b: v } }))}
                    onClear={() => clearTeam(s.series_number, 'b')}
                    saving={isSavingTeams}
                  />
                </div>
                <button
                  onClick={() => saveTeams(s.series_number)}
                  disabled={isSavingTeams}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 transition disabled:opacity-50"
                >
                  {isSavingTeams ? 'שומר...' : 'שמור קבוצות'}
                </button>
              </div>

              {/* Game results */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 text-right uppercase tracking-wider">תוצאות משחקים</p>
                {[1, 2, 3].map((gNum) => {
                  const d = getGD(s.series_number, gNum);
                  const homeTeam = s.team_a ? homeFor(s, gNum) : `ביתי (G${gNum})`;
                  const awayTeam = s.team_b ? awayFor(s, gNum) : `אורח (G${gNum})`;
                  const gKey = `game-${s.series_number}-${gNum}`;

                  return (
                    <div key={gNum} className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={d.played}
                            onChange={e => setGD(s.series_number, gNum, { played: e.target.checked })}
                            className="accent-orange-500" />
                          <span className="text-gray-300">הוצג</span>
                        </label>
                        <span className="text-xs font-black text-orange-400">
                          G{gNum}{gNum === 3 ? ' (אם נדרש)' : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-2">
                        <div className="text-right text-xs text-gray-300 truncate">{homeTeam}</div>
                        <input type="number" value={d.hs}
                          onChange={e => setGD(s.series_number, gNum, { hs: e.target.value })}
                          placeholder="0"
                          className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-center text-sm font-bold text-white focus:border-orange-500 focus:outline-none" />
                        <span className="text-gray-600">–</span>
                        <input type="number" value={d.as}
                          onChange={e => setGD(s.series_number, gNum, { as: e.target.value })}
                          placeholder="0"
                          className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-center text-sm font-bold text-white focus:border-orange-500 focus:outline-none" />
                        <div className="text-left text-xs text-gray-300 truncate">{awayTeam}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <input type="date" value={d.date}
                          onChange={e => setGD(s.series_number, gNum, { date: e.target.value })}
                          className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none [color-scheme:dark]" />
                        <input type="time" value={d.time}
                          onChange={e => setGD(s.series_number, gNum, { time: e.target.value })}
                          title="שעת המשחק"
                          className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none [color-scheme:dark]" />
                        <button onClick={() => saveGame(s.series_number, gNum)}
                          disabled={saving === gKey}
                          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600 transition disabled:opacity-50">
                          {saving === gKey ? 'שומר...' : '✓ שמור'}
                        </button>
                        <button
                          onClick={() => setStatsOpenKey(prev => prev === gKey ? null : gKey)}
                          disabled={!s.team_a || !s.team_b}
                          title="סטטיסטיקת שחקנים ורבעים"
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                            statsOpenKey === gKey ? 'bg-orange-500/20 text-orange-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                          }`}
                        >
                          📊 סטטיסטיקה
                        </button>
                      </div>

                      {/* Location — full-width row; saved with the rest of the game on ✓ שמור */}
                      <div dir="rtl" className="flex items-center gap-2">
                        <span className="text-gray-500 text-base shrink-0">📍</span>
                        <input
                          type="text"
                          value={d.loc}
                          onChange={e => setGD(s.series_number, gNum, { loc: e.target.value })}
                          placeholder="מיקום המשחק (אולם / כתובת)"
                          className="flex-1 min-w-0 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      {/* Video URL — full-width row; saved with the rest of the game on ✓ שמור */}
                      <div dir="ltr" className="flex items-center gap-2">
                        <span className="text-gray-500 text-base shrink-0">🎥</span>
                        <input
                          type="url"
                          value={d.vu}
                          onChange={e => setGD(s.series_number, gNum, { vu: e.target.value })}
                          placeholder="https://youtube.com/watch?v=…"
                          className="flex-1 min-w-0 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-orange-500 focus:outline-none"
                        />
                        {d.vu.trim() && (
                          <a
                            href={d.vu}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="פתח בלשונית חדשה"
                            className="shrink-0 text-rose-400 hover:text-rose-300 transition text-sm"
                          >
                            ↗
                          </a>
                        )}
                      </div>

                      {statsOpenKey === gKey && s.team_a && s.team_b && (() => {
                        const row = gameRow(s.series_number, gNum);
                        const homeScore = d.hs !== '' ? parseInt(d.hs) : (row?.home_score ?? null);
                        const awayScore = d.as !== '' ? parseInt(d.as) : (row?.away_score ?? null);
                        return (
                          <div dir="rtl" className="rounded-xl border border-orange-500/20 bg-orange-500/[0.03] p-3 mt-1">
                            <PlayoffStatsUpload seriesNumber={s.series_number} gameNumber={gNum} onImported={loadData} />
                            <GameStatsEditor
                              key={`gse-${gKey}-${dataVersion}`}
                              homeTeamName={homeTeam}
                              awayTeamName={awayTeam}
                              homePlayers={rostersByTeam[homeTeam] ?? []}
                              awayPlayers={rostersByTeam[awayTeam] ?? []}
                              homeScore={homeScore}
                              awayScore={awayScore}
                              initialStats={statsByGame[gKey.replace('game-', '')] ?? {}}
                              initialHomeQuarters={row?.home_quarters ?? null}
                              initialAwayQuarters={row?.away_quarters ?? null}
                              onSavePlayer={(playerId, v) => upsertPlayoffGameStat({
                                playerId, seriesNumber: s.series_number, gameNumber: gNum,
                                points: v.points, threePointers: v.three_pointers, fouls: v.fouls,
                              })}
                              onSaveQuarters={(home, away) => savePlayoffGameQuarters({
                                seriesNumber: s.series_number, gameNumber: gNum, homeQuarters: home, awayQuarters: away,
                              })}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Per-game Excel upload (official "סיכום" scoresheet → playoff box score) ──
function PlayoffStatsUpload({ seriesNumber, gameNumber, onImported }: { seriesNumber: number; gameNumber: number; onImported: () => Promise<void> }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('seriesNumber', String(seriesNumber));
      fd.append('gameNumber', String(gameNumber));
      const res = await fetch('/api/admin/playoff-stats/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'שגיאה בייבוא');
      setMsg({ ok: true, text: data.message ?? '✅ יובא' });
      // Re-fetch so the box score + quarters repaint in place (the editor
      // remounts via its dataVersion key). Swallow a refresh error — the
      // import itself already succeeded.
      await onImported().catch(() => {});
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
      <span className="text-xs font-black text-emerald-300">📊 ייבוא מטופס השיפוט</span>
      <span className="text-[11px] text-[#5a7a9a]">גליון &quot;סיכום&quot; ימלא את גיליון המשחק</span>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="ms-auto rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-40"
      >
        {busy ? 'מעלה…' : '⬆️ העלה קובץ'}
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
      {msg && (
        <p className={`w-full text-[11px] font-medium ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
      )}
    </div>
  );
}
