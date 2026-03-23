-- Migration: Admin additions
-- 1. Add video_url to games
-- 2. Create game_stats table for per-game box scores
-- 3. Add write policies for authenticated admins

-- ── games ────────────────────────────────────────────────────────────────────

ALTER TABLE games ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Allow authenticated users to update game records
CREATE POLICY "games_update_auth" ON games
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── game_stats ───────────────────────────────────────────────────────────────
-- Stores individual player stats per game (box score).
-- Season totals on the players table remain for aggregate display;
-- this table is the source of truth for per-game data.

CREATE TABLE IF NOT EXISTS game_stats (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id        UUID    NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
  player_id      UUID    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id        UUID    NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
  points         INTEGER NOT NULL DEFAULT 0,
  three_pointers INTEGER NOT NULL DEFAULT 0,
  fouls          INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (game_id, player_id)
);

ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_stats_read_all" ON game_stats
  FOR SELECT USING (true);

CREATE POLICY "game_stats_manage_auth" ON game_stats
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
