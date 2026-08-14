// ── PlayoffResults — server component shown on the home page during playoffs ──
// Replaces LastRoundResults once the regular season is over. Playoff games hold
// no team columns, so home/away is resolved through playoff_series (team_a /
// team_b, with a seed-label → standings fallback and SF/final resolved from
// earlier-round winners) and the game-2 home/away swap
// used across /playoff. Only the LATEST played game of each series is shown,
// grouped by stage, in the same dark card style as the league results.

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTeams } from '@/lib/supabase';
import { getLang, st } from '@/lib/get-lang';
import { makeNameResolver } from '@/lib/team-name-resolver';
import { getCurrentSeason } from '@/lib/current-season';
import { winsNeeded } from '@/lib/playoff-format';
import { displayName } from '@/lib/names';
import TeamLogoZoom from '@/components/TeamLogoZoom';

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
      <TeamLogoZoom
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
            <p className={`break-words text-sm font-bold leading-tight transition-colors group-hover:text-[#e0c97a] font-heading ${homeWins ? 'text-white' : 'text-[#8aaac8]'}`}>
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
            <p className={`break-words text-sm font-bold leading-tight transition-colors group-hover:text-[#e0c97a] font-heading ${!homeWins ? 'text-white' : 'text-[#8aaac8]'}`}>
              {T(game.awayName)}
            </p>
          </div>
          <TeamLogo name={game.awayName} displayName={T(game.awayName)} url={game.awayLogo} />
        </div>
      </Link>
    </div>
  );
}

// ── Series block (stats-page layout) ────────────────────────────────────────
// One card per best-of-3 series: both teams with the series tally, who
// advanced, and every game score with the winner emphasized.
type SeriesGameLine = { gameNumber: number; scoreA: number; scoreB: number; aWon: boolean; dateLabel: string };

// "2026-07-17" → "17.7" (day.month); anything unparseable → ''.
function shortDate(iso: string | null): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${parseInt(m[3], 10)}.${parseInt(m[2], 10)}`;
}

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Weekday name for an ISO date (built from parts so it's timezone-safe); '' when unparseable.
function weekdayLabel(iso: string | null, lang: 'he' | 'en'): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return (lang === 'en' ? EN_DAYS : HE_DAYS)[dt.getDay()];
}
// ── Upcoming-final banner ────────────────────────────────────────────────────
// Shown once the two finalists are known but the championship game hasn't been
// played. Mirrors the gold ChampionBanner trophy styling so the "next game"
// reads as the marquee event it is — a matchup preview rather than a result.
type UpcomingFinal = {
  seriesNumber: number;
  aName: string; bName: string;
  aLogo: string | null; bLogo: string | null;
  dayLabel: string; dateLabel: string; timeLabel: string; location: string | null;
};

function FinalCrest({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-amber-500/50 bg-white/[0.04] shadow-[0_0_35px_-6px_rgba(245,158,11,0.5)] sm:h-24 sm:w-24">
      <span className="pointer-events-none absolute -inset-1.5 rounded-full border border-amber-200/20" />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-[54px] w-[54px] rounded-full object-cover sm:h-[84px] sm:w-[84px]" />
      ) : (
        <span className="text-2xl font-black text-amber-200 sm:text-4xl">{[...name].find(c => /\S/.test(c)) ?? '?'}</span>
      )}
    </div>
  );
}

function UpcomingFinalBanner({ final, season, T, en, lang }: {
  final: UpcomingFinal; season: string; T: (he: string) => string; en: boolean; lang: 'he' | 'en';
}) {
  const when = [final.dayLabel, final.dateLabel, final.timeLabel].filter(Boolean).join(' · ');
  return (
    <Link
      href={`/playoff/series/${final.seriesNumber}`}
      className="group relative block overflow-hidden rounded-3xl border-2 border-amber-500/40 px-4 py-7 shadow-[0_30px_80px_-24px_rgba(245,158,11,0.4)] transition hover:border-amber-400/60 sm:px-8 sm:py-10"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 50% -10%, rgba(245,158,11,0.30) 0%, transparent 60%), linear-gradient(180deg, #12233a 0%, #0b1726 100%)',
      }}
    >
      {/* Decorative sparkles */}
      <span className="pointer-events-none absolute left-[8%] top-[14%] h-1 w-1 rounded-full bg-amber-200 opacity-70 shadow-[0_0_10px_2px_rgba(253,230,138,0.8)]" />
      <span className="pointer-events-none absolute right-[10%] top-[20%] h-1.5 w-1.5 rounded-full bg-amber-200 opacity-70 shadow-[0_0_10px_2px_rgba(253,230,138,0.8)]" />
      <span className="pointer-events-none absolute left-[13%] top-[80%] h-1 w-1 rounded-full bg-amber-200 opacity-60 shadow-[0_0_10px_2px_rgba(253,230,138,0.8)]" />
      <span className="pointer-events-none absolute right-[12%] top-[84%] h-1.5 w-1.5 rounded-full bg-amber-200 opacity-70 shadow-[0_0_10px_2px_rgba(253,230,138,0.8)]" />

      {/* Trophy + eyebrow + headline */}
      <div className="flex flex-col items-center gap-2.5">
        <span className="text-5xl drop-shadow-[0_8px_20px_rgba(245,158,11,0.5)] sm:text-6xl">🏆</span>
        <div className="flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.24em] text-amber-200 sm:text-[13px]">
          <span className="h-px w-8 bg-gradient-to-r from-transparent via-amber-500 to-transparent sm:w-16" />
          <span>{en ? `Playoff Final · ${season}` : `גמר הפלייאוף · ${season}`}</span>
          <span className="h-px w-8 bg-gradient-to-r from-transparent via-amber-500 to-transparent sm:w-16" />
        </div>
        <p className="bg-gradient-to-b from-white to-amber-200 bg-clip-text text-center font-heading text-lg font-black leading-tight text-transparent sm:text-2xl">
          {en ? 'The Championship Game' : 'המשחק המכריע על האליפות'}
        </p>
      </div>

      {/* Matchup */}
      <div className="mt-6 flex items-center justify-center gap-3 sm:mt-8 sm:gap-8">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5">
          <FinalCrest url={final.aLogo} name={final.aName} />
          <p className="min-w-0 break-words bg-gradient-to-b from-white to-amber-200 bg-clip-text text-center font-heading text-base font-black leading-tight text-transparent sm:text-2xl">{T(final.aName)}</p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-amber-500/50 bg-black/30 shadow-[0_0_25px_-4px_rgba(245,158,11,0.55)] sm:h-16 sm:w-16">
            <span className="font-stats text-base font-black text-amber-300 sm:text-2xl">{en ? 'VS' : 'נגד'}</span>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-black/25 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-200/90 sm:text-[10px]">
            {en ? 'Single game' : T('משחק אחד')}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5">
          <FinalCrest url={final.bLogo} name={final.bName} />
          <p className="min-w-0 break-words bg-gradient-to-b from-white to-amber-200 bg-clip-text text-center font-heading text-base font-black leading-tight text-transparent sm:text-2xl">{T(final.bName)}</p>
        </div>
      </div>

      {/* Schedule + venue */}
      <div className="mt-6 flex flex-col items-center gap-2 sm:mt-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-black/30 px-4 py-1.5 text-xs font-bold text-amber-100 sm:text-sm">
          {when ? <>📅 {when}</> : <>⏳ {en ? 'Date TBD' : 'המועד טרם נקבע'}</>}
        </span>
        {final.location && (
          <p className="flex items-center justify-center gap-1.5 px-2 text-center text-xs font-bold text-amber-100/90 sm:text-sm">
            <span className="shrink-0">📍</span>
            <span className="min-w-0 break-words">{displayName(final.location, lang)}</span>
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="mt-6 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-xl border border-amber-700/40 bg-gradient-to-b from-amber-200 to-amber-500 px-6 py-2.5 text-sm font-black text-amber-950 shadow-[0_10px_24px_-8px_rgba(245,158,11,0.6)] transition group-hover:-translate-y-px sm:text-base">
          {en ? 'To the Final →' : 'לעמוד הגמר ←'}
        </span>
      </div>
    </Link>
  );
}

type SeriesBlockData = {
  seriesNumber: number;
  stageKey: StageKey;
  teamAName: string;
  teamBName: string;
  teamALogo: string | null;
  teamBLogo: string | null;
  winsA: number;
  winsB: number;
  winner: 'a' | 'b' | null;
  advancedLabel: string;
  games: SeriesGameLine[];
};

function SeriesTeamRow({ name, displayName, logo, wins, isWinner, decided }: {
  name: string; displayName: string; logo: string | null; wins: number; isWinner: boolean; decided: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <TeamLogo name={name} displayName={displayName} url={logo} />
        <p className={`break-words text-sm font-bold leading-tight font-heading ${isWinner || !decided ? 'text-white' : 'text-[#8aaac8]'}`}>
          {displayName}
        </p>
      </div>
      <span className={`shrink-0 font-stats text-xl font-black tabular-nums ${isWinner ? 'text-orange-400' : 'text-[#8aaac8]'}`}>{wins}</span>
    </div>
  );
}

function SeriesBlock({ block, T }: { block: SeriesBlockData; T: (he: string) => string }) {
  const decided = block.winner !== null;
  const aWon = block.winner === 'a';
  const bWon = block.winner === 'b';
  return (
    <Link
      href={`/playoff/series/${block.seriesNumber}`}
      className="group block overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.04] transition hover:-translate-y-0.5 hover:border-[#e0c97a]/40 hover:bg-[#e0c97a]/[0.04]"
    >
      {/* Header: series number + who advanced */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="text-[11px] font-bold text-[#8aaac8] font-body">{T('סדרה')} {block.seriesNumber}</span>
        {decided && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-black text-green-400">
            🏆 {T(aWon ? block.teamAName : block.teamBName)} · {block.advancedLabel}
          </span>
        )}
      </div>

      {/* Two teams + series tally */}
      <SeriesTeamRow name={block.teamAName} displayName={T(block.teamAName)} logo={block.teamALogo} wins={block.winsA} isWinner={aWon} decided={decided} />
      <SeriesTeamRow name={block.teamBName} displayName={T(block.teamBName)} logo={block.teamBLogo} wins={block.winsB} isWinner={bWon} decided={decided} />

      {/* Game-by-game scores */}
      <div className="border-t border-white/[0.06] px-3 py-1.5">
        {block.games.map((g) => (
          <div key={g.gameNumber} className="flex items-center justify-between gap-2 border-b border-white/[0.04] py-1.5 text-[13px] last:border-0">
            <span className="shrink-0 text-[#5a7a9a]">{T('משחק')} {g.gameNumber}</span>
            <span className="font-stats tabular-nums">
              <span className={g.aWon ? 'font-black text-white' : 'text-[#8aaac8]'}>{g.scoreA}</span>
              <span className="mx-1.5 text-[#5a7a9a]">:</span>
              <span className={!g.aWon ? 'font-black text-white' : 'text-[#8aaac8]'}>{g.scoreB}</span>
            </span>
          </div>
        ))}
      </div>
    </Link>
  );
}

// ── Series table (stats-page alternative layout) ────────────────────────────
// A dense row-per-game table: each series gets a subheader (teams + who
// advanced), then one row per game with the winner's score emphasized.
function SeriesTable({ blocks, T }: { blocks: SeriesBlockData[]; T: (he: string) => string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
      {blocks.map((block) => {
        const decided = block.winner !== null;
        const aWon = block.winner === 'a';
        return (
          <div key={block.seriesNumber} className="border-b border-white/[0.06] last:border-0">
            {/* Series subheader */}
            <div className="flex items-center justify-between gap-2 bg-white/[0.03] px-4 py-2">
              <span className="min-w-0 break-words text-[12px] font-bold text-[#c8d8e8] font-body">
                {T('סדרה')} {block.seriesNumber} — {T(block.teamAName)} {T('נגד')} {T(block.teamBName)}
              </span>
              {decided && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-black text-green-400">
                  🏆 {T(aWon ? block.teamAName : block.teamBName)} · {block.advancedLabel}
                </span>
              )}
            </div>
            {/* Game rows */}
            {block.games.map((g) => (
              <Link
                key={g.gameNumber}
                href={`/playoff/series/${block.seriesNumber}`}
                className="grid grid-cols-[5rem_1fr_3.5rem] items-center gap-2 border-t border-white/[0.04] px-4 py-2 text-[13px] transition-colors hover:bg-white/[0.03]"
              >
                <span className="text-[#5a7a9a]">{T('משחק')} {g.gameNumber}</span>
                <span className="text-center font-stats tabular-nums">
                  <span className={g.aWon ? 'font-black text-white' : 'text-[#8aaac8]'}>{g.scoreA}</span>
                  <span className="mx-1.5 text-[#5a7a9a]">:</span>
                  <span className={!g.aWon ? 'font-black text-white' : 'text-[#8aaac8]'}>{g.scoreB}</span>
                </span>
                <span className="text-end font-stats tabular-nums text-[#5a7a9a]">{g.dateLabel}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// `season` defaults to the current season (home page); the playoff-stats page
// passes its archive-picker season so results match the table being viewed.
// `layout`: 'cards' (home page) shows the latest played game per series as
// game cards; 'series' (stats page) shows one best-of-3 block per series with
// the full game history.
export default async function PlayoffResults({ season: seasonProp, layout = 'cards' }: { season?: string; layout?: 'cards' | 'series' | 'table' } = {}) {
  const season = seasonProp ?? await getCurrentSeason();
  const [{ data: seriesData }, { data: gamesData }, { data: standingsData }, teams, lang] = await Promise.all([
    supabaseAdmin
      .from('playoff_series')
      .select('series_number, team_a, team_b, team_a_label, team_b_label')
      .eq('season', season)
      .order('series_number'),
    supabaseAdmin
      .from('playoff_games')
      .select('series_number, game_number, home_score, away_score, video_url, game_date, game_time, location')
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
  const games = (gamesData ?? []) as { series_number: number; game_number: number; home_score: number | null; away_score: number | null; video_url: string | null; game_date: string | null; game_time: string | null; location: string | null }[];
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

  // SF/final series carry "נצח סדרה N" labels rather than explicit teams, so
  // resolve them from earlier-round winners (mirrors /playoff SERIES_FEED) —
  // otherwise semi-final and final results never show on the home page.
  const SERIES_FEED: Record<number, [number, number]> = { 5: [1, 2], 6: [3, 4], 7: [5, 6] };
  const winnerOf = (n: number): string => {
    const pair = teamBySeries.get(n);
    if (!pair) return '';
    let winsA = 0, winsB = 0;
    for (const g of games) {
      if (g.series_number !== n || g.home_score == null || g.away_score == null) continue;
      const home = homeForGame(pair.a, pair.b, g.game_number);
      const homeWon = g.home_score > g.away_score;
      if ((homeWon && home === pair.a) || (!homeWon && home !== pair.a)) winsA++;
      else winsB++;
    }
    const need = winsNeeded(n);
    return winsA >= need ? pair.a : winsB >= need ? pair.b : '';
  };
  for (const n of [5, 6, 7]) {
    if (teamBySeries.has(n)) continue;
    const s = series.find(x => x.series_number === n);
    if (!s) continue;
    const [feedA, feedB] = SERIES_FEED[n];
    const a = s.team_a?.trim() || winnerOf(feedA);
    const b = s.team_b?.trim() || winnerOf(feedB);
    if (a && b) teamBySeries.set(n, { a, b });
  }

  // Upcoming final: the finalists are resolved (from the SF winners) but the
  // championship game hasn't been played yet — surface it as a marquee banner.
  const finalPair = teamBySeries.get(7);
  const finalGames = games.filter((g) => g.series_number === 7);
  const finalPlayed = finalGames.some((g) => g.home_score != null && g.away_score != null);
  const upcomingFinal: UpcomingFinal | null = finalPair && !finalPlayed
    ? (() => {
        const g1 = finalGames.find((g) => g.game_number === 1) ?? finalGames[0];
        const aName = resolveName(finalPair.a);
        const bName = resolveName(finalPair.b);
        return {
          seriesNumber: 7,
          aName, bName,
          aLogo: findLogo(aName, logos) ?? findLogo(finalPair.a, logos),
          bLogo: findLogo(bName, logos) ?? findLogo(finalPair.b, logos),
          dayLabel: weekdayLabel(g1?.game_date ?? null, lang),
          dateLabel: shortDate(g1?.game_date ?? null),
          timeLabel: g1?.game_time ? g1.game_time.slice(0, 5) : '',
          location: g1?.location ?? null,
        };
      })()
    : null;

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
  if (cards.length === 0 && !upcomingFinal) return null;

  const order: StageKey[] = ['final', 'sf', 'qf']; // most advanced stage first

  // Home page (default): only the latest played game per series as game cards.
  const latestBySeries = new Map<number, ResultCard>();
  for (const c of cards) {
    const prev = latestBySeries.get(c.seriesNumber);
    if (!prev || c.gameNumber > prev.gameNumber) latestBySeries.set(c.seriesNumber, c);
  }
  const groupedCards = order
    .map((key) => ({ key, items: [...latestBySeries.values()].filter((c) => c.stageKey === key) }))
    .filter((g) => g.items.length > 0);

  // Home page shows only the most-advanced stage that has results: once the
  // semi-finals (or final) have played games, the earlier rounds drop off the
  // home strip. `order` is most-advanced-first and empty stages are already
  // filtered out, so the first group is the latest stage in play.
  const latestStageCards = groupedCards.slice(0, 1);

  // Stats page: one best-of-3 block per series with the full game history.
  const advancedLabelFor = (key: StageKey) =>
    key === 'final' ? (lang === 'en' ? 'Champion' : 'אלופה')
    : key === 'sf'  ? (lang === 'en' ? 'To the final' : 'עלו לגמר')
    :                 (lang === 'en' ? 'To the semis' : 'עלו לחצי');
  const blocks: SeriesBlockData[] = [];
  for (const [seriesNumber, pair] of teamBySeries) {
    const seriesGames = games
      .filter((g) => g.series_number === seriesNumber && g.home_score != null && g.away_score != null)
      .sort((a, b) => a.game_number - b.game_number);
    if (seriesGames.length === 0) continue;
    let winsA = 0, winsB = 0;
    const gameLines: SeriesGameLine[] = [];
    for (const g of seriesGames) {
      const home = homeForGame(pair.a, pair.b, g.game_number);
      const scoreA = home === pair.a ? g.home_score! : g.away_score!;
      const scoreB = home === pair.a ? g.away_score! : g.home_score!;
      const aWon = scoreA > scoreB;
      if (aWon) winsA++; else winsB++;
      gameLines.push({ gameNumber: g.game_number, scoreA, scoreB, aWon, dateLabel: shortDate(g.game_date) });
    }
    const need = winsNeeded(seriesNumber);
    const winner: 'a' | 'b' | null = winsA >= need ? 'a' : winsB >= need ? 'b' : null;
    const aName = resolveName(pair.a), bName = resolveName(pair.b);
    const stageKey = stageKeyForSeries(seriesNumber);
    blocks.push({
      seriesNumber, stageKey,
      teamAName: aName, teamBName: bName,
      teamALogo: findLogo(aName, logos) ?? findLogo(pair.a, logos),
      teamBLogo: findLogo(bName, logos) ?? findLogo(pair.b, logos),
      winsA, winsB, winner,
      advancedLabel: advancedLabelFor(stageKey),
      games: gameLines,
    });
  }
  const groupedBlocks = order
    .map((key) => ({ key, items: blocks.filter((b) => b.stageKey === key).sort((a, b) => a.seriesNumber - b.seriesNumber) }))
    .filter((g) => g.items.length > 0);

  return (
    <section dir={dir}>
      {/* The upcoming-final hero leads the block; the results heading sits below
          it, right above the completed rounds. */}
      {upcomingFinal && (
        <div className="mb-5">
          <UpcomingFinalBanner final={upcomingFinal} season={season} T={T} en={lang === 'en'} lang={lang} />
        </div>
      )}

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
        {layout === 'series' || layout === 'table'
          ? groupedBlocks.map((stage) => (
              <div key={stage.key} className="space-y-2">
                <h3 className={`flex items-center gap-2 text-sm font-bold ${STAGE_ACCENT[stage.key].text}`}>
                  <span className={`h-2 w-2 rounded-full ${STAGE_ACCENT[stage.key].dot}`} /> {T(STAGE_HE[stage.key])}
                </h3>
                {layout === 'table' ? (
                  <SeriesTable blocks={stage.items} T={T} />
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {stage.items.map((b) => (
                      <SeriesBlock key={b.seriesNumber} block={b} T={T} />
                    ))}
                  </div>
                )}
              </div>
            ))
          : latestStageCards.map((stage) => (
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
