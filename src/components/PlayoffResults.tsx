// ── PlayoffResults — server component shown on the home page during playoffs ──
// Replaces LastRoundResults once the regular season is over. Playoff games hold
// no team columns, so home/away is resolved through playoff_series (team_a /
// team_b, with a seed-label → standings fallback) and the game-2 home/away swap
// used across /playoff. Only PLAYED games are shown, grouped by stage, in the
// same dark card style as the league results.

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeams } from '@/lib/supabase';
import { getLang, st } from '@/lib/get-lang';
import { makeNameResolver } from '@/lib/team-name-resolver';
import { getCurrentSeason } from '@/lib/current-season';

type StageKey = 'qf' | 'sf' | 'final';

// series 1-4 = רבע גמר · 5-6 = חצי גמר · 7 = גמר (matches /playoff convention).
function stageKeyForSeries(n: number): StageKey {
  if (n >= 7) return 'final';
  if (n >= 5) return 'sf';
  return 'qf';
}
const STAGE_HE: Record<StageKey, string> = { qf: 'רבע גמר', sf: 'חצי גמר', final: 'גמר' };
const STAGE_ACCENT: Record<StageKey, { text: string; dot: string }> = {
  qf:    { text: 'text-sky-400',    dot: 'bg-sky-400' },
  sf:    { text: 'text-orange-400', dot: 'bg-orange-400' },
  final: { text: 'text-[#e0c97a]',  dot: 'bg-[#e0c97a]' },
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

type ResultCard = {
  seriesNumber: number;
  gameNumber: number;
  stageKey: StageKey;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeLogo: string | null;
  awayLogo: string | null;
  videoUrl: string | null;
};

function GameCard({ game, T }: { game: ResultCard; T: (he: string) => string }) {
  const homeWins = game.homeScore > game.awayScore;
  return (
    <div className="relative">
      {game.videoUrl && (
        <a
          href={game.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={T('קיים סרטון משחק')}
          title={T('קיים סרטון משחק')}
          className="absolute z-10 flex items-center justify-center bg-red-600 shadow-md ring-1 ring-black/40 transition-transform hover:scale-110 hover:bg-red-500
            top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-6 rounded-md
            sm:top-1.5 sm:left-1.5 sm:translate-x-0 sm:translate-y-0 sm:h-5 sm:w-7 sm:rounded-[5px] sm:ring-black/30"
        >
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </a>
      )}
      <Link
        href={`/playoff/series/${game.seriesNumber}`}
        className="group grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-[#e0c97a]/40 hover:bg-[#e0c97a]/[0.04] cursor-pointer"
      >
        {/* Home */}
        <div className="flex min-w-0 items-center justify-end gap-2">
          <TeamLogo name={game.homeName} displayName={T(game.homeName)} url={game.homeLogo} />
          <div className="min-w-0 text-right">
            <p className={`truncate text-sm font-bold leading-tight transition-colors group-hover:text-[#e0c97a] font-heading ${homeWins ? 'text-white' : 'text-[#8aaac8]'}`}>
              {T(game.homeName)}
            </p>
          </div>
        </div>

        {/* Score + stage/game caption */}
        <div className="min-w-[72px] shrink-0 rounded-lg bg-black/40 px-2.5 py-2 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className={`font-stats text-2xl font-black tabular-nums ${homeWins ? 'text-orange-400' : 'text-[#8aaac8]'}`}>{game.homeScore}</span>
            <span className="font-stats text-lg font-black text-[#8aaac8]">:</span>
            <span className={`font-stats text-2xl font-black tabular-nums ${!homeWins ? 'text-orange-400' : 'text-[#8aaac8]'}`}>{game.awayScore}</span>
          </div>
          <p className="mt-0.5 text-[8px] font-bold tracking-wide text-[#8aaac8]">{T('משחק')} {game.gameNumber}</p>
        </div>

        {/* Away */}
        <div className="flex min-w-0 items-center justify-start gap-2">
          <div className="min-w-0 text-left">
            <p className={`truncate text-sm font-bold leading-tight transition-colors group-hover:text-[#e0c97a] font-heading ${!homeWins ? 'text-white' : 'text-[#8aaac8]'}`}>
              {T(game.awayName)}
            </p>
          </div>
          <TeamLogo name={game.awayName} displayName={T(game.awayName)} url={game.awayLogo} />
        </div>
      </Link>
    </div>
  );
}

export default async function PlayoffResults() {
  const season = await getCurrentSeason();
  const [{ data: seriesData }, { data: gamesData }, { data: standingsData }, teams, lang] = await Promise.all([
    supabaseAdmin
      .from('playoff_series')
      .select('series_number, team_a, team_b, team_a_label, team_b_label')
      .eq('season', season)
      .order('series_number'),
    supabaseAdmin
      .from('playoff_games')
      .select('series_number, game_number, home_score, away_score, video_url')
      .eq('season', season)
      .order('series_number')
      .order('game_number'),
    supabaseAdmin
      .from('standings')
      .select('name, division, rank')
      .eq('season', season)
      .order('rank', { ascending: true }),
    getTeams(),
    getLang(),
  ]);
  const T = (he: string) => st(he, lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  const series = (seriesData ?? []) as { series_number: number; team_a: string | null; team_b: string | null; team_a_label: string | null; team_b_label: string | null }[];
  const games = (gamesData ?? []) as { series_number: number; game_number: number; home_score: number | null; away_score: number | null; video_url: string | null }[];
  if (series.length === 0) return null;

  const standings = (standingsData ?? []) as { name: string; division: string; rank: number }[];
  const resolveFromLabel = (label: string | null): string => {
    if (!label) return '';
    const isNorth = label.includes('צפון');
    const isSouth = label.includes('דרום');
    if (!isNorth && !isSouth) return '';
    const m = label.match(/#(\d+)/);
    if (!m) return '';
    return standings.find((s) => s.division === (isNorth ? 'North' : 'South') && s.rank === parseInt(m[1], 10))?.name ?? '';
  };
  // game 2 swaps home/away (mirrors /playoff homeForGame).
  const homeForGame = (teamA: string, teamB: string, gNum: number) => (gNum === 2 ? teamB : teamA);

  const logos: Record<string, string | null> = {};
  for (const t of teams) logos[norm(t.name)] = t.logo_url;
  const resolveName = makeNameResolver(teams.map(t => ({ id: t.id, name: t.name })));

  const teamBySeries = new Map<number, { a: string; b: string }>();
  for (const s of series) {
    const a = s.team_a?.trim() || resolveFromLabel(s.team_a_label);
    const b = s.team_b?.trim() || resolveFromLabel(s.team_b_label);
    if (a && b) teamBySeries.set(s.series_number, { a, b });
  }

  const cards: ResultCard[] = [];
  for (const g of games) {
    if (g.home_score == null || g.away_score == null) continue; // played games only
    const pair = teamBySeries.get(g.series_number);
    if (!pair) continue;
    const homeRaw = homeForGame(pair.a, pair.b, g.game_number);
    const awayRaw = homeRaw === pair.a ? pair.b : pair.a;
    const homeName = resolveName(homeRaw);
    const awayName = resolveName(awayRaw);
    cards.push({
      seriesNumber: g.series_number,
      gameNumber: g.game_number,
      stageKey: stageKeyForSeries(g.series_number),
      homeName,
      awayName,
      homeScore: g.home_score,
      awayScore: g.away_score,
      homeLogo: findLogo(homeName, logos) ?? findLogo(homeRaw, logos),
      awayLogo: findLogo(awayName, logos) ?? findLogo(awayRaw, logos),
      videoUrl: g.video_url,
    });
  }
  if (cards.length === 0) return null;

  // Group by stage — show the most advanced stage first (final → sf → qf).
  const order: StageKey[] = ['final', 'sf', 'qf'];
  const grouped = order
    .map((key) => ({ key, items: cards.filter((c) => c.stageKey === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <section dir={dir}>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-white font-heading">
          <span className="rounded-lg bg-gradient-to-br from-[#e0c97a] to-[#b8860b] px-2 py-1 text-sm">🏆</span>
          {T('תוצאות פלייאוף')}
        </h2>
        <Link
          href="/playoff"
          className="ms-auto text-sm font-bold text-[#8aaac8] transition-colors hover:text-[#e0c97a]"
        >
          {T('לעץ הפלייאוף ←')}
        </Link>
      </div>

      <div className="space-y-5">
        {grouped.map((stage) => (
          <div key={stage.key} className="space-y-2">
            <h3 className={`flex items-center gap-2 text-sm font-bold ${STAGE_ACCENT[stage.key].text}`}>
              <span className={`h-2 w-2 rounded-full ${STAGE_ACCENT[stage.key].dot}`} /> {T(STAGE_HE[stage.key])}
            </h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {stage.items.map((g, i) => (
                <GameCard key={`${g.seriesNumber}-${g.gameNumber}-${i}`} game={g} T={T} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
