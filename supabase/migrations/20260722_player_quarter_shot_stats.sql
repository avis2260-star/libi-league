-- Per-player per-quarter points + shot-type split (free throws / 2s / 3s),
-- read from the official "סיכום" scoresheet. three_pointers already exists;
-- these add the rest so the box score can show a per-quarter breakdown and the
-- 2pt/3pt made counts. All nullable — old rows stay valid, columns only fill on
-- the next scoresheet (re-)import.

ALTER TABLE playoff_game_stats
  ADD COLUMN IF NOT EXISTS quarter_points integer[],
  ADD COLUMN IF NOT EXISTS two_pointers   integer,
  ADD COLUMN IF NOT EXISTS free_throws    integer;

ALTER TABLE cup_game_stats
  ADD COLUMN IF NOT EXISTS quarter_points integer[],
  ADD COLUMN IF NOT EXISTS two_pointers   integer,
  ADD COLUMN IF NOT EXISTS free_throws    integer;

ALTER TABLE game_stats
  ADD COLUMN IF NOT EXISTS quarter_points integer[],
  ADD COLUMN IF NOT EXISTS two_pointers   integer,
  ADD COLUMN IF NOT EXISTS free_throws    integer;
