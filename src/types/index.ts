export type GameStatus = 'Scheduled' | 'Live' | 'Finished';

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  captain_name: string;
  contact_info: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  name: string;
  team_id: string | null;
  jersey_number: number | null;
  position: Position | null;
  photo_url: string | null;
  points: number;
  fouls: number;
  three_pointers: number;
  created_at: string;
  is_active?: boolean;
  // Joined
  team?: Team;
}

export interface Game {
  id: string;
  home_team_id: string;
  away_team_id: string;
  game_date: string;   // ISO date string, e.g. "2026-04-05"
  game_time: string;   // HH:MM string, e.g. "18:30"
  location: string;
  home_score: number;
  away_score: number;
  status: GameStatus;
  created_at: string;
  // Joined
  home_team?: Team;
  away_team?: Team;
}

export interface GameStat {
  id: string;
  game_id: string;
  player_id: string;
  team_id: string;
  points: number;
  three_pointers: number;
  fouls: number;
  created_at: string;
  // Joined
  player?: Player;
}

export interface GameWithTeams extends Game {
  home_team: Team;
  away_team: Team;
  video_url?: string | null;
}

// Lightweight team shape used inside joined queries
export interface TeamMini {
  name: string;
  logo_url: string | null;
}

// game_stats row with its parent game fully joined (used on player profile)
export interface GameStatWithGame {
  id: string;
  game_id: string;
  player_id: string;
  team_id: string;
  points: number;
  three_pointers: number;
  fouls: number;
  game: {
    id: string;
    game_date: string;
    game_time: string;
    home_score: number;
    away_score: number;
    home_team_id: string;
    away_team_id: string;
    status: GameStatus;
    video_url: string | null;
    home_team: TeamMini;
    away_team: TeamMini;
  };
}

// Player with team joined (used on player profile & listing)
export interface PlayerWithTeam extends Player {
  team: Team;
}

export interface Standing {
  id: string;
  name: string;
  logo_url: string | null;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  total_points: number;
}
