'use client';

import { useState, useMemo, useTransition, Fragment } from 'react';
import { updatePlayerStats } from '@/app/admin/actions';

export type PlayerStatRow = {
  id: string;
  name: string;
  jersey_number: number | null;
  team_name: string | null;
  points: number;
  three_pointers: number;
  fouls: number;
};

function Row({ p }: { p: PlayerStatRow }) {
  const [points,   setPoints]   = useState(String(p.points));
  const [threePt,  setThreePt]  = useState(String(p.three_pointers));
  const [fouls,    setFouls]    = useState(String(p.fouls));
  const [msg,      setMsg]      = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    points  !== String(p.points) ||
    threePt !== String(p.three_pointers) ||
    fouls   !== String(p.fouls);

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updatePlayerStats(
        p.id,
        parseInt(points  || '0', 10),
        parseInt(threePt || '0', 10),
        parseInt(fouls   || '0', 10),
      );
      if (res.error) setMsg({ ok: false, text: res.error });
      else           setMsg({ ok: true,  text: '✓ נשמר' });
    });
  }

  function reset() {
    setPoints(String(p.points));
    setThreePt(String(p.three_pointers));
    setFouls(String(p.fouls));
    setMsg(null);
  }

  return (
    <tr className="border-b border-white/[0.05] hover:bg-white/[0.02]">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{p.name}</span>
          {p.jersey_number !== null && (
            <span className="text-[10px] font-bold text-orange-400/70">#{p.jersey_number}</span>
          )}
        </div>
        {p.team_name && <p className="text-[10px] text-[#5a7a9a]">{p.team_name}</p>}
      </td>

      <td className="px-2 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={points}
          onChange={e => setPoints(e.target.value.replace(/[^0-9]/g, ''))}
          className="w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-sm text-white focus:outline-none focus:border-orange-500/50"
        />
      </td>

      <td className="px-2 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={threePt}
          onChange={e => setThreePt(e.target.value.replace(/[^0-9]/g, ''))}
          className="w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-sm text-white focus:outline-none focus:border-orange-500/50"
        />
      </td>

      <td className="px-2 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={fouls}
          onChange={e => setFouls(e.target.value.replace(/[^0-9]/g, ''))}
          className="w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-sm text-white focus:outline-none focus:border-orange-500/50"
        />
      </td>

      <td className="px-2 py-2 whitespace-nowrap">
        <button
          onClick={save}
          disabled={!dirty || isPending}
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-all"
        >
          {isPending ? '...' : 'שמור'}
        </button>
        {dirty && !isPending && (
          <button
            onClick={reset}
            className="ml-1 text-[#5a7a9a] hover:text-white text-xs px-2 transition-colors"
          >
            ↺
          </button>
        )}
        {msg && (
          <span className={`mr-2 text-[10px] font-bold ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </td>
    </tr>
  );
}

export default function PlayerStatsTab({ players }: { players: PlayerStatRow[] }) {
  const [search,    setSearch]    = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [sort,      setSort]      = useState<'name' | 'points' | 'team'>('points');

  const teams = useMemo(
    () => [...new Set(players.map(p => p.team_name).filter(Boolean))] as string[],
    [players],
  );

  const visible = useMemo(() => {
    let list = [...players];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (teamFilter) list = list.filter(p => p.team_name === teamFilter);
    list.sort((a, b) => {
      const t = (a.team_name ?? 'זזז').localeCompare(b.team_name ?? 'זזז', 'he');
      if (t !== 0) return t;
      if (sort === 'points') return b.points - a.points;
      if (sort === 'team')   return a.name.localeCompare(b.name, 'he');
      return a.name.localeCompare(b.name, 'he');
    });
    return list;
  }, [players, search, teamFilter, sort]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlayerStatRow[]>();
    for (const p of visible) {
      const key = p.team_name ?? 'ללא קבוצה';
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [visible]);

  return (
    <div dir="rtl" className="space-y-4 p-4">
      <div>
        <h2 className="text-xl font-black text-white">📊 עריכת סטטיסטיקת שחקנים</h2>
        <p className="text-sm text-[#5a7a9a] mt-0.5">
          שינוי ידני של נקודות, 3 נקודות ועבירות לכל שחקן.
          שינויים כאן דורסים את הנתונים שנצברו מהגשות.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="חיפוש שם שחקן..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white placeholder:text-[#3a5a7a] focus:border-orange-500/40 focus:outline-none"
        />
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0c1825] px-3 py-2 text-sm text-[#8aaac8] focus:border-orange-500/40 focus:outline-none"
        >
          <option value="">כל הקבוצות</option>
          {teams.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          className="rounded-xl border border-white/10 bg-[#0c1825] px-3 py-2 text-sm text-[#8aaac8] focus:border-orange-500/40 focus:outline-none"
        >
          <option value="points">מיין: נקודות</option>
          <option value="name">מיין: שם</option>
          <option value="team">מיין: קבוצה</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-[11px] font-bold uppercase tracking-wide text-[#5a7a9a]">
            <tr>
              <th className="px-3 py-2 text-right">שחקן</th>
              <th className="px-2 py-2 text-center">נק׳</th>
              <th className="px-2 py-2 text-center">3נק׳</th>
              <th className="px-2 py-2 text-center">פאולים</th>
              <th className="px-2 py-2 text-right">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[#5a7a9a]">
                  לא נמצאו שחקנים
                </td>
              </tr>
            ) : (
              grouped.map(([teamName, rows]) => (
                <Fragment key={teamName}>
                  <tr className="bg-orange-500/10 border-y border-orange-500/20">
                    <td colSpan={5} className="px-3 py-2 text-right text-[11px] font-black text-orange-400 uppercase tracking-wide">
                      🛡️ {teamName} <span className="text-[#5a7a9a] font-bold">({rows.length})</span>
                    </td>
                  </tr>
                  {rows.map(p => <Row key={p.id} p={p} />)}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[#5a7a9a]">
        מציג {visible.length} מתוך {players.length} שחקנים
      </p>
    </div>
  );
}
