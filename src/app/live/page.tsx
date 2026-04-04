export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import LiveClient from './LiveClient';

export type LiveGame = {
  id: string;
  game_date: string;
  game_time: string | null;
  round: number | null;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
  home_team_id: string;
  away_team_id: string;
};

export type LivePlayer = {
  name: string;
  jersey_number: number | null;
  team_id: string;
};

export default async function LivePage() {
  const today = new Date().toISOString().split('T')[0];

  // Find the next upcoming round (closest future game_date)
  const { data: nextRows } = await supabaseAdmin
    .from('games')
    .select('round')
    .gte('game_date', today)
    .not('round', 'is', null)
    .order('game_date', { ascending: true })
    .limit(1);

  let targetRound: number | null = nextRows?.[0]?.round ?? null;

  if (targetRound === null) {
    // All games are in the past — use the most recent round
    const { data: lastRows } = await supabaseAdmin
      .from('games')
      .select('round')
      .not('round', 'is', null)
      .order('game_date', { ascending: false })
      .limit(1);
    targetRound = lastRows?.[0]?.round ?? null;
  }

  // Fetch all games from that round (regardless of status)
  const { data: rawGames } = targetRound !== null
    ? await supabaseAdmin
        .from('games')
        .select(`
          id, game_date, game_time, round,
          home_team_id, away_team_id,
          home_team:teams!games_home_team_id_fkey(name, logo_url),
          away_team:teams!games_away_team_id_fkey(name, logo_url)
        `)
        .eq('round', targetRound)
        .order('game_date', { ascending: true })
    : { data: [] };

  type RawGame = {
    id: string; game_date: string; game_time: string | null; round: number | null;
    home_team_id: string; away_team_id: string;
    home_team: { name: string; logo_url: string | null } | { name: string; logo_url: string | null }[] | null;
    away_team: { name: string; logo_url: string | null } | { name: string; logo_url: string | null }[] | null;
  };

  function pick(t: RawGame['home_team']): { name: string; logo_url: string | null } {
    if (!t) return { name: '', logo_url: null };
    if (Array.isArray(t)) return t[0] ?? { name: '', logo_url: null };
    return t;
  }

  const games: LiveGame[] = ((rawGames ?? []) as unknown as RawGame[]).map((g) => ({
    id: g.id,
    game_date: g.game_date,
    game_time: g.game_time,
    round: g.round,
    home_team_id: g.home_team_id,
    away_team_id: g.away_team_id,
    home_name: pick(g.home_team).name || 'בית',
    away_name: pick(g.away_team).name || 'חוץ',
    home_logo: pick(g.home_team).logo_url,
    away_logo: pick(g.away_team).logo_url,
  }));

  // Fetch all active players (name + jersey + team_id)
  const { data: rawPlayers } = await supabaseAdmin
    .from('players')
    .select('name, jersey_number, team_id')
    .eq('is_active', true)
    .order('jersey_number', { nullsFirst: false });

  const players: LivePlayer[] = (rawPlayers ?? []) as LivePlayer[];

  return <LiveClient games={games} players={players} currentRound={targetRound} />;
}
