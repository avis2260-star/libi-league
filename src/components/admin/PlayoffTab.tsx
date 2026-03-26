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

export default function PlayoffTab() {
  const [series, setSeries]   = useState<Series[]>([]);
  const [games, setGames]     = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  // Draft states for editing
  const [teamDraft, setTeamDraft]   = useState<Record<number, { a: string; b: string }>>({});
  const [gameDraft, setGameDraft]   = useState<Record<string, { hs: string; as: string; date: string; played: boolean }>>({});
  const [saving, setSaving]         = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/playoff')
      .then(r => r.json())
      .then(({ series: s, games: g }) => {
        setSeries(s);
        setGames(g);
        const td: Record<number, { a: string; b: string }> = {};
        for (const sr of s) td[sr.series_number] = { a: sr.team_a, b: sr.team_b };
        setTeamDraft(td);
        const gd: Record<string, { hs: string; as: string; date: string; played: boolean }> = {};
        for (const gm of g) {
          const key = `${gm.series_number}-${gm.game_number}`;
          gd[key] = {
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
    const key = `${sNum}-${gNum}`;
    return gameDraft[key] ?? { hs: '', as: '', date: '', played: false };
  }
  function setGD(sNum: number, gNum: number, patch: Partial<{ hs: string; as: string; date: string; played: boolean }>) {
    const key = `${sNum}-${gNum}`;
    setGameDraft(prev => ({ ...prev, [key]: { ...getGD(sNum, gNum), ...patch } }));
  }

  async function saveTeams(sNum: number) {
    const draft = teamDraft[sNum];
    if (!draft) return;
    setSaving(`team-${sNum}`);
    setMsg(null);
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

  async function saveGame(sNum: number, gNum: number) {
    const d = getGD(sNum, gNum);
    setSaving(`game-${sNum}-${gNum}`);
    setMsg(null);
    const res = await fetch('/api/admin/playoff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        series_number: sNum,
        game_number: gNum,
        home_score: d.hs !== '' ? parseInt(d.hs) : null,
        away_score: d.as !== '' ? parseInt(d.as) : null,
        played: d.played,
        game_date: d.date || null,
      }),
    });
    setSaving(null);
    if (res.ok) {
      setGames(prev => {
        const existing = prev.find(g => g.series_number === sNum && g.game_number === gNum);
        const updated = {
          series_number: sNum, game_number: gNum,
          home_score: d.hs !== '' ? parseInt(d.hs) : null,
          away_score: d.as !== '' ? parseInt(d.as) : null,
          played: d.played,
          game_date: d.date || null,
        };
        if (existing) return prev.map(g => g.series_number === sNum && g.game_number === gNum ? updated : g);
        return [...prev, updated];
      });
      setMsg({ ok: true, text: `✅ משחק G${gNum} בסדרה ${sNum} נשמר` });
    } else {
      setMsg({ ok: false, text: 'שגיאה בשמירה' });
    }
  }

  if (loading) return <p className="text-center text-gray-500 py-12">טוען...</p>;

  return (
    <div className="space-y-8">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-white">ניהול פלייאוף</h2>
        <p className="mt-1 text-sm text-gray-400">הגדר קבוצות ורשום תוצאות משחקים</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium text-right ${msg.ok ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {series.map((s) => {
        const { winsA, winsB } = seriesWins(s, games);
        const seriesOver = winsA >= 2 || winsB >= 2;

        return (
          <div key={s.series_number} className="rounded-2xl border border-gray-700 bg-gray-800/40 overflow-hidden">
            {/* Series header */}
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
              {/* Team names */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 text-right uppercase tracking-wider">קבוצות</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{s.team_a_label} (ביתי G1+G3)</label>
                    <input
                      value={teamDraft[s.series_number]?.a ?? ''}
                      onChange={e => setTeamDraft(p => ({ ...p, [s.series_number]: { ...p[s.series_number], a: e.target.value } }))}
                      placeholder="שם קבוצה..."
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">{s.team_b_label} (ביתי G2)</label>
                    <input
                      value={teamDraft[s.series_number]?.b ?? ''}
                      onChange={e => setTeamDraft(p => ({ ...p, [s.series_number]: { ...p[s.series_number], b: e.target.value } }))}
                      placeholder="שם קבוצה..."
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => saveTeams(s.series_number)}
                  disabled={saving === `team-${s.series_number}`}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 transition disabled:opacity-50"
                >
                  {saving === `team-${s.series_number}` ? 'שומר...' : 'שמור קבוצות'}
                </button>
              </div>

              {/* Games */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 text-right uppercase tracking-wider">תוצאות משחקים</p>
                {[1, 2, 3].map((gNum) => {
                  const d = getGD(s.series_number, gNum);
                  const homeTeam = s.team_a ? homeFor(s, gNum) : `ביתי (G${gNum})`;
                  const awayTeam = s.team_b ? awayFor(s, gNum) : `אורח (G${gNum})`;
                  const key = `game-${s.series_number}-${gNum}`;

                  return (
                    <div key={gNum} className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={d.played}
                            onChange={e => setGD(s.series_number, gNum, { played: e.target.checked })}
                            className="accent-orange-500"
                          />
                          <span className="text-gray-300">הוצג</span>
                        </label>
                        <span className="text-xs font-black text-orange-400">
                          G{gNum} {gNum === 3 ? '(אם נדרש)' : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-2">
                        <div className="text-right text-xs text-gray-300 truncate">{homeTeam}</div>
                        <input
                          type="number"
                          value={d.hs}
                          onChange={e => setGD(s.series_number, gNum, { hs: e.target.value })}
                          placeholder="0"
                          className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-center text-sm font-bold text-white focus:border-orange-500 focus:outline-none"
                        />
                        <span className="text-gray-600">–</span>
                        <input
                          type="number"
                          value={d.as}
                          onChange={e => setGD(s.series_number, gNum, { as: e.target.value })}
                          placeholder="0"
                          className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-center text-sm font-bold text-white focus:border-orange-500 focus:outline-none"
                        />
                        <div className="text-left text-xs text-gray-300 truncate">{awayTeam}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="date"
                          value={d.date}
                          onChange={e => setGD(s.series_number, gNum, { date: e.target.value })}
                          className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none [color-scheme:dark]"
                        />
                        <button
                          onClick={() => saveGame(s.series_number, gNum)}
                          disabled={saving === key}
                          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600 transition disabled:opacity-50"
                        >
                          {saving === key ? 'שומר...' : '✓ שמור'}
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
