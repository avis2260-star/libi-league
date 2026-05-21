-- ─────────────────────────────────────────────────────────────────────────────
-- Add a `season` column to every operational table + a `current_season`
-- setting that controls what the admin and public site display by default.
--
-- Approach: nothing is ever deleted or overwritten. Each row carries the
-- season it belongs to. A "התחל עונה חדשה" button just flips the
-- `current_season` value in league_settings; old rows stay visible in any
-- archive view we add later, and every list query simply filters on
-- season = current_season.
--
-- Tables touched:
--   games, game_results, game_stats, cup_games,
--   playoff_games, playoff_series, standings,
--   disciplinary_records, game_submissions, sync_logs
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. current_season setting ────────────────────────────────────────────────
-- Seed with the current league season ('2025-2026') if not already present.
INSERT INTO league_settings (key, value)
VALUES ('current_season', '2025-2026')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Helper: add season column with backfill in a single statement ─────────
-- DEFAULT '2025-2026' means existing rows backfill automatically when the
-- column is added (Postgres rewrites them with the default), and any future
-- INSERT that forgets to set season still falls into the seeded season —
-- safe by construction. We tighten to NOT NULL right after so admins can't
-- accidentally write a NULL season later.

ALTER TABLE games               ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2025-2026';
ALTER TABLE game_stats          ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2025-2026';
ALTER TABLE cup_games           ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2025-2026';
ALTER TABLE disciplinary_records ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2025-2026';
ALTER TABLE sync_logs           ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2025-2026';

-- game_results / standings / playoff_* may or may not exist yet depending on
-- which deployments the migration runs against (they were added incrementally).
-- Use a DO block + IF EXISTS check so this migration is safe to run on a
-- partial schema.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='game_results') THEN
    EXECUTE 'ALTER TABLE game_results ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT ''2025-2026''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='standings') THEN
    EXECUTE 'ALTER TABLE standings ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT ''2025-2026''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='playoff_series') THEN
    EXECUTE 'ALTER TABLE playoff_series ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT ''2025-2026''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='playoff_games') THEN
    EXECUTE 'ALTER TABLE playoff_games ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT ''2025-2026''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='game_submissions') THEN
    EXECUTE 'ALTER TABLE game_submissions ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT ''2025-2026''';
  END IF;
END $$;

-- ── 3. Indexes ──────────────────────────────────────────────────────────────
-- Every list query filters on season, often combined with another column.
-- Single-column indexes keep the change small; combine-index later if needed.

CREATE INDEX IF NOT EXISTS games_season_idx               ON games(season);
CREATE INDEX IF NOT EXISTS game_stats_season_idx          ON game_stats(season);
CREATE INDEX IF NOT EXISTS cup_games_season_idx           ON cup_games(season);
CREATE INDEX IF NOT EXISTS disciplinary_records_season_idx ON disciplinary_records(season);
CREATE INDEX IF NOT EXISTS sync_logs_season_idx           ON sync_logs(season);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='game_results') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS game_results_season_idx ON game_results(season)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='standings') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS standings_season_idx ON standings(season)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='playoff_series') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS playoff_series_season_idx ON playoff_series(season)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='playoff_games') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS playoff_games_season_idx ON playoff_games(season)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='game_submissions') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS game_submissions_season_idx ON game_submissions(season)';
  END IF;
END $$;

-- ── 4. Extend unique constraints to include season ───────────────────────────
-- playoff_games has UNIQUE (series_number, game_number). An upsert from the
-- admin Playoff tab keyed on those two columns would overwrite a prior-season
-- row the first time someone enters a score for the new season — silent data
-- loss. We drop the old constraint (whatever Postgres auto-named it) and
-- replace it with one that includes season. Same defensive treatment for
-- playoff_series.

DO $$
DECLARE
  con_name text;
BEGIN
  -- playoff_games: drop any UNIQUE/PK on EXACTLY (series_number, game_number)
  -- in any order, with no other columns. The earlier version of this block
  -- compared conkey against attnum-sorted arrays, which silently missed
  -- constraints when the columns weren't defined in attnum order. The
  -- order-independent version below uses set membership + length.
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='playoff_games') THEN
    FOR con_name IN
      SELECT c.conname
      FROM   pg_constraint c
      WHERE  c.conrelid = 'public.playoff_games'::regclass
        AND  c.contype IN ('u','p')
        AND  array_length(c.conkey, 1) = 2
        AND  (SELECT count(*) FROM unnest(c.conkey) k
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
              WHERE a.attname IN ('series_number','game_number')) = 2
    LOOP
      EXECUTE format('ALTER TABLE playoff_games DROP CONSTRAINT %I', con_name);
    END LOOP;

    -- Add the season-aware unique constraint (idempotent — only if missing).
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE  conname = 'playoff_games_season_series_game_key'
    ) THEN
      EXECUTE 'ALTER TABLE playoff_games
               ADD CONSTRAINT playoff_games_season_series_game_key
               UNIQUE (season, series_number, game_number)';
    END IF;
  END IF;

  -- playoff_series: same defensive treatment — any single-column unique on
  -- series_number alone gets dropped and replaced with (season, series_number).
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='playoff_series') THEN
    FOR con_name IN
      SELECT c.conname
      FROM   pg_constraint c
      WHERE  c.conrelid = 'public.playoff_series'::regclass
        AND  c.contype = 'u'
        AND  array_length(c.conkey, 1) = 1
        AND  (SELECT count(*) FROM unnest(c.conkey) k
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
              WHERE a.attname = 'series_number') = 1
    LOOP
      EXECUTE format('ALTER TABLE playoff_series DROP CONSTRAINT %I', con_name);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE  conname = 'playoff_series_season_series_key'
    ) THEN
      EXECUTE 'ALTER TABLE playoff_series
               ADD CONSTRAINT playoff_series_season_series_key
               UNIQUE (season, series_number)';
    END IF;
  END IF;
END $$;
