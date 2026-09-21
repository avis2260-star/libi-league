-- ─────────────────────────────────────────────────────────────────────────────
-- Add a `round` column to the games table.
--
-- Until now the round a fixture belongs to was NOT stored — it was derived at
-- runtime from the hard-coded LIBI_SCHEDULE (2025-2026 only) by matching the
-- (home, away) team pair. That made every new season depend on a code change:
-- the app literally couldn't tell which round a 2026-2027 game belonged to.
--
-- This column moves the round into the database so the Excel schedule importer
-- can stamp it per game. The public schedule, scoreboard, live and admin round
-- groupings then read it directly, per season, with the hard-coded schedule
-- kept only as a fallback for rows whose round is still NULL (the 2025-2026
-- archive). Nothing is deleted or rewritten; existing rows simply keep NULL and
-- continue to resolve their round through LIBI_SCHEDULE exactly as before.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS round integer;

-- A season's schedule is queried as "all games for this season that carry a
-- round", so index the pair.
CREATE INDEX IF NOT EXISTS games_season_round_idx ON games(season, round);
