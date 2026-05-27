-- Optional YouTube/video link per cup_games + playoff_games row.
-- Mirrors migration 005 (games.video_url): a nullable TEXT column the admin
-- can fill from the cup/playoff admin tabs. The public per-game pages
-- (/cup/game/[id], /playoff/series/[num]) render a "Watch Video" CTA
-- whenever the column is non-null.

ALTER TABLE public.cup_games     ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.playoff_games ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN public.cup_games.video_url     IS 'Optional YouTube / external video link for the cup game.';
COMMENT ON COLUMN public.playoff_games.video_url IS 'Optional YouTube / external video link for the playoff game.';
