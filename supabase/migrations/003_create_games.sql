-- Migration: Create games table
CREATE TYPE game_status AS ENUM ('Scheduled', 'Live', 'Finished');

CREATE TABLE games (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  home_team_id UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  game_date    DATE        NOT NULL,
  game_time    TIME        NOT NULL,
  location     TEXT        NOT NULL,
  home_score   INTEGER     NOT NULL DEFAULT 0,
  away_score   INTEGER     NOT NULL DEFAULT 0,
  status       game_status NOT NULL DEFAULT 'Scheduled',
  created_at   TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT different_teams CHECK (home_team_id <> away_team_id)
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "games_read_all" ON games
  FOR SELECT USING (true);
