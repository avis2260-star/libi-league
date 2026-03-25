-- 1. Seasons
CREATE TABLE IF NOT EXISTS seasons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  year text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);

-- 2. Officials
CREATE TABLE IF NOT EXISTS officials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('referee', 'scorekeeper')),
  phone text,
  email text,
  created_at timestamptz DEFAULT now()
);

-- 3. Disciplinary Records
CREATE TABLE IF NOT EXISTS disciplinary_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  team_name text,
  type text NOT NULL CHECK (type IN ('technical', 'unsportsmanlike', 'ejection')),
  round integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. League Settings
CREATE TABLE IF NOT EXISTS league_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO league_settings (key, value) VALUES
  ('points_per_win', '2'),
  ('points_per_loss', '1'),
  ('tiebreaker', 'head_to_head'),
  ('max_fouls_per_player', '5'),
  ('period_length_minutes', '10'),
  ('periods_per_game', '4'),
  ('technical_suspension_threshold', '5')
ON CONFLICT (key) DO NOTHING;

-- 5. Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  type text DEFAULT 'ticker' CHECK (type IN ('ticker', 'banner')),
  active boolean DEFAULT true,
  bg_color text DEFAULT 'orange',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- 6. Sync Log
CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_at timestamptz DEFAULT now(),
  filename text,
  north_count integer DEFAULT 0,
  south_count integer DEFAULT 0,
  results_count integer DEFAULT 0,
  snapshot_standings jsonb,
  snapshot_results jsonb,
  is_rolled_back boolean DEFAULT false
);

-- 7. Cup/Trophy Tournament
CREATE TABLE IF NOT EXISTS cup_games (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  round text NOT NULL,
  round_order integer NOT NULL DEFAULT 1,
  game_number integer NOT NULL DEFAULT 1,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_score integer,
  away_score integer,
  date text,
  played boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
