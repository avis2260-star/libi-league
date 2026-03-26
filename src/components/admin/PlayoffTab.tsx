'use client';

import { useEffect, useState } from 'react';

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
}

function homeFor(s: Series, gNum: number) { return gNum === 2 ? s.team_b : s.team_a; }
function awayFor(s: Series, gNum: number) { return gNum === 2 ? s.team_a : s.team_b; }

function seriesWins(s: Series, games: Game[]) {
  let winsA = 0; let winsB = 0;
  for (const g of games.filter(g => g.series_number === s.series_number && g.played)) {
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
  const [gameDraft, setGameDraft]   = useState<Record<string, { hs: string; as: string; date: string; played: boolean }>>({});
  const [saving, setSaving]         = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/playoff')
      .then(r => r.json())
      .then(({ series: s, games: g, northTeams: nt, southTeams: st }) => {
        setSeries(s);
        setGames(g);
        setNorthTeams(nt ?? []);
        setSouthTeams(st ?? []);
        const td: Record<number, { a: string; b: string }> = {};
        for (const sr of s) td[sr.series_number] = { a: sr.team_a, b: sr.team_b };
        setTeamDraft(td);
        const gd: Record<string, { hs: string; as: string; date: string; played: boolean }> = {};
        for (const gm of g) {
          gd[`${gm.series_number}-${gm.game_number}`] = {
            hs: gm.home_score?.toString() ?? '',
            as: gm.away_score?.toString() ?? '',
            date: gm.game_date ?? '',
            played: gm.played,
          };
        }
        setGameDraft(gd);
      })
      .finally(() => setLoading(false));
  }, []);

  function getGD(sNum: number, gNum: number) {
    return gameDraft[`${sNum}-${gNum}`] ?? { hs: '', as: '', date: '', played: false };
  }
  function setGD(sNum: number, gNum: number, patch: Partial<{ hs: string; as: string; date: string; played: boolean }>) {
    const key = `${sNum}-${gNum}`;
    setGameDraft(prev => ({ ...prev, [key]: { ...getGD(sNum, gNum), ...patch } }));
  }

  function teamsFor(label: string) {
    return divisionOf(label) === 'North' ? northTeams : southTeams;
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
    setSaving(key); setMsg(null);
    const res = await fetch('/api/admin/playoff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        series_number: sNum, game_number: gNum,
        home_score: d.hs !== '' ? parseInt(d.hs) : null,
        away_score: d.as !== '' ? parseInt(d.as) : null,
        played: d.played,
        game_date: d.date || null,
      }),
    });
    setSaving(null);
    if (res.ok) {
      const updated = {
        series_number: sNum, game_number: gNum,
        home_score: d.hs !== '' ? parseInt(d.hs) : null,
        away_score: d.as !== '' ? parseInt(d.as) : null,
        played: d.played, game_date: d.date || null,
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

      {series.map((s) => {
        const { winsA, winsB } = seriesWins(s, games);
        const seriesOver = winsA >= 2 || winsB >= 2;
        const isSavingTeams = saving === `team-${s.series_number}`;

        return (
          <div key={s.series_number} className="rounded-2xl border border-gray-700 bg-gray-800/40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-800/60 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-orange-400">סדרה {s.series_number}</span>
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
                        <button onClick={() => saveGame(s.series_number, gNum)}
                          disabled={saving === gKey}
                          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600 transition disabled:opacity-50">
                          {saving === gKey ? 'שומר...' : '✓ שמור'}
                        </button>
                      </div>
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
