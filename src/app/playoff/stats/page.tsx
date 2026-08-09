export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLang, st } from '@/lib/get-lang';
import { resolveSeasonFromParams, listKnownSeasons } from '@/lib/current-season';
import SeasonPicker from '@/components/SeasonPicker';
import ArchiveBanner from '@/components/ArchiveBanner';
import PlayoffPlate from '@/components/PlayoffPlate';
import PlayoffResults from '@/components/PlayoffResults';
import PlayoffStatsTabs, { type StatTab } from '@/components/PlayoffStatsTabs';
import PlayoffScorersPanel, { type ScorerRow } from '@/components/PlayoffScorersPanel';

// Aggregate playoff_game_stats per player → leaderboard. Mirrors getCupScorers,
// but a playoff game is keyed by (series_number, game_number) rather than a
// single id. Playoff scoring is its own table — it never touches season totals.
async function getPlayoffScorers(season: string): Promise<ScorerRow[]> {
  const { data: stats } = await supabaseAdmin
    .from('playoff_game_stats')
    .select('player_id, series_number, game_number, points, three_pointers, fouls')
    .eq('season', season);

  type Totals = { games: Set<string>; points: number; three_pointers: number; fouls: number };
  const totals = new Map<string, Totals>();
  for (const r of (stats ?? []) as { player_id: string; series_number: number; game_number: number; points: number | null; three_pointers: number | null; fouls: number | null }[]) {
    const t = totals.get(r.player_id) ?? { games: new Set<string>(), points: 0, three_pointers: 0, fouls: 0 };
    t.games.add(`${r.series_number}-${r.game_number}`);
    t.points         += r.points         ?? 0;
    t.three_pointers += r.three_pointers ?? 0;
    t.fouls          += r.fouls          ?? 0;
    totals.set(r.player_id, t);
  }

  const playerIds = [...totals.keys()];
  if (playerIds.length === 0) return [];

  const { data: players } = await supabaseAdmin
    .from('players')
    .select('id, name, photo_url, jersey_number, team:teams(name)')
    .in('id', playerIds);

  return ((players ?? []) as unknown as {
    id: string; name: string; photo_url: string | null; jersey_number: number | null;
    team: { name: string } | null;
  }[])
    .map((p) => {
      const t = totals.get(p.id)!;
      return {
        id:             p.id,
        name:           p.name,
        photo_url:      p.photo_url,
        jersey_number:  p.jersey_number,
        team_name:      p.team?.name ?? null,
        games:          t.games.size,
        points:         t.points,
        three_pointers: t.three_pointers,
        fouls:          t.fouls,
      };
    })
    .filter((p) => p.points > 0 || p.three_pointers > 0 || p.fouls > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);
}

export default async function PlayoffStatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { viewing, current, isArchive } = await resolveSeasonFromParams(params);

  const [scorers, lang, seasons, { data: gamesData }, { data: seriesData }] = await Promise.all([
    getPlayoffScorers(viewing),
    getLang(),
    listKnownSeasons(),
    supabaseAdmin.from('playoff_games').select('played, home_score, away_score').eq('season', viewing),
    supabaseAdmin.from('playoff_series').select('series_number').eq('season', viewing),
  ]);

  const T = (he: string) => st(he, lang);
  const en = lang === 'en';
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  const gamesPlayed = ((gamesData ?? []) as { played: boolean | null; home_score: number | null; away_score: number | null }[])
    .filter((g) => g.played || (g.home_score !== null && g.away_score !== null)).length;
  const seriesCount = (seriesData ?? []).length;

  // The three summary tiles double as tabs, each showing its panel below.
  const tabs: StatTab[] = [
    {
      key: 'games',
      label: en ? 'Playoff games' : 'משחקי פלייאוף',
      value: String(gamesPlayed),
      accentClass: 'text-orange-400',
      barClass: 'bg-orange-400',
      panel: <PlayoffResults season={viewing} layout="series" />,
    },
    {
      key: 'players',
      label: T('שחקנים פעילים'),
      value: String(scorers.length),
      accentClass: 'text-sky-400',
      barClass: 'bg-sky-400',
      panel: <PlayoffScorersPanel scorers={scorers} />,
    },
    {
      key: 'series',
      label: en ? 'Series' : 'סדרות',
      value: String(seriesCount),
      accentClass: 'text-emerald-400',
      barClass: 'bg-emerald-400',
      panel: <PlayoffResults season={viewing} layout="table" />,
    },
  ];

  return (
    <div dir={dir} className="space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link href="/playoff" className="mb-2 inline-block text-xs text-[#5a7a9a] hover:text-orange-400 transition-colors">
            {en ? '← Back to Playoff' : '← חזרה לפלייאוף'}
          </Link>
          <h1 className="text-2xl font-black text-white flex items-center gap-2 font-heading">
            <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 inline-flex items-center"><PlayoffPlate size={18} /></span>
            {en ? 'Playoff Stats' : 'סטטיסטיקה פלייאוף'}
          </h1>
          <p className="text-sm font-bold text-[#8aaac8] mt-0.5 font-body">
            {en ? `Playoff scoring leaders — Season ${viewing}` : `מובילי הקליעה בפלייאוף — עונת ${viewing}`}
          </p>
        </div>
        <SeasonPicker current={current} viewing={viewing} seasons={seasons} />
      </div>

      {isArchive && <ArchiveBanner viewing={viewing} current={current} pathname="/playoff/stats" />}

      {/* Summary tiles double as tabs — the selected tile's panel shows below */}
      <PlayoffStatsTabs tabs={tabs} initialKey="games" />
    </div>
  );
}
