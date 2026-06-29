-- Optional tip-off time per cup_games + playoff_games row.
-- Mirrors games.game_time (migration 003), but nullable since playoff/cup
-- dates are often TBD. Stored as TIME ("HH:MM"); the admin tabs fill it and
-- the public upcoming-games views show it next to the date when present.

ALTER TABLE public.cup_games     ADD COLUMN IF NOT EXISTS game_time TIME;
ALTER TABLE public.playoff_games ADD COLUMN IF NOT EXISTS game_time TIME;

COMMENT ON COLUMN public.cup_games.game_time     IS 'Optional tip-off time for the cup game.';
COMMENT ON COLUMN public.playoff_games.game_time IS 'Optional tip-off time for the playoff game.';
