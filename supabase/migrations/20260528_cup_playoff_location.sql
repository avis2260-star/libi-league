-- Optional venue / location per cup_games + playoff_games row.
-- Mirrors games.location (migration 003). A nullable TEXT column the admin
-- fills from the cup/playoff admin tabs; the public per-game and bracket
-- views show it when present.

ALTER TABLE public.cup_games     ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.playoff_games ADD COLUMN IF NOT EXISTS location TEXT;

COMMENT ON COLUMN public.cup_games.location     IS 'Optional venue / location for the cup game.';
COMMENT ON COLUMN public.playoff_games.location IS 'Optional venue / location for the playoff game.';
