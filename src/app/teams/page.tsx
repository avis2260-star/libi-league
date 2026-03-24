export const dynamic = 'force-dynamic';

import { getTeams } from '@/lib/supabase';
import { NORTH_TABLE, SOUTH_TABLE } from '@/lib/league-data';
import { supabaseAdmin } from '@/lib/supabase-admin';

type StandingRow = { rank: number; name: string; wins: number; losses: number; diff: number; pts: number; division: string; games: number; pf: number; pa: number; techni: number; penalty: number };

async function getLiveStandings(): Promise<StandingRow[]> {
  try {
    const { data, error } = await supabaseAdmin.from('standings').select('*').order('rank');
    if (error || !data || data.length === 0) throw new Error('no data');
    return data as StandingRow[];
  } catch {
    return [...NORTH_TABLE.map(t => ({ ...t, division: 'North' })), ...SOUTH_TABLE.map(t => ({ ...t, division: 'South' }))];
  }
}

// Normalize: strip all quote/apostrophe variants for fuzzy matching
function normalize(s: string) {
  return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim();
}

function makeFind(standings: StandingRow[]) {
  return function findStats(name: string) {
    const normName = normalize(name ?? '');
    return standings.find((s) => {
      const normS = normalize(s.name);
      return s.name === name || normS === normName || normName.includes(normS) || normS.includes(normName);
    });
  };
}

function makeDivisionMap(standings: StandingRow[]): Record<string, 'צפון' | 'דרום'> {
  const map: Record<string, 'צפון' | 'דרום'> = {};
  for (const s of standings) {
    map[s.name] = s.division === 'North' ? 'צפון' : 'דרום';
  }
  return map;
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
    );
  }
  const letter = [...name].find((c) => c.trim()) ?? '?';
  return (
    <span className="flex h-full w-full items-center justify-center text-2xl font-black text-[#4a6a8a]">
      {letter}
    </span>
  );
}

// ── Team card ──────────────────────────────────────────────────────────────────
import Link from 'next/link';

function TeamCard({
  team, rank, stats, division,
}: {
  team: Awaited<ReturnType<typeof getTeams>>[number];
  rank?: number;
  stats?: StandingRow;
  division?: 'צפון' | 'דרום';
}) {

  const rankColor =
    rank === 1 ? '#e0c97a'
    : rank === 2 ? '#b0b8c8'
    : rank === 3 ? '#c87d3a'
    : '#4a6a8a';

  return (
    <Link href={`/teams/${team.id}/players`} className="group flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 transition hover:border-orange-500/30 hover:bg-orange-500/[0.04]">
      {/* Rank number */}
      {rank !== undefined && (
        <div className="flex shrink-0 items-center">
          <span className="text-lg font-black w-6 text-center" style={{ color: rankColor }}>
            {rank}
          </span>
        </div>
      )}

      {/* Avatar */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]">
        <Avatar name={team.name} logoUrl={team.logo_url} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-base font-bold text-white">{team.name}</p>
          {division && (
            <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
              division === 'צפון'
                ? 'bg-blue-500/15 text-blue-400'
                : 'bg-orange-500/15 text-orange-400'
            }`}>
              {division}
            </span>
          )}
        </div>

        {/* Captain */}
        {team.captain_name && team.captain_name !== 'TBD' && (
          <p className="mt-1 text-xs text-[#5a7a9a]">
            <span className="text-[#4a6a8a]">קפטן:</span>{' '}
            <span className="text-[#8aaac8]">{team.captain_name}</span>
          </p>
        )}

        {/* Contact */}
        {team.contact_info && (
          <p className="text-xs text-[#5a7a9a]">
            <span className="text-[#4a6a8a]">פרטי קשר:</span>{' '}
            <span className="text-[#8aaac8]">{team.contact_info}</span>
          </p>
        )}

        {/* Mini stats from standings */}
        {stats && (
          <div className="mt-2 flex gap-4 text-xs">
            <span className="text-green-400 font-semibold">{stats.wins}נ</span>
            <span className="text-red-400 font-semibold">{stats.losses}ה</span>
            <span dir="ltr" className={`font-semibold ${stats.diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.diff > 0 ? `+${stats.diff}` : stats.diff}
            </span>
            <span className="font-black text-orange-400">{stats.pts} נק׳</span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TeamsPage() {
  const [teams, standings] = await Promise.all([getTeams(), getLiveStandings()]);
  const findStats  = makeFind(standings);
  const DIVISION_MAP = makeDivisionMap(standings);

  function sortByRank(arr: typeof teams) {
    return [...arr].sort((a, b) => {
      const ra = findStats(a.name)?.rank ?? 999;
      const rb = findStats(b.name)?.rank ?? 999;
      return ra - rb;
    });
  }

  const northTeams = sortByRank(teams.filter((t) => {
    const s = findStats(t.name);
    return s && DIVISION_MAP[s.name] === 'צפון';
  }));
  const southTeams = sortByRank(teams.filter((t) => {
    const s = findStats(t.name);
    return s && DIVISION_MAP[s.name] === 'דרום';
  }));
  const otherTeams = teams.filter((t) => !findStats(t.name));

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-3xl font-black text-white">קבוצות</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">{teams.length} קבוצות · עונת 2025–2026</p>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] py-16 text-center">
          <p className="text-4xl mb-3">🏀</p>
          <p className="text-sm text-[#5a7a9a]">לא נמצאו קבוצות במסד הנתונים.</p>
          <p className="mt-1 text-xs text-[#3a5a7a]">הוסף קבוצות דרך לוח הניהול.</p>
        </div>
      ) : (
        <>
          {/* South district */}
          {southTeams.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-orange-400">
                <span className="h-2 w-2 rounded-full bg-orange-400" />
                מחוז דרום · {southTeams.length} קבוצות
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {southTeams.map((t) => {
                  const s = findStats(t.name);
                  return <TeamCard key={t.id} team={t} rank={s?.rank} stats={s} division={s ? DIVISION_MAP[s.name] : undefined} />;
                })}
              </div>
            </section>
          )}

          {/* North district */}
          {northTeams.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-blue-400">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                מחוז צפון · {northTeams.length} קבוצות
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {northTeams.map((t) => {
                  const s = findStats(t.name);
                  return <TeamCard key={t.id} team={t} rank={s?.rank} stats={s} division={s ? DIVISION_MAP[s.name] : undefined} />;
                })}
              </div>
            </section>
          )}

          {/* Other / unmatched */}
          {otherTeams.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[#8aaac8]">
                <span className="h-2 w-2 rounded-full bg-[#8aaac8]" />
                קבוצות נוספות
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {otherTeams.map((t) => <TeamCard key={t.id} team={t} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
