'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
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

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function PlayerCard({ player }: { player: EnrichedPlayer }) {
  const inactive = !player.is_active;

  return (
    <Link
      href={`/players/${player.id}`}
      className={`group relative block rounded-2xl border overflow-hidden transition-all hover:-translate-y-0.5 cursor-pointer ${
      inactive
        ? 'border-white/[0.04] bg-[#0a1520] opacity-60 hover:opacity-80'
        : 'border-white/[0.07] bg-[#0c1825] hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(249,115,22,0.08)]'
    }`}>

      {/* Active / Inactive badge */}
      <div className={`absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
        inactive
          ? 'bg-white/[0.04] border-white/[0.08] text-[#4a6a8a]'
          : 'bg-green-500/10 border-green-500/20 text-green-400'
      }`}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${inactive ? 'bg-[#4a6a8a]' : 'bg-green-400'}`} />
        {inactive ? 'לא פעיל' : 'פעיל'}
      </div>

      {/* Jersey number badge */}
      {player.jersey_number !== null && (
        <div className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/15 border border-orange-500/30 text-xs font-black text-orange-400">
          #{player.jersey_number}
        </div>
      )}

      {/* Photo / avatar */}
      <div className={`flex justify-center pt-8 pb-4 bg-gradient-to-b ${inactive ? 'from-[#0c1520] to-[#0a1520]' : 'from-[#0f1e30] to-[#0c1825]'}`}>
        <Avatar name={player.name} photoUrl={player.photo_url} size={88} />
      </div>

      {/* Info */}
      <div className="px-4 pb-5 text-center space-y-1">
        <p className="font-black text-white text-base leading-tight">{player.name}</p>

        {player.team && (
          <p className="text-xs text-[#5a7a9a] font-medium">{player.team.name}</p>
        )}

        {(() => {
          const age = calcAge(player.date_of_birth);
          return age !== null ? (
            <p className="text-[11px] text-[#5a7a9a] font-medium">גיל: {age}</p>
          ) : null;
        })()}

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
    </Link>
  );
}

type ActiveFilter = 'all' | 'active' | 'inactive';
type ViewMode = 'teams' | 'players';

/* ── Team List View ─────────────────────────────────────────────────────────── */
function TeamListView({
  players,
  teams,
  onSelectTeam,
}: {
  players: EnrichedPlayer[];
  teams: TeamOption[];
  onSelectTeam: (teamId: string) => void;
}) {
  const [sortBy, setSortBy] = useState<'name' | 'count'>('name');

  const teamStats = useMemo(() => {
    return teams.map(team => {
      const teamPlayers = players.filter(p => p.team_id === team.id);
      const active = teamPlayers.filter(p => p.is_active).length;
      const totalPts = teamPlayers.reduce((sum, p) => sum + (p.points ?? 0), 0);
      return { team, total: teamPlayers.length, active, totalPts };
    }).filter(ts => ts.total > 0);
  }, [players, teams]);

  const sorted = useMemo(() => {
    return [...teamStats].sort((a, b) => {
      if (sortBy === 'count') return b.total - a.total;
      return a.team.name.localeCompare(b.team.name, 'he');
    });
  }, [teamStats, sortBy]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white">כרטיסי שחקן</h1>
          <p className="text-sm text-[#5a7a9a] mt-0.5">{sorted.length} קבוצות · {players.filter(p => p.is_active).length} שחקנים פעילים</p>
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-xl border border-white/[0.08] bg-[#0c1825] px-3 py-2 text-sm text-[#8aaac8] focus:border-orange-500/40 focus:outline-none"
        >
          <option value="name">מיין: שם</option>
          <option value="count">מיין: מספר שחקנים</option>
        </select>
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sorted.map(({ team, total, active, totalPts }) => (
          <button
            key={team.id}
            onClick={() => onSelectTeam(team.id)}
            className="group text-right rounded-2xl border border-white/[0.07] bg-[#0c1825] hover:border-orange-500/30 hover:shadow-[0_0_24px_rgba(249,115,22,0.08)] transition-all p-4 flex items-center gap-4"
          >
            {/* Team logo placeholder */}
            <div className="h-12 w-12 shrink-0 rounded-full bg-[#0f1e30] border-2 border-white/10 flex items-center justify-center text-lg font-black text-[#3a5a7a]">
              {[...team.name].find(c => /\S/.test(c)) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm truncate group-hover:text-orange-400 transition-colors">{team.name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] text-green-400">{active} פעילים</span>
                {total > active && (
                  <span className="text-[11px] text-[#4a6a8a]">{total - active} לא פעילים</span>
                )}
                {totalPts > 0 && (
                  <span className="text-[11px] text-orange-400">{totalPts} נק׳</span>
                )}
              </div>
            </div>
            <span className="shrink-0 text-[#3a5a7a] group-hover:text-orange-400 transition-colors text-lg">←</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Player Grid View ───────────────────────────────────────────────────────── */
function PlayerGridView({
  players,
  teams,
  initialTeamId,
  onBack,
}: {
  players: EnrichedPlayer[];
  teams: TeamOption[];
  initialTeamId: string;
  onBack: () => void;
}) {
  const [search, setSearch]           = useState('');
  const [teamFilter, setTeamFilter]   = useState(initialTeamId);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [sortBy, setSortBy]           = useState<'name' | 'points' | 'jersey'>('name');

  const activeCount   = players.filter(p => p.is_active).length;
  const inactiveCount = players.filter(p => !p.is_active).length;

  const selectedTeamName = teams.find(t => t.id === teamFilter)?.name ?? '';

  const filtered = useMemo(() => {
    let list = [...players];

    if (activeFilter === 'active')   list = list.filter(p => p.is_active);
    if (activeFilter === 'inactive') list = list.filter(p => !p.is_active);

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
  }, [players, search, teamFilter, activeFilter, sortBy]);

  return (
    <div dir="rtl" className="space-y-6">

      {/* Header with back button */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[#5a7a9a] hover:text-orange-400 transition-colors mb-2"
          >
            → חזרה לרשימת קבוצות
          </button>
          <h1 className="text-2xl font-black text-white">
            {selectedTeamName || 'כרטיסי שחקן'}
          </h1>
          <p className="text-sm text-[#5a7a9a] mt-0.5">
            {filtered.length} שחקנים
            {activeFilter === 'all' && ` · ${activeCount} פעילים, ${inactiveCount} לא פעילים`}
          </p>
        </div>
      </div>

      {/* Active status toggle pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'active',   label: '🟢 פעילים',    count: players.filter(p => p.is_active && (!teamFilter || p.team_id === teamFilter)).length   },
          { key: 'inactive', label: '⚫ לא פעילים', count: players.filter(p => !p.is_active && (!teamFilter || p.team_id === teamFilter)).length },
          { key: 'all',      label: 'הכל',           count: players.filter(p => !teamFilter || p.team_id === teamFilter).length },
        ] as { key: ActiveFilter; label: string; count: number }[]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all flex items-center gap-2 ${
              activeFilter === key
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'border border-white/10 bg-white/5 text-[#8aaac8] hover:border-white/20 hover:text-white'
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${activeFilter === key ? 'bg-white/20' : 'bg-white/10'}`}>
              {count}
            </span>
          </button>
        ))}
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

/* ── Main export ────────────────────────────────────────────────────────────── */
export default function PlayersClient({
  players,
  teams,
}: {
  players: EnrichedPlayer[];
  teams: TeamOption[];
}) {
  const [view, setView] = useState<ViewMode>('teams');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  function handleSelectTeam(teamId: string) {
    setSelectedTeamId(teamId);
    setView('players');
  }

  function handleBack() {
    setView('teams');
    setSelectedTeamId('');
  }

  if (view === 'players') {
    return (
      <PlayerGridView
        players={players}
        teams={teams}
        initialTeamId={selectedTeamId}
        onBack={handleBack}
      />
    );
  }

  return (
    <div dir="rtl">
      <TeamListView
        players={players}
        teams={teams}
        onSelectTeam={handleSelectTeam}
      />
    </div>
  );
}
