// ── LastRoundResults — server component shown on the home page ────────────
// Displays the most recently completed round of league games. Reads
// `game_results` from Supabase, picks the highest-numbered round, and
// renders the games grouped by division with the same dark-blue card
// style used elsewhere on the site.

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeams } from '@/lib/supabase';
import { getLang, st } from '@/lib/get-lang';
import { makeNameResolver } from '@/lib/team-name-resolver';

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
function TeamLogo({ name, displayName, url }: { name: string; displayName: string; url: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={displayName}
        className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover shadow-sm"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#1a2e45] text-[10px] font-black text-[#3a5a7a]">
      {[...displayName].find(c => /\S/.test(c)) ?? [...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

// ── Single-game card ─────────────────────────────────────────────────────
function GameCard({
  game,
  logos,
  T,
  resolveName,
}: {
  game: ResultRow;
  logos: Record<string, string | null>;
  T: (he: string) => string;
  resolveName: (s: string) => string;
}) {
  const homeWins     = game.home_score > game.away_score;
  const awayWins     = game.away_score > game.home_score;
  const techni       = !!game.techni || isTechniScore(game.home_score, game.away_score);
  // Badge shows on each team that didn't win — covers single-side forfeit
  // (one badge) AND double forfeit / tied techni (badge on both).
  const techniOnHome = techni && !homeWins;
  const techniOnAway = techni && !awayWins;

  const homeName = resolveName(game.home_team);
  const awayName = resolveName(game.away_team);

  return (
    <Link
      href={`/games/${game.round}/${encodeURIComponent(homeName)}`}
      className="group grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-orange-500/40 hover:bg-orange-500/[0.04] cursor-pointer"
    >
      {/* Home */}
      <div className="flex min-w-0 items-center justify-end gap-2">
        <TeamLogo name={homeName} displayName={T(homeName)} url={findLogo(homeName, logos) ?? findLogo(game.home_team, logos)} />
        <div className="min-w-0 text-right">
          <p
            className={`truncate text-sm font-bold leading-tight transition-colors group-hover:text-orange-400 font-heading ${
              homeWins ? 'text-white' : 'text-[#8aaac8]'
            }`}
          >
            {T(homeName)}
          </p>
          {techniOnHome && (
            <p className="mt-0.5 text-[10px] font-black text-red-400">{T('🔴 הפסד טכני')}</p>
          )}
        </div>
      </div>

      {/* Score — no dir override: in RTL the home_score sits next to the
         home team (right side); in LTR it sits next to home team (left). */}
      <div className="min-w-[72px] shrink-0 rounded-lg bg-black/40 px-2.5 py-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
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
          <p className="mt-0.5 text-[8px] font-bold tracking-wide text-red-400">{T('טכני *')}</p>
        )}
      </div>

      {/* Away */}
      <div className="flex min-w-0 items-center justify-start gap-2">
        <div className="min-w-0 text-left">
          <p
            className={`truncate text-sm font-bold leading-tight transition-colors group-hover:text-orange-400 font-heading ${
              !homeWins ? 'text-white' : 'text-[#8aaac8]'
            }`}
          >
            {T(awayName)}
          </p>
          {techniOnAway && (
            <p className="mt-0.5 text-[10px] font-black text-red-400">{T('🔴 הפסד טכני')}</p>
          )}
        </div>
        <TeamLogo name={awayName} displayName={T(awayName)} url={findLogo(awayName, logos) ?? findLogo(game.away_team, logos)} />
      </div>
    </Link>
  );
}

// ── Section ──────────────────────────────────────────────────────────────
export default async function LastRoundResults() {
  const [{ data: results }, teams, lang] = await Promise.all([
    supabaseAdmin
      .from('game_results')
      .select('round,date,home_team,away_team,home_score,away_score,techni,division')
      .order('round', { ascending: false }),
    getTeams(),
    getLang(),
  ]);
  const T = (he: string) => st(he, lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

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

  // Team-name resolver — admin Teams tab is the single source of truth
  const resolveName = makeNameResolver(teams.map(t => ({ id: t.id, name: t.name })));

  const date = roundGames[0]?.date ?? '';

  return (
    <section dir={dir}>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-white font-heading">
          <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">
            ✅
          </span>
          {T('תוצאות מחזור')} {lastRound}
        </h2>
        {date && <span className="text-sm font-bold text-[#8aaac8]">· {date}</span>}
        <Link
          href="/results"
          className="ms-auto text-sm font-bold text-[#8aaac8] transition-colors hover:text-orange-400"
        >
          {T('כל התוצאות ←')}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {south.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400">
              <span className="h-2 w-2 rounded-full bg-orange-400" /> {T('מחוז דרום')}
            </h3>
            {south.map((g, i) => (
              <GameCard key={`s-${i}`} game={g} logos={logos} T={T} resolveName={resolveName} />
            ))}
          </div>
        )}
        {north.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400">
              <span className="h-2 w-2 rounded-full bg-blue-400" /> {T('מחוז צפון')}
            </h3>
            {north.map((g, i) => (
              <GameCard key={`n-${i}`} game={g} logos={logos} T={T} resolveName={resolveName} />
            ))}
          </div>
        )}
        {other.length > 0 && (
          <div className="space-y-2 lg:col-span-2">
            {other.map((g, i) => (
              <GameCard key={`o-${i}`} game={g} logos={logos} T={T} resolveName={resolveName} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
