export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NORTH_TABLE, SOUTH_TABLE } from '@/lib/league-data';
import SeriesFlyerCard from '@/components/SeriesFlyerCard';
import PublicBoxScore from '@/components/PublicBoxScore';
import PlayoffPlate from '@/components/PlayoffPlate';
import { getLang, st } from '@/lib/get-lang';
import { getCurrentSeason } from '@/lib/current-season';
import { makeNameResolver } from '@/lib/team-name-resolver';
import { bucketGameStats, type RawStat } from '@/lib/box-score';

interface Game {
  series_number: number; game_number: number;
  home_score: number | null; away_score: number | null;
  played: boolean;
  home_quarters: number[] | null; away_quarters: number[] | null;
  video_url: string | null;
  location: string | null;
}
interface Series {
  series_number: number; team_a: string; team_b: string;
  team_a_label: string; team_b_label: string;
}
interface StandingRow { rank: number; name: string; division: string; }

function normName(n: string) {
  return n.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function homeForGame(s: Series, gNum: number) {
  return gNum === 2 ? s.team_b : s.team_a;
}

export default async function SeriesFlyerPage({
  params,
}: { params: Promise<{ num: string }> }) {
  const { num } = await params;
  const seriesNum = parseInt(num, 10);
  const lang = await getLang();
  const T = (he: string) => st(he, lang);
  const season = await getCurrentSeason();

  const [{ data: seriesData }, { data: gamesData }, { data: teamsData }, { data: standingsData }, { data: statsData }, { data: playersData }] =
    await Promise.all([
      supabaseAdmin.from('playoff_series').select('*').eq('season', season).eq('series_number', seriesNum).maybeSingle(),
      supabaseAdmin.from('playoff_games').select('*').eq('season', season).eq('series_number', seriesNum).order('game_number'),
      supabaseAdmin.from('teams').select('id, name, logo_url'),
      supabaseAdmin.from('standings').select('name,rank,division').eq('season', season).order('rank'),
      supabaseAdmin.from('playoff_game_stats').select('game_number, player_id, team_id, points, three_pointers, fouls').eq('season', season).eq('series_number', seriesNum),
      supabaseAdmin.from('players').select('id, name, jersey_number'),
    ]);

  if (!seriesData) notFound();

  /* ── Team resolution from standings ── */
  const allStandings: StandingRow[] = ((standingsData?.length ? standingsData : [
    ...NORTH_TABLE.map(t => ({ rank: t.rank, name: t.name, division: 'North' })),
    ...SOUTH_TABLE.map(t => ({ rank: t.rank, name: t.name, division: 'South' })),
  ])) as StandingRow[];

  function resolveFromLabel(label: string): string {
    if (!label) return '';
    const isNorth = label.includes('צפון');
    const isSouth = label.includes('דרום');
    if (!isNorth && !isSouth) return '';
    const m = label.match(/#(\d+)/);
    if (!m) return '';
    const rank = parseInt(m[1]);
    const div  = isNorth ? 'North' : 'South';
    return allStandings.find(s => s.division === div && s.rank === rank)?.name ?? '';
  }

  const raw = seriesData as Series;
  const series: Series = {
    ...raw,
    team_a: raw.team_a?.trim() || resolveFromLabel(raw.team_a_label),
    team_b: raw.team_b?.trim() || resolveFromLabel(raw.team_b_label),
  };

  /* ── Logo map ── */
  const logoMap: Record<string, string> = {};
  for (const t of teamsData ?? []) {
    if (t.name && t.logo_url) logoMap[t.name] = t.logo_url;
  }
  function findLogo(name: string) {
    return logoMap[name] ?? Object.entries(logoMap).find(([k]) => normName(k) === normName(name))?.[1];
  }

  const hasTeams = !!series.team_a && !!series.team_b;
  const logoA = hasTeams ? findLogo(series.team_a) : undefined;
  const logoB = hasTeams ? findLogo(series.team_b) : undefined;

  /* ── Win counts ── */
  const games = (gamesData ?? []) as Game[];
  let winsA = 0, winsB = 0;
  for (const g of games) {
    if (!g.played || g.home_score === null) continue;
    const home    = homeForGame(series, g.game_number);
    const homeWon = g.home_score > (g.away_score ?? 0);
    if ((homeWon && home === series.team_a) || (!homeWon && home !== series.team_a)) winsA++;
    else winsB++;
  }
  const winner = winsA >= 2 ? series.team_a : winsB >= 2 ? series.team_b : null;

  /* ── Per-game data ── */
  const gameData = [1, 2, 3].map((gNum) => {
    const g = games.find(g => g.game_number === gNum);
    const played = !!(g?.played && g.home_score !== null);
    const home   = homeForGame(series, gNum);
    const homeWon = played && (g!.home_score! > (g!.away_score ?? 0));
    const aWon   = played && ((homeWon && home === series.team_a) || (!homeWon && home !== series.team_a));
    const aScore = played ? (home === series.team_a ? g!.home_score : g!.away_score) : null;
    const bScore = played ? (home === series.team_a ? g!.away_score : g!.home_score) : null;
    return { gameNumber: gNum, played, aScore, bScore, aWon, location: g?.location ?? null };
  });

  const roundLabel = seriesNum <= 4 ? T('רבע גמר') : seriesNum <= 6 ? T('חצי גמר') : T('גמר');
  const waiting = lang === 'en' ? 'TBD' : 'ממתין';

  /* ── Box scores (player stats + quarters per game) ── */
  const resolveName = makeNameResolver((teamsData ?? []).map((t) => ({ id: t.id, name: t.name })));
  const idByTeamName = new Map((teamsData ?? []).map((t) => [t.name, t.id]));
  const teamNameToId = (name: string) => idByTeamName.get(resolveName(name)) ?? null;
  const playerById = new Map(
    (playersData ?? []).map((p) => [p.id, { name: p.name, jersey_number: p.jersey_number }]),
  );
  const statsByGameNum = new Map<number, RawStat[]>();
  for (const s of (statsData ?? []) as (RawStat & { game_number: number })[]) {
    const arr = statsByGameNum.get(s.game_number) ?? [];
    arr.push(s);
    statsByGameNum.set(s.game_number, arr);
  }

  const boxScores = [1, 2, 3]
    .map((gNum) => {
      const g = games.find((x) => x.game_number === gNum);
      const statRows = statsByGameNum.get(gNum) ?? [];
      const hasQuarters = (g?.home_quarters?.length ?? 0) > 0 || (g?.away_quarters?.length ?? 0) > 0;
      if (statRows.length === 0 && !hasQuarters) return null;
      const homeName = homeForGame(series, gNum);
      const awayName = homeName === series.team_a ? series.team_b : series.team_a;
      const { homePlayers, awayPlayers } = bucketGameStats(
        statRows, playerById, teamNameToId(homeName), teamNameToId(awayName),
      );
      return {
        gNum, homeName, awayName,
        homeScore: g?.home_score ?? null,
        awayScore: g?.away_score ?? null,
        homeQuarters: g?.home_quarters ?? null,
        awayQuarters: g?.away_quarters ?? null,
        videoUrl: g?.video_url ?? null,
        location: g?.location ?? null,
        homePlayers, awayPlayers,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  // Videos for games that may not yet have a box score recorded (e.g. score
  // entered + video link added but no per-player stats). The box-score loop
  // already shows the video next to the score sheet; this catches any played
  // game that has a video but no stats.
  const videoOnlyGames = games
    .filter((g) => g.video_url && !boxScores.some((b) => b.gNum === g.game_number))
    .map((g) => ({ gNum: g.game_number, videoUrl: g.video_url! }));

  return (
    <div
      className="flex flex-col items-center px-4 py-6"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a3a5c 0%, #0b1520 60%)', minHeight: '100dvh' }}
      dir={lang === 'en' ? 'ltr' : 'rtl'}
    >
      <Link
        href="/playoff"
        className="mb-8 self-start inline-flex items-center gap-1.5 text-sm text-[#5a7a9a] hover:text-orange-400 transition-colors"
      >
        {lang === 'en' ? '← Back to Playoff' : '← חזרה לפלייאוף'}
      </Link>

      <SeriesFlyerCard
        roundLabel={roundLabel}
        seriesNum={seriesNum}
        teamA={series.team_a || waiting}
        teamB={series.team_b || waiting}
        logoA={logoA}
        logoB={logoB}
        winsA={winsA}
        winsB={winsB}
        winner={winner}
        games={gameData}
        hasTeams={hasTeams}
        boxScoreGames={boxScores.map((b) => b.gNum)}
      />

      {boxScores.length > 0 && (
        <div id="box-scores" className="mt-6 w-full max-w-2xl space-y-2">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#8aaac8]">
            📋 {lang === 'en' ? 'Box Scores' : 'גיליונות משחק'}
          </h2>
          {boxScores.map((b) => (
            <div key={b.gNum} id={`game-${b.gNum}`} className="space-y-2 scroll-mt-24">
              <PublicBoxScore
                lang={lang as 'he' | 'en'}
                gameLabel={lang === 'en' ? `Game ${b.gNum}` : `משחק ${b.gNum}`}
                award={<PlayoffPlate size={18} />}
                homeTeamName={b.homeName}
                awayTeamName={b.awayName}
                homeScore={b.homeScore}
                awayScore={b.awayScore}
                homeQuarters={b.homeQuarters}
                awayQuarters={b.awayQuarters}
                homePlayers={b.homePlayers}
                awayPlayers={b.awayPlayers}
              />
              {b.location && (
                <p className="text-center text-xs font-bold text-[#8aaac8]">📍 {b.location}</p>
              )}
              {b.videoUrl && (
                <a
                  href={b.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-bold text-orange-400 hover:bg-orange-500/20 transition-colors"
                >
                  🎬 {lang === 'en' ? `Watch Game ${b.gNum}` : `צפה במשחק ${b.gNum}`}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {videoOnlyGames.length > 0 && (
        <div className="mt-6 w-full max-w-2xl space-y-2">
          {boxScores.length === 0 && (
            <h2 className="text-sm font-black uppercase tracking-widest text-[#8aaac8]">
              🎬 {lang === 'en' ? 'Game Videos' : 'סרטוני משחק'}
            </h2>
          )}
          {videoOnlyGames.map((v) => (
            <a
              key={v.gNum}
              href={v.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-bold text-orange-400 hover:bg-orange-500/20 transition-colors"
            >
              🎬 {lang === 'en' ? `Watch Game ${v.gNum}` : `צפה במשחק ${v.gNum}`}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
