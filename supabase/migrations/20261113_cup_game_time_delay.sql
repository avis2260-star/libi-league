-- Cup games: a start time, and the same "postponed" flag + public note the
-- league games have (games.delayed / games.delay_note).
--
--   game_time  — 'HH:MM' text, like cup_games.date is text. NULL = not set.
--   delayed    — the game was postponed / stopped and will be made up.
--   delay_note — why (e.g. "הופסק בגלל מזג האוויר"); shown while delayed.
--
-- All default to "nothing set", so every existing row keeps its behaviour.

ALTER TABLE public.cup_games
  ADD COLUMN IF NOT EXISTS game_time  text,
  ADD COLUMN IF NOT EXISTS delayed    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delay_note text;

COMMENT ON COLUMN public.cup_games.game_time  IS 'Start time, HH:MM. NULL = not set yet.';
COMMENT ON COLUMN public.cup_games.delayed    IS 'Postponed / stopped cup game awaiting a make-up date.';
COMMENT ON COLUMN public.cup_games.delay_note IS 'Optional public note on a delayed cup game; shown only while delayed.';
