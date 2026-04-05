export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { LiveGame, LivePlayer } from '../live/page';
import ScoreboardClient from './ScoreboardClient';

// Re-export the types so ScoreboardClient can import from here too if needed
export type { LiveGame, LivePlayer };

// Helper to safely pick a single object out of Supabase join (which may return array or object)
function pick<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

export default async function ScoreboardPage() {
  const today = new Date().toISOString().split('T')[0];

  // 1. Find next upcoming round
  let targetRound: number | null = null;

  const { data: upcomingRows } = await supabaseAdmin
    .from('games')
    .select('round')
    .gte('game_date', today)
    .not('round', 'is', null)
    .order('game_date', { ascending: true })
    .limit(1);

  targetRound = (upcomingRows ?? [])[0]?.round ?? null;

  // 2. Fallback: most recent past round
  if (targetRound === null) {
    const { data: pastRows } = await supabaseAdmin
      .from('games')
      .select('round')
      .not('round', 'is', null)
      .order('game_date', { ascending: false })
      .limit(1);

    targetRound = (pastRows ?? [])[0]?.round ?? null;
  }

  // 3. Fetch games for target round
  let games: LiveGame[] = [];

  if (targetRound !== null) {
    const { data: rawGames } = await supabaseAdmin
      .from('games')
      .select(
        'id, game_date, game_time, round, home_team_id, away_team_id, home_team:teams!games_home_team_id_fkey(name,logo_url), away_team:teams!games_away_team_id_fkey(name,logo_url)'
      )
      .eq('round', targetRound)
      .order('game_date', { ascending: true });

    games = (rawGames ?? []).map((row: unknown) => {
      const r = row as {
        id: string;
        game_date: string;
        round: number;
        home_team_id: string;
        away_team_id: string;
        home_team: { name: string; logo_url: string | null } | { name: string; logo_url: string | null }[] | null;
        away_team: { name: string; logo_url: string | null } | { name: string; logo_url: string | null }[] | null;
      };
      const ht = pick(r.home_team);
      const at = pick(r.away_team);
      return {
        id: r.id,
        game_date: r.game_date,
        round: r.round,
        home_name: ht?.name ?? '',
        away_name: at?.name ?? '',
        home_logo: ht?.logo_url ?? null,
        away_logo: at?.logo_url ?? null,
        home_team_id: r.home_team_id,
        away_team_id: r.away_team_id,
      } satisfies LiveGame;
    });
  }

  // 4. Fetch players
  const { data: rawPlayers } = await supabaseAdmin
    .from('players')
    .select('name, jersey_number, team_id')
    .eq('is_active', true)
    .order('jersey_number', { nullsFirst: false });

  const players: LivePlayer[] = (rawPlayers ?? []) as LivePlayer[];

  return <ScoreboardClient games={games} players={players} currentRound={targetRound} />;
}
