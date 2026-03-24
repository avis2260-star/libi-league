import { createClient } from '@supabase/supabase-js';
import type { Game, GameStatWithGame, Player, PlayerWithTeam, Standing, Team } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Teams ────────────────────────────────────────────────────────────────────

export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select('*').order('name');
  if (error) throw error;
  return data;
}

// ── Players ──────────────────────────────────────────────────────────────────

export async function getPlayersByTeam(teamId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*, team:teams(*)')
    .eq('team_id', teamId)
    .order('jersey_number');
  if (error) throw error;
  return data;
}

// ── Games ────────────────────────────────────────────────────────────────────

export async function getUpcomingGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
    .eq('status', 'Scheduled')
    .gte('game_date', new Date().toISOString().split('T')[0])
    .order('game_date')
    .order('game_time');
  if (error) throw error;
  return data;
}

export async function getLiveGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
    .eq('status', 'Live');
  if (error) throw error;
  return data;
}

export async function getRecentGames(limit = 10): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
    .eq('status', 'Finished')
    .order('game_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getAllPlayers(): Promise<PlayerWithTeam[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*, team:teams(*)')
    .order('name');
  if (error) throw error;
  return data as PlayerWithTeam[];
}

export async function getPlayerById(id: string): Promise<PlayerWithTeam | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*, team:teams(*)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as PlayerWithTeam;
}

export async function getPlayerGameStats(playerId: string): Promise<GameStatWithGame[]> {
  const { data, error } = await supabase
    .from('game_stats')
    .select(`
      id, game_id, player_id, team_id, points, three_pointers, fouls,
      game:games (
        id, game_date, game_time, home_score, away_score,
        home_team_id, away_team_id, status, video_url,
        home_team:teams!games_home_team_id_fkey (name, logo_url),
        away_team:teams!games_away_team_id_fkey (name, logo_url)
      )
    `)
    .eq('player_id', playerId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Sort chronologically by game date client-side (join ordering is unreliable)
  return (data as unknown as GameStatWithGame[]).sort(
    (a, b) => a.game.game_date.localeCompare(b.game.game_date),
  );
}

// ── Standings ────────────────────────────────────────────────────────────────

export async function getStandings(): Promise<Standing[]> {
  const { data, error } = await supabase.from('standings').select('*');
  if (error) throw error;
  return data;
}
