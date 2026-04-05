'use client';

import { useState, useMemo } from 'react';
import type { EnrichedPlayer, TeamOption } from './page';

const POSITIONS: Record<string, string> = {
  PG: 'פוינט גארד',
  SG: 'שוטינג גארד',
  SF: 'סמול פורוורד',
  PF: 'פאוור פורוורד',
  C:  'סנטר',
};

function Avatar({ name, photoUrl, size = 80 }: { name: string; photoUrl: string | null; size?: number }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('');
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-orange-500/30 to-orange-700/20 border border-orange-500/20 flex items-center justify-center font-black text-orange-400"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials}
    </div>
  );
}

function PlayerCard({ player }: { player: EnrichedPlayer }) {
  return (
    <div className="group relative rounded-2xl border border-white/[0.07] bg-[#0c1825] overflow-hidden transition-all hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(249,115,22,0.08)] hover:-translate-y-0.5">

      {/* Jersey number badge */}
      {player.jersey_number !== null && (
        <div className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/15 border border-orange-500/30 text-xs font-black text-orange-400">
          #{player.jersey_number}
        </div>
      )}

      {/* Team logo top-left */}
      {player.team?.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.team.logo_url}
          alt={player.team.name}
          className="absolute top-3 left-3 z-10 h-7 w-7 rounded-full object-contain opacity-70"
        />
      )}

      {/* Photo / avatar */}
      <div className="flex justify-center pt-8 pb-4 bg-gradient-to-b from-[#0f1e30] to-[#0c1825]">
        <Avatar name={player.name} photoUrl={player.photo_url} size={88} />
      </div>

      {/* Info */}
      <div className="px-4 pb-5 text-center space-y-1">
        <p className="font-black text-white text-base leading-tight">{player.name}</p>

        {player.team && (
          <p className="text-xs text-[#5a7a9a] font-medium">{player.team.name}</p>
        )}

        {player.position && (
          <span className="inline-block rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#5a7a9a]">
            {POSITIONS[player.position] ?? player.position}
          </span>
        )}

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
          {[
            { label: 'נק׳', value: player.points ?? 0 },
            { label: '3PT', value: player.three_pointers ?? 0 },
            { label: 'פאולים', value: player.fouls ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="py-2 text-center">
              <p className="text-sm font-black text-white">{value}</p>
              <p className="text-[9px] text-[#4a6a8a] font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlayersClient({
  players,
  teams,
}: {
  players: EnrichedPlayer[];
  teams: TeamOption[];
}) {
  const [search, setSearch]     = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [sortBy, setSortBy]     = useState<'name' | 'points' | 'jersey'>('name');

  const filtered = useMemo(() => {
    let list = [...players];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }

    if (teamFilter) {
      list = list.filter(p => p.team_id === teamFilter);
    }

    list.sort((a, b) => {
      if (sortBy === 'points') return (b.points ?? 0) - (a.points ?? 0);
      if (sortBy === 'jersey') return (a.jersey_number ?? 99) - (b.jersey_number ?? 99);
      return a.name.localeCompare(b.name, 'he');
    });

    return list;
  }, [players, search, teamFilter, sortBy]);

  return (
    <div dir="rtl" className="space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white">כרטיסי שחקן</h1>
          <p className="text-sm text-[#5a7a9a] mt-0.5">{filtered.length} שחקנים פעילים</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a5a7a] text-sm">🔍</span>
          <input
            type="text"
            placeholder="חיפוש שם שחקן..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 pr-9 text-sm text-white placeholder:text-[#3a5a7a] focus:border-orange-500/40 focus:outline-none"
          />
        </div>

        {/* Team filter */}
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className="rounded-xl border border-white/[0.08] bg-[#0c1825] px-3 py-2 text-sm text-[#8aaac8] focus:border-orange-500/40 focus:outline-none"
        >
          <option value="">כל הקבוצות</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-xl border border-white/[0.08] bg-[#0c1825] px-3 py-2 text-sm text-[#8aaac8] focus:border-orange-500/40 focus:outline-none"
        >
          <option value="name">מיין: שם</option>
          <option value="points">מיין: נקודות</option>
          <option value="jersey">מיין: מספר חולצה</option>
        </select>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
          <p className="text-4xl mb-3">🏀</p>
          <p className="text-[#5a7a9a]">לא נמצאו שחקנים</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(p => (
            <PlayerCard key={p.id} player={p} />
          ))}
        </div>
      )}
    </div>
  );
}
