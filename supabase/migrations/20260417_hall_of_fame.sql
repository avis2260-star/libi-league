CREATE TABLE IF NOT EXISTS league_history_seasons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year        text NOT NULL,           -- e.g. "2024-2025"
  champion_name    text,
  champion_logo    text,
  champion_captain text,
  mvp_name    text,
  mvp_stats   text,                   -- e.g. "24.5 PPG"
  is_current  boolean DEFAULT false,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_history_records (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title    text NOT NULL,             -- "שיא נקודות למשחק"
  holder   text,                      -- "ראשון גפן"
  value    text,                      -- "99"
  record_date date,
  sort_order int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
