import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlayerById, getPlayerGameStats } from '@/lib/supabase';
import type { GameStatWithGame, Position } from '@/types';
import VideoGallery from '@/components/player/VideoGallery';
import PlayerStatsChart from '@/components/player/PlayerStatsChart';

// ── Position metadata ─────────────────────────────────────────────────────────

const POSITION_META: Record<
  Position,
  { label: string; color: string; bg: string }
> = {
  PG: { label: 'Point Guard',     color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/30' },
  SG: { label: 'Shooting Guard',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  SF: { label: 'Small Forward',   color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/30' },
  PF: { label: 'Power Forward',   color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  C:  { label: 'Center',          color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(total: number, games: number): string {
  if (games === 0) return '—';
  return (total / games).toFixed(1);
}

function getOpponent(stat: GameStatWithGame, teamId: string) {
  const g = stat.game;
  return g.home_team_id === teamId ? g.away_team : g.home_team;
}

function getResult(stat: GameStatWithGame, teamId: string): 'W' | 'L' | 'D' | null {
  const { game } = stat;
  if (game.status !== 'Finished') return null;
  const isHome = game.home_team_id === teamId;
  const myScore = isHome ? game.home_score : game.away_score;
  const theirScore = isHome ? game.away_score : game.home_score;
  if (myScore > theirScore) return 'W';
  if (myScore < theirScore) return 'L';
  return 'D';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlayerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const [player, gameStats] = await Promise.all([
    getPlayerById(params.id),
    getPlayerGameStats(params.id),
  ]);

  if (!player) notFound();

  const gamesPlayed = gameStats.filter((s) => s.game.status === 'Finished').length;
  const totalPts   = gameStats.reduce((n, s) => n + s.points, 0);
  const total3pt   = gameStats.reduce((n, s) => n + s.three_pointers, 0);
  const totalFouls = gameStats.reduce((n, s) => n + s.fouls, 0);

  const posMeta = player.position ? POSITION_META[player.position] : null;

  // Videos: games this player participated in that have a video URL
  const videos = gameStats
    .filter((s) => s.game.video_url)
    .map((s) => ({
      url: s.game.video_url!,
      label: `vs ${getOpponent(s, player.team_id!).name}`,
      date: s.game.game_date,
    }));

  // Chart data (only finished games, chronological)
  const chartData = gameStats
    .filter((s) => s.game.status === 'Finished')
    .map((s, i) => ({
      game: `G${i + 1}`,
      opponent: getOpponent(s, player.team_id!).name,
      points: s.points,
      threePt: s.three_pointers,
      fouls: s.fouls,
    }));

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950">
        {/* Giant jersey number watermark */}
        {player.jersey_number !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none text-[10rem] font-black leading-none text-white/5 sm:text-[14rem]"
          >
            {player.jersey_number}
          </span>
        )}

        <div className="relative mx-auto flex max-w-4xl flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:gap-8">
          {/* Team logo */}
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-gray-700 bg-gray-800 sm:h-32 sm:w-32">
            {player.team?.logo_url ? (
              <Image
                src={player.team.logo_url}
                alt={player.team.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-4xl font-black text-gray-500">
                {player.team?.name?.charAt(0) ?? '?'}
              </span>
            )}
          </div>

          {/* Player info */}
          <div className="flex-1">
            {/* Back link */}
            <Link
              href="/players"
              className="mb-3 inline-block text-xs text-gray-500 hover:text-orange-400"
            >
              ← All Players
            </Link>

            {/* Badges row */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {player.jersey_number !== null && (
                <span className="rounded-lg border border-gray-700 px-3 py-0.5 text-sm font-bold text-orange-400">
                  #{player.jersey_number}
                </span>
              )}
              {posMeta && (
                <span
                  className={`rounded-lg border px-3 py-0.5 text-sm font-semibold ${posMeta.color} ${posMeta.bg}`}
                >
                  {posMeta.label}
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {player.name}
            </h1>

            {/* Team */}
            {player.team && (
              <p className="mt-1 text-sm text-gray-400">{player.team.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Page body ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">

        {/* ── Stats dashboard ──────────────────────────────────────────── */}
        <section>
          <SectionTitle>Season Averages</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="PPG"     value={avg(totalPts,   gamesPlayed)} sublabel="Points per game"     accent="orange" />
            <StatCard label="3PG"     value={avg(total3pt,   gamesPlayed)} sublabel="3-Pointers per game"  accent="sky" />
            <StatCard label="FPG"     value={avg(totalFouls, gamesPlayed)} sublabel="Fouls per game"        accent="rose" />
            <StatCard label="GP"      value={String(gamesPlayed)}          sublabel="Games played"          accent="emerald" />
          </div>

          {/* Season totals strip */}
          {gamesPlayed > 0 && (
            <div className="mt-3 flex divide-x divide-gray-800 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 text-center">
              {[
                { label: 'Total PTS', value: totalPts },
                { label: 'Total 3PT', value: total3pt },
                { label: 'Total FLS', value: totalFouls },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 py-3">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Performance chart ────────────────────────────────────────── */}
        {chartData.length > 0 && (
          <section>
            <SectionTitle>Performance Graph</SectionTitle>
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
              <PlayerStatsChart data={chartData} />
            </div>
          </section>
        )}

        {/* ── Game history table ───────────────────────────────────────── */}
        {gameStats.length > 0 && (
          <section>
            <SectionTitle>Game History</SectionTitle>
            <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Opponent</th>
                    <th className="px-4 py-3 text-center">Score</th>
                    <th className="px-4 py-3 text-center">Result</th>
                    <th className="px-4 py-3 text-center">PTS</th>
                    <th className="px-4 py-3 text-center">3PT</th>
                    <th className="px-4 py-3 text-center">FLS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {gameStats.map((stat) => {
                    const opp = getOpponent(stat, player.team_id!);
                    const result = getResult(stat, player.team_id!);
                    const isHome = stat.game.home_team_id === player.team_id;
                    const myScore = isHome ? stat.game.home_score : stat.game.away_score;
                    const theirScore = isHome ? stat.game.away_score : stat.game.home_score;
                    const dateStr = new Date(stat.game.game_date).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    });
                    return (
                      <tr key={stat.id} className="hover:bg-gray-800/50">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-400">{dateStr}</td>
                        <td className="px-4 py-3 font-medium">
                          <span className="text-gray-500 text-xs mr-1">{isHome ? 'vs' : '@'}</span>
                          {opp.name}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-gray-400">
                          {stat.game.status === 'Finished'
                            ? `${myScore}–${theirScore}`
                            : <span className="text-xs">{stat.game.status}</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {result ? (
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                              result === 'W' ? 'bg-green-900/60 text-green-400' :
                              result === 'L' ? 'bg-red-900/60 text-red-400' :
                                              'bg-gray-700 text-gray-400'
                            }`}>
                              {result}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-orange-400">{stat.points}</td>
                        <td className="px-4 py-3 text-center font-semibold text-sky-400">{stat.three_pointers}</td>
                        <td className="px-4 py-3 text-center text-rose-400">{stat.fouls}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── No games yet ─────────────────────────────────────────────── */}
        {gameStats.length === 0 && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 py-16 text-center text-gray-500">
            No game stats recorded yet for this player.
          </div>
        )}

        {/* ── Video gallery ────────────────────────────────────────────── */}
        {videos.length > 0 && (
          <section>
            <SectionTitle>Video Gallery</SectionTitle>
            <VideoGallery videos={videos} />
          </section>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
      <span className="h-4 w-1 rounded-full bg-orange-500" />
      {children}
    </h2>
  );
}

const ACCENT_CLASSES: Record<string, { number: string; bar: string }> = {
  orange:  { number: 'text-orange-400',  bar: 'bg-orange-500' },
  sky:     { number: 'text-sky-400',     bar: 'bg-sky-500' },
  rose:    { number: 'text-rose-400',    bar: 'bg-rose-500' },
  emerald: { number: 'text-emerald-400', bar: 'bg-emerald-500' },
};

function StatCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel: string;
  accent: string;
}) {
  const cls = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.orange;
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</p>
        <p className={`mt-1 text-4xl font-black tabular-nums ${cls.number}`}>{value}</p>
        <p className="mt-1 text-xs text-gray-600">{sublabel}</p>
      </div>
      <div className="mt-4 h-0.5 w-full rounded-full bg-gray-800">
        <div className={`h-0.5 w-1/3 rounded-full ${cls.bar}`} />
      </div>
    </div>
  );
}
