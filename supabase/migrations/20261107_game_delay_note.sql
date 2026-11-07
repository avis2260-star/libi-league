-- A short note on a postponed game (משחק דחוי) — why it was postponed or
-- stopped, e.g. "הופסק בגלל מזג האוויר". Set in the admin games tab next to
-- the "delayed" toggle and shown to fans wherever the postponed game appears
-- (the home page's delayed-games strip and the game's own page). NULL = no
-- note, so every existing row keeps its current behaviour.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS delay_note text;

COMMENT ON COLUMN public.games.delay_note IS
  'Optional public note on a delayed game (the reason it was postponed or stopped). Shown only while the game is flagged delayed.';
