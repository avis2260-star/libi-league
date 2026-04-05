export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import ScoreboardClient from './ScoreboardClient';

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

  // 2. Find the next upcoming round from LIBI_SCHEDULE
  const futureDates = LIBI_SCHEDULE.filter(g => g.date >= today);
  const nextRound = futureDates.length > 0
    ? Math.min(...futureDates.map(g => g.round))
    : Math.max(...LIBI_SCHEDULE.map(g => g.round));

  // 3. Get all games for that round
  const roundGames = LIBI_SCHEDULE.filter(g => g.round === nextRound);

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

  return (
    <ScoreboardClient
      games={games}
      players={players}
      currentRound={nextRound}
    />
  );
}
