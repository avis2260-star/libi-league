// ── LastRoundResults — server component shown on the home page ────────────
// Displays the most recently completed round of league games. Reads
// `game_results` from Supabase, picks the highest-numbered round, and
// renders the games grouped by division with the same dark-blue card
// style used elsewhere on the site.

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeams } from '@/lib/supabase';

type ResultRow = {
  round: number;
  date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  techni: boolean;
  division: 'North' | 'South' | string | null;
};

function norm(s: string) {
  return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim();
}
function lcNorm(s: string) {
  return norm(s).toLowerCase();
}
function findLogo(name: string, logos: Record<string, string | null>): string | null {
  return (
    logos[norm(name)] ??
    Object.entries(logos).find(([k]) => lcNorm(k) === lcNorm(name))?.[1] ??
    null
  );
}

const isTechniScore = (sh: number, sa: number) =>
  (sh === 20 && sa === 0) || (sh === 0 && sa === 20);

// ── Team logo bubble (same look as ResultsContent) ───────────────────────
function TeamLogo({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover shadow-sm"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#1a2e45] text-[10px] font-black text-[#3a5a7a]">
      {[...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

// ── Single-game card ─────────────────────────────────────────────────────
function GameCard({
  game,
  logos,
}: {
  game: ResultRow;
  logos: Record<string, string | null>;
}) {
  const homeWins     = game.home_score > game.away_score;
  const techni       = !!game.techni || isTechniScore(game.home_score, game.away_score);
  const techniOnHome = techni && !homeWins;
  const techniOnAway = techni && homeWins;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-orange-500/30">
      {/* Home */}
      <Link
        href={`/team/${encodeURIComponent(game.home_team)}`}
        className="group flex min-w-0 items-center justify-end gap-2"
      >
        <TeamLogo name={game.home_team} url={findLogo(game.home_team, logos)} />
        <div className="min-w-0 text-right">
          <p
            className={`truncate text-sm font-bold leading-tight transition-colors group-hover:text-orange-400 font-heading ${
              homeWins ? 'text-white' : 'text-[#8aaac8]'
            }`}
          >
            {game.home_team}
          </p>
          {techniOnHome && (
            <p className="mt-0.5 text-[10px] font-black text-red-400">🔴 הפסד טכני</p>
          )}
        </div>
      </Link>

      {/* Score */}
      <div className="min-w-[72px] shrink-0 rounded-lg bg-black/40 px-2.5 py-2 text-center">
        <div className="flex items-center justify-center gap-1.5" dir="ltr">
          <span
            className={`font-stats text-2xl font-black tabular-nums ${
              homeWins ? 'text-orange-400' : 'text-[#8aaac8]'
            }`}
          >
            {game.home_score}
          </span>
          <span className="font-stats text-lg font-black text-[#8aaac8]">:</span>
          <span
            className={`font-stats text-2xl font-black tabular-nums ${
              !homeWins ? 'text-orange-400' : 'text-[#8aaac8]'
            }`}
          >
            {game.away_score}
          </span>
        </div>
        {techni && (
          <p className="mt-0.5 text-[8px] font-bold tracking-wide text-red-400">טכני *</p>
        )}
      </div>

      {/* Away */}
      <Link
        href={`/team/${encodeURIComponent(game.away_team)}`}
        className="group flex min-w-0 items-center justify-start gap-2"
      >
        <div className="min-w-0 text-left">
          <p
            className={`truncate text-sm font-bold leading-tight transition-colors group-hover:text-orange-400 font-heading ${
              !homeWins ? 'text-white' : 'text-[#8aaac8]'
            }`}
          >
            {game.away_team}
          </p>
          {techniOnAway && (
            <p className="mt-0.5 text-[10px] font-black text-red-400">🔴 הפסד טכני</p>
          )}
        </div>
        <TeamLogo name={game.away_team} url={findLogo(game.away_team, logos)} />
      </Link>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────
export default async function LastRoundResults() {
  const [{ data: results }, teams] = await Promise.all([
    supabaseAdmin
      .from('game_results')
      .select('round,date,home_team,away_team,home_score,away_score,techni,division')
      .order('round', { ascending: false }),
    getTeams(),
  ]);

  const games = (results ?? []) as ResultRow[];
  if (games.length === 0) return null;

  const lastRound = games[0].round;
  const roundGames = games.filter(g => g.round === lastRound);

  // Group by division — fall back to a single bucket if division is missing
  const south = roundGames.filter(g => g.division === 'South');
  const north = roundGames.filter(g => g.division === 'North');
  const other = roundGames.filter(g => g.division !== 'South' && g.division !== 'North');

  // Logo lookup
  const logos: Record<string, string | null> = {};
  for (const t of teams) logos[norm(t.name)] = t.logo_url;

  const date = roundGames[0]?.date ?? '';

  return (
    <section dir="rtl">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-white font-heading">
          <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">
            ✅
          </span>
          תוצאות מחזור {lastRound}
        </h2>
        {date && <span className="text-sm font-bold text-[#8aaac8]">· {date}</span>}
        <Link
          href="/results"
          className="ms-auto text-sm font-bold text-[#8aaac8] transition-colors hover:text-orange-400"
        >
          כל התוצאות ←
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {south.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400">
              <span className="h-2 w-2 rounded-full bg-orange-400" /> מחוז דרום
            </h3>
            {south.map((g, i) => (
              <GameCard key={`s-${i}`} game={g} logos={logos} />
            ))}
          </div>
        )}
        {north.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400">
              <span className="h-2 w-2 rounded-full bg-blue-400" /> מחוז צפון
            </h3>
            {north.map((g, i) => (
              <GameCard key={`n-${i}`} game={g} logos={logos} />
            ))}
          </div>
        )}
        {other.length > 0 && (
          <div className="space-y-2 lg:col-span-2">
            {other.map((g, i) => (
              <GameCard key={`o-${i}`} game={g} logos={logos} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
