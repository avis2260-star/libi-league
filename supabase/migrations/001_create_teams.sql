-- Migration: Create teams table
CREATE TABLE teams (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  logo_url    TEXT,
  captain_name TEXT       NOT NULL,
  contact_info TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public read access (adjust to your RLS policy)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_read_all" ON teams
  FOR SELECT USING (true);
