export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSeasonSchedule } from '@/lib/season-schedule';
import { roundDatesForSeason } from '@/lib/schedule-format';
import ScoreboardClient from './ScoreboardClient';
import { getLang } from '@/lib/get-lang';
import { getCurrentSeason } from '@/lib/current-season';

export type ScoreboardGame = {
  id: string;
  round: number;
  game_date: string;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
  home_team_id: string;
  away_team_id: string;
};

export type ScoreboardPlayer = {
  name: string;
  jersey_number: number | null;
  team_id: string;
};

function normName(n: string) {
  return n.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export default async function ScoreboardPage() {
  const today = new Date().toISOString().split('T')[0];
  const season = await getCurrentSeason();

  // 1. Get all teams with id + logo from DB
  const { data: teamsData } = await supabaseAdmin
    .from('teams')
    .select('id, name, logo_url');

  const teamsByName = new Map<string, { id: string; logo: string | null }>();
  for (const t of teamsData ?? []) {
    teamsByName.set(normName(t.name), { id: t.id, logo: t.logo_url ?? null });
  }

  function findTeam(name: string) {
    return teamsByName.get(normName(name)) ?? { id: '', logo: null };
  }

  // 2. Find next round: last round with recorded results + 1
  const { data: lastResultRow } = await supabaseAdmin
    .from('game_results')
    .select('round')
    .eq('season', season)
    .order('round', { ascending: false })
    .limit(1);

  const schedule = await getSeasonSchedule(season);
  const lastResultRound = lastResultRow?.[0]?.round ?? 0;
  const maxRound = schedule.length > 0 ? Math.max(...schedule.map(g => g.round)) : lastResultRound + 1;
  const nextRound = Math.min(lastResultRound + 1, maxRound);

  // 3. Get all games for that round
  const roundGames = schedule.filter(g => g.round === nextRound);

  const games: ScoreboardGame[] = roundGames.map(g => {
    const ht = findTeam(g.homeTeam);
    const at = findTeam(g.awayTeam);
    return {
      id: `${g.round}-${g.homeTeam}-${g.awayTeam}`,
      round: g.round,
      game_date: g.date,
      home_name: g.homeTeam,
      away_name: g.awayTeam,
      home_logo: ht.logo,
      away_logo: at.logo,
      home_team_id: ht.id,
      away_team_id: at.id,
    };
  });

  // 3b. Round date: the DB round_dates the last sync wrote, else this season's
  // own schedule date (never another season's calendar).
  let roundDate = roundDatesForSeason(season, schedule)[nextRound] ?? '';
  try {
    const { data: rdData } = await supabaseAdmin
      .from('league_settings').select('value').eq('key', 'round_dates').maybeSingle();
    if (rdData?.value) {
      const parsed = JSON.parse(rdData.value) as Record<string, string>;
      roundDate = parsed[String(nextRound)] ?? roundDate;
    }
  } catch { /* use fallback */ }

  // 4. Fetch players only for teams in this round
  const teamIds = [...new Set(
    games.flatMap(g => [g.home_team_id, g.away_team_id]).filter(Boolean)
  )];

  const { data: rawPlayers } = teamIds.length > 0
    ? await supabaseAdmin
        .from('players')
        .select('name, jersey_number, team_id')
        .in('team_id', teamIds)
        .eq('is_active', true)
        .order('jersey_number', { nullsFirst: false })
    : { data: [] };

  const players: ScoreboardPlayer[] = (rawPlayers ?? []) as ScoreboardPlayer[];

  const lang = await getLang();

  return (
    <ScoreboardClient
      games={games}
      players={players}
      currentRound={nextRound}
      roundDate={roundDate}
      initialLang={lang}
    />
  );
}
