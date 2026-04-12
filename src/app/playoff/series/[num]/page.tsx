export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NORTH_TABLE, SOUTH_TABLE } from '@/lib/league-data';
import SeriesFlyerCard from '@/components/SeriesFlyerCard';

interface Game {
  series_number: number; game_number: number;
  home_score: number | null; away_score: number | null;
  played: boolean;
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

  const [{ data: seriesData }, { data: gamesData }, { data: teamsData }, { data: standingsData }] =
    await Promise.all([
      supabaseAdmin.from('playoff_series').select('*').eq('series_number', seriesNum).maybeSingle(),
      supabaseAdmin.from('playoff_games').select('*').eq('series_number', seriesNum).order('game_number'),
      supabaseAdmin.from('teams').select('name, logo_url'),
      supabaseAdmin.from('standings').select('name,rank,division').order('rank'),
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
    return { gameNumber: gNum, played, aScore, bScore, aWon };
  });

  const roundLabel = seriesNum <= 4 ? 'רבע גמר' : seriesNum <= 6 ? 'חצי גמר' : 'גמר';

  return (
    <div
      className="flex flex-col items-center px-4 py-6"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a3a5c 0%, #0b1520 60%)', minHeight: '100dvh' }}
      dir="rtl"
    >
      <Link
        href="/playoff"
        className="mb-8 self-start inline-flex items-center gap-1.5 text-sm text-[#5a7a9a] hover:text-orange-400 transition-colors"
      >
        ← חזרה לפלייאוף
      </Link>

      <SeriesFlyerCard
        roundLabel={roundLabel}
        seriesNum={seriesNum}
        teamA={series.team_a || 'ממתין'}
        teamB={series.team_b || 'ממתין'}
        logoA={logoA}
        logoB={logoB}
        winsA={winsA}
        winsB={winsB}
        winner={winner}
        games={gameData}
        hasTeams={hasTeams}
      />
    </div>
  );
}
