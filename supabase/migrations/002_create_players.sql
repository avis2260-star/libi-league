-- Migration: Create players table
CREATE TABLE players (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT    NOT NULL,
  team_id        UUID    REFERENCES teams(id) ON DELETE SET NULL,
  jersey_number  INTEGER,
  position       TEXT    CHECK (position IN ('PG', 'SG', 'SF', 'PF', 'C')),
  -- Career / season stats
  points         INTEGER NOT NULL DEFAULT 0,
  fouls          INTEGER NOT NULL DEFAULT 0,
  three_pointers INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_read_all" ON players
  FOR SELECT USING (true);
