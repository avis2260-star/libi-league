import Image from 'next/image';
import Link from 'next/link';
import { getAllPlayers } from '@/lib/supabase';
import type { Position } from '@/types';

export const dynamic = 'force-dynamic';

const POSITION_LABELS: Record<Position, string> = {
  PG: 'Point Guard',
  SG: 'Shooting Guard',
  SF: 'Small Forward',
  PF: 'Power Forward',
  C:  'Center',
};

const POSITION_COLORS: Record<Position, string> = {
  PG: 'text-sky-400    bg-sky-500/10    border-sky-500/20',
  SG: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  SF: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  PF: 'text-amber-400  bg-amber-500/10  border-amber-500/20',
  C:  'text-rose-400   bg-rose-500/10   border-rose-500/20',
};

export default async function PlayersPage() {
  const players = await getAllPlayers();

  // Group by team
  const byTeam = players.reduce<Record<string, typeof players>>((acc, p) => {
    const key = p.team?.name ?? 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Players</h1>
      <p className="mb-8 text-sm text-gray-400">
        {players.length} players across {Object.keys(byTeam).length} teams
      </p>

      {Object.keys(byTeam).length === 0 && (
        <p className="text-gray-500">No players found.</p>
      )}

      <div className="space-y-10">
        {Object.entries(byTeam).map(([teamName, teamPlayers]) => {
          const teamLogo = teamPlayers[0]?.team?.logo_url;
          return (
            <section key={teamName}>
              {/* Team header */}
              <div className="mb-4 flex items-center gap-3">
                {teamLogo ? (
                  <Image
                    src={teamLogo}
                    alt={teamName}
                    width={32}
                    height={32}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-500">
                    {teamName.charAt(0)}
                  </span>
                )}
                <h2 className="text-xl font-bold">{teamName}</h2>
                <span className="text-sm text-gray-400">({teamPlayers.length})</span>
              </div>

              {/* Players grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teamPlayers.map((player) => (
                  <Link
                    key={player.id}
                    href={`/players/${player.id}`}
                    className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-orange-300 hover:shadow-md"
                  >
                    {/* Jersey number circle */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-black text-gray-700">
                      {player.jersey_number !== null ? `#${player.jersey_number}` : '—'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900 group-hover:text-orange-500">
                        {player.name}
                      </p>
                      {player.position && (
                        <span
                          className={`mt-1 inline-block rounded border px-2 py-0.5 text-xs font-medium ${POSITION_COLORS[player.position]}`}
                        >
                          {POSITION_LABELS[player.position]}
                        </span>
                      )}
                    </div>

                    <span className="text-gray-300 transition group-hover:text-orange-400">→</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
