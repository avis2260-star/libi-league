export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { LiveGame, LivePlayer } from '../live/page';
import ScoreboardClient from './ScoreboardClient';

export type { LiveGame, LivePlayer };

function pick<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

type RawGame = {
  id: string;
  game_date: string;
  round: number | null;
  home_team_id: string;
  away_team_id: string;
  home_team: { name: string; logo_url: string | null } | { name: string; logo_url: string | null }[] | null;
  away_team: { name: string; logo_url: string | null } | { name: string; logo_url: string | null }[] | null;
};

function mapGame(r: RawGame): LiveGame {
  const ht = pick(r.home_team);
  const at = pick(r.away_team);
  return {
    id: r.id,
    game_date: r.game_date,

    round: r.round ?? null,
    home_name: ht?.name ?? '',
    away_name: at?.name ?? '',
    home_logo: ht?.logo_url ?? null,
    away_logo: at?.logo_url ?? null,
    home_team_id: r.home_team_id,
    away_team_id: r.away_team_id,
  };
}

const GAME_SELECT = `
  id, game_date, round, home_team_id, away_team_id,
  home_team:teams!games_home_team_id_fkey(name, logo_url),
  away_team:teams!games_away_team_id_fkey(name, logo_url)
`;

export default async function ScoreboardPage() {
  const today = new Date().toISOString().split('T')[0];
  let games: LiveGame[] = [];
  let currentRound: number | null = null;

  // 1. Try: next upcoming round (with non-null round)
  const { data: upcomingRows } = await supabaseAdmin
    .from('games').select('round').gte('game_date', today)
    .not('round', 'is', null).order('game_date', { ascending: true }).limit(1);
  currentRound = (upcomingRows ?? [])[0]?.round ?? null;

  // 2. Fallback: most recent past round (with non-null round)
  if (currentRound === null) {
    const { data: pastRows } = await supabaseAdmin
      .from('games').select('round').not('round', 'is', null)
      .order('game_date', { ascending: false }).limit(1);
    currentRound = (pastRows ?? [])[0]?.round ?? null;
  }

  // 3. If we have a round, fetch its games
  if (currentRound !== null) {
    const { data } = await supabaseAdmin
      .from('games').select(GAME_SELECT)
      .eq('round', currentRound).order('game_date', { ascending: true });
    games = ((data ?? []) as unknown as RawGame[]).map(mapGame);
  }

  // 4. Final fallback: round column is null for all games — just return all games
  if (games.length === 0) {
    const { data } = await supabaseAdmin
      .from('games').select(GAME_SELECT)
      .order('game_date', { ascending: false }).limit(30);
    games = ((data ?? []) as unknown as RawGame[]).map(mapGame);
    // Group by a pseudo-round using the most recent unique date cluster
    if (games.length > 0) {
      // Show only games from the nearest date cluster (within 7 days of the first)
      const firstDate = games[0].game_date;
      const cutoff = new Date(firstDate);
      cutoff.setDate(cutoff.getDate() + 7);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const cluster = games.filter(g => g.game_date >= firstDate && g.game_date <= cutoffStr);
      games = cluster.length > 0 ? cluster : games.slice(0, 8);
    }
  }

  // 5. Fetch all active players
  const { data: rawPlayers } = await supabaseAdmin
    .from('players').select('name, jersey_number, team_id')
    .eq('is_active', true).order('jersey_number', { nullsFirst: false });

  const players: LivePlayer[] = (rawPlayers ?? []) as LivePlayer[];

  return <ScoreboardClient games={games} players={players} currentRound={currentRound} />;
}
