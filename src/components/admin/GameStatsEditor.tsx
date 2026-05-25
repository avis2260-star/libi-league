'use client';

import { useMemo, useState, useTransition } from 'react';

export type RosterPlayer = { id: string; name: string; jersey_number: number | null };
export type StatValues = { points: number; three_pointers: number; fouls: number };

type SaveResult = { error?: string };

// ── Single editable player row ─────────────────────────────────────────────
function PlayerRow({
  player, existing, onSave, onLivePoints,
}: {
  player: RosterPlayer;
  existing: StatValues | undefined;
  onSave: (playerId: string, values: StatValues) => Promise<SaveResult>;
  onLivePoints: (playerId: string, points: number) => void;
}) {
  const init = existing ?? { points: 0, three_pointers: 0, fouls: 0 };
  const [points,  setPoints]  = useState(String(init.points));
  const [threePt, setThreePt] = useState(String(init.three_pointers));
  const [fouls,   setFouls]   = useState(String(init.fouls));
  const [saved,   setSaved]   = useState(init);
  const [msg,     setMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    points  !== String(saved.points) ||
    threePt !== String(saved.three_pointers) ||
    fouls   !== String(saved.fouls);

  function save() {
    setMsg(null);
    const next = {
      points:         parseInt(points  || '0', 10),
      three_pointers: parseInt(threePt || '0', 10),
      fouls:          parseInt(fouls   || '0', 10),
    };
    startTransition(async () => {
      const res = await onSave(player.id, next);
      if (res.error) {
        setMsg({ ok: false, text: res.error });
      } else {
        setMsg({ ok: true, text: '✓' });
        setSaved(next);
        onLivePoints(player.id, next.points);
      }
    });
  }

  return (
    <tr className="border-b border-white/[0.05] hover:bg-white/[0.02]">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{player.name}</span>
          {player.jersey_number !== null && (
            <span className="text-[10px] font-bold text-orange-400/70">#{player.jersey_number}</span>
          )}
        </div>
      </td>
      {[
        { v: points,  set: setPoints },
        { v: threePt, set: setThreePt },
        { v: fouls,   set: setFouls },
      ].map((f, i) => (
        <td key={i} className="px-2 py-2">
          <input
            type="text"
            inputMode="numeric"
            value={f.v}
            onChange={e => f.set(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-14 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-sm text-white focus:outline-none focus:border-orange-500/50"
          />
        </td>
      ))}
      <td className="px-2 py-2 whitespace-nowrap">
        <button
          onClick={save}
          disabled={!dirty || pending}
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold py-1 px-3 rounded-lg transition-all"
        >
          {pending ? '...' : 'שמור'}
        </button>
        {msg && (
          <span className={`mr-2 text-[10px] font-bold ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Roster table (one team) ────────────────────────────────────────────────
function RosterTable({
  teamName, players, statsByPlayer, onSave, onLivePoints,
}: {
  teamName: string;
  players: RosterPlayer[];
  statsByPlayer: Record<string, StatValues>;
  onSave: (playerId: string, values: StatValues) => Promise<SaveResult>;
  onLivePoints: (playerId: string, points: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
      <div className="px-3 py-2 bg-orange-500/[0.06] border-b border-white/[0.06]">
        <p className="text-sm font-black text-white">🛡️ {teamName || '—'}</p>
      </div>
      {players.length === 0 ? (
        <p className="text-xs text-[#5a7a9a] text-center py-6">לא נמצאו שחקנים לקבוצה</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-[#5a7a9a]">
              <tr>
                <th className="px-3 py-2 text-right">שחקן</th>
                <th className="px-2 py-2 text-center">נק׳</th>
                <th className="px-2 py-2 text-center">3נק׳</th>
                <th className="px-2 py-2 text-center">פאולים</th>
                <th className="px-2 py-2 text-right">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  existing={statsByPlayer[p.id]}
                  onSave={onSave}
                  onLivePoints={onLivePoints}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Quarter score editor ───────────────────────────────────────────────────
function QuarterEditor({
  homeTeamName, awayTeamName, initialHome, initialAway, onSave,
}: {
  homeTeamName: string;
  awayTeamName: string;
  initialHome: number[] | null;
  initialAway: number[] | null;
  onSave: (home: number[] | null, away: number[] | null) => Promise<SaveResult>;
}) {
  // Periods = max(4, existing length). Both sides share the same count.
  const initialCount = Math.max(4, initialHome?.length ?? 0, initialAway?.length ?? 0);
  const pad = (arr: number[] | null, n: number) =>
    Array.from({ length: n }, (_, i) => (arr?.[i] != null ? String(arr[i]) : ''));

  const [count, setCount] = useState(initialCount);
  const [home, setHome]   = useState<string[]>(() => pad(initialHome, initialCount));
  const [away, setAway]   = useState<string[]>(() => pad(initialAway, initialCount));
  const [msg, setMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function setCell(side: 'home' | 'away', idx: number, val: string) {
    const v = val.replace(/[^0-9]/g, '');
    (side === 'home' ? setHome : setAway)(prev => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
  }

  function addPeriod() {
    setCount(c => c + 1);
    setHome(p => [...p, '']);
    setAway(p => [...p, '']);
  }
  function removePeriod() {
    if (count <= 4) return;
    setCount(c => c - 1);
    setHome(p => p.slice(0, -1));
    setAway(p => p.slice(0, -1));
  }

  const homeSum = home.reduce((s, v) => s + (parseInt(v || '0', 10) || 0), 0);
  const awaySum = away.reduce((s, v) => s + (parseInt(v || '0', 10) || 0), 0);

  function toArr(strs: string[]): number[] | null {
    const allEmpty = strs.every(s => s.trim() === '');
    if (allEmpty) return null;
    return strs.map(s => parseInt(s || '0', 10) || 0);
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await onSave(toArr(home), toArr(away));
      setMsg(res.error ? { ok: false, text: res.error } : { ok: true, text: '✓ נשמר' });
    });
  }

  const label = (i: number) => (i < 4 ? `רבע ${i + 1}` : `הארכה ${i - 3}`);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wide text-[#8aaac8]">🕐 ניקוד לפי רבעים</p>
        <div className="flex items-center gap-2">
          <button onClick={removePeriod} disabled={count <= 4}
            className="rounded border border-white/10 px-2 py-0.5 text-xs text-[#8aaac8] hover:text-white disabled:opacity-30">−</button>
          <span className="text-[10px] text-[#5a7a9a]">{count} מקטעים</span>
          <button onClick={addPeriod}
            className="rounded border border-white/10 px-2 py-0.5 text-xs text-[#8aaac8] hover:text-white">+ הארכה</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-bold uppercase tracking-wide text-[#5a7a9a]">
            <tr>
              <th className="px-2 py-1 text-right">קבוצה</th>
              {Array.from({ length: count }, (_, i) => (
                <th key={i} className="px-1 py-1 text-center">{label(i)}</th>
              ))}
              <th className="px-2 py-1 text-center">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {([['home', homeTeamName, home, homeSum], ['away', awayTeamName, away, awaySum]] as const).map(
              ([side, name, vals, sum]) => (
                <tr key={side} className="border-t border-white/[0.05]">
                  <td className="px-2 py-1.5 font-bold text-white text-xs truncate max-w-[120px]">{name || '—'}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="px-1 py-1.5 text-center">
                      <input
                        type="text" inputMode="numeric" value={v}
                        onChange={e => setCell(side, i, e.target.value)}
                        className="w-11 rounded border border-white/10 bg-white/[0.03] px-1 py-1 text-center text-sm text-white focus:outline-none focus:border-orange-500/50"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-black text-orange-400 tabular-nums">{sum}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-400 disabled:opacity-40 transition"
        >
          {pending ? 'שומר...' : 'שמור רבעים'}
        </button>
        {msg && (
          <span className={`text-xs font-bold ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}

// ── Tab root: the full per-game editor ─────────────────────────────────────
export default function GameStatsEditor({
  homeTeamName,
  awayTeamName,
  homePlayers,
  awayPlayers,
  homeScore,
  awayScore,
  initialStats,
  initialHomeQuarters,
  initialAwayQuarters,
  onSavePlayer,
  onSaveQuarters,
}: {
  homeTeamName: string;
  awayTeamName: string;
  homePlayers: RosterPlayer[];
  awayPlayers: RosterPlayer[];
  homeScore: number | null;
  awayScore: number | null;
  initialStats: Record<string, StatValues>;
  initialHomeQuarters: number[] | null;
  initialAwayQuarters: number[] | null;
  onSavePlayer: (playerId: string, values: StatValues) => Promise<SaveResult>;
  onSaveQuarters: (home: number[] | null, away: number[] | null) => Promise<SaveResult>;
}) {
  const [livePoints, setLivePoints] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const p of [...homePlayers, ...awayPlayers]) m[p.id] = initialStats[p.id]?.points ?? 0;
    return m;
  });

  const handleLive = (playerId: string, points: number) =>
    setLivePoints(prev => ({ ...prev, [playerId]: points }));

  const homeTotal = useMemo(() => homePlayers.reduce((s, p) => s + (livePoints[p.id] ?? 0), 0), [homePlayers, livePoints]);
  const awayTotal = useMemo(() => awayPlayers.reduce((s, p) => s + (livePoints[p.id] ?? 0), 0), [awayPlayers, livePoints]);

  const hasOfficial = homeScore != null && awayScore != null;
  const homeMatch = homeScore != null ? homeTotal === homeScore : null;
  const awayMatch = awayScore != null ? awayTotal === awayScore : null;
  const allMatch = homeMatch === true && awayMatch === true;

  return (
    <div className="space-y-3" dir="rtl">
      <QuarterEditor
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        initialHome={initialHomeQuarters}
        initialAway={initialAwayQuarters}
        onSave={onSaveQuarters}
      />

      {/* Player points summary vs official score */}
      <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.03] px-3 py-3 space-y-1.5">
        <div className="flex items-center justify-center gap-3 text-base font-black">
          <span className="truncate text-white">{homeTeamName || '—'}</span>
          <span className={`text-2xl tabular-nums ${homeMatch === false ? 'text-red-400' : 'text-orange-400'}`}>{homeTotal}</span>
          <span className="text-[#5a7a9a]">:</span>
          <span className={`text-2xl tabular-nums ${awayMatch === false ? 'text-red-400' : 'text-orange-400'}`}>{awayTotal}</span>
          <span className="truncate text-white">{awayTeamName || '—'}</span>
        </div>
        {hasOfficial ? (
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold">
            <span className="text-[#8aaac8]">תוצאה רשמית:</span>
            <span className="text-[#c8d8e8] tabular-nums">{homeScore} : {awayScore}</span>
            <span className={allMatch ? 'text-green-400' : 'text-red-400'}>{allMatch ? '✓ תואם' : '✗ לא תואם'}</span>
          </div>
        ) : (
          <p className="text-center text-[11px] font-bold text-[#5a7a9a]">סכום נקודות השחקנים מתעדכן עם כל שמירה</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <RosterTable teamName={homeTeamName} players={homePlayers} statsByPlayer={initialStats} onSave={onSavePlayer} onLivePoints={handleLive} />
        <RosterTable teamName={awayTeamName} players={awayPlayers} statsByPlayer={initialStats} onSave={onSavePlayer} onLivePoints={handleLive} />
      </div>
    </div>
  );
}
