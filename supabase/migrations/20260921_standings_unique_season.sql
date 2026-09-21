-- ─────────────────────────────────────────────────────────────────────────────
-- Make the standings unique constraint season-aware.
--
-- The standings table had a UNIQUE (name, division) constraint
-- (`standings_name_division_key`) created before the league went multi-season.
-- The 20260521 season migration added a `season` column but only extended the
-- unique constraints on playoff_games / playoff_series — standings was missed.
--
-- The result: once one season's standings exist, syncing / seeding a SECOND
-- season fails with
--   "standings insert: duplicate key value violates unique constraint
--    standings_name_division_key"
-- because the same (name, division) pair already exists for the prior season.
--
-- Fix: drop any UNIQUE/PK on exactly (name, division) and replace it with one
-- that includes season, so a team can appear once PER SEASON. Idempotent and
-- safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  con_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'standings') THEN

    -- Drop any UNIQUE/PK defined on EXACTLY (name, division), in any order.
    FOR con_name IN
      SELECT c.conname
      FROM   pg_constraint c
      WHERE  c.conrelid = 'public.standings'::regclass
        AND  c.contype IN ('u', 'p')
        AND  array_length(c.conkey, 1) = 2
        AND  (SELECT count(*) FROM unnest(c.conkey) k
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
              WHERE a.attname IN ('name', 'division')) = 2
    LOOP
      EXECUTE format('ALTER TABLE standings DROP CONSTRAINT %I', con_name);
    END LOOP;

    -- Add the season-aware unique constraint (only if it isn't there already).
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE  conname = 'standings_name_division_season_key'
    ) THEN
      EXECUTE 'ALTER TABLE standings
               ADD CONSTRAINT standings_name_division_season_key
               UNIQUE (name, division, season)';
    END IF;
  END IF;
END $$;
