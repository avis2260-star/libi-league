-- Per-game "delayed / postponed" flag (משחק דחוי).
--
-- A delayed game is one that belongs to a round but wasn't played on time. When
-- flagged it keeps surfacing on the public home page — as a pending card while
-- unplayed, and (once Finished) as a result tagged with its round — instead of
-- silently disappearing the way a normal past-round game would. Defaults to
-- false so every existing row keeps its current behaviour.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS delayed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.games.delayed IS
  'When true, the game is treated as postponed/makeup: it stays on the public home page (pending card, then result tagged with its round) until played and out of the recency window.';

-- Partial index: the home page only ever queries the handful of delayed rows
-- per season, so index just those.
CREATE INDEX IF NOT EXISTS idx_games_delayed
  ON public.games (season)
  WHERE delayed = true;
