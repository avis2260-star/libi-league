-- ─────────────────────────────────────────────────────────────────────────────
-- Dedupe duplicate games rows (orphaned Scheduled rows from Excel re-syncs)
--
-- The games table can accumulate multiple rows for the same matchup over
-- time (the Excel sync inserts a new row when the date drifts even by a
-- day, leaving the old "Scheduled" row behind). This migration:
--
--   1. Identifies all (home_team_id, away_team_id) pairs with > 1 row
--   2. Picks the canonical "keeper" per pair — preferring:
--        a) status = 'Finished'
--        b) highest total score (real played games beat 0:0 placeholders)
--        c) most recent created_at (latest sync wins among ties)
--   3. Reassigns child rows from the duplicates to the keeper:
--        • game_stats: if keeper already has a row for the same player,
--          drop the duplicate to avoid the UNIQUE(game_id,player_id) clash
--        • game_submissions: if keeper already has a submission for the
--          same submitter, drop the duplicate (best-effort; rare in practice)
--   4. Deletes the duplicate games rows
--
-- Re-runnable: if no duplicates exist, this is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TEMP TABLE _dup_games AS
SELECT duplicate_id, keeper_id FROM (
  SELECT
    id AS duplicate_id,
    FIRST_VALUE(id) OVER w AS keeper_id,
    ROW_NUMBER()  OVER w AS rn
  FROM games
  WINDOW w AS (
    PARTITION BY home_team_id, away_team_id
    ORDER BY
      CASE WHEN status = 'Finished' THEN 0 ELSE 1 END,
      (COALESCE(home_score, 0) + COALESCE(away_score, 0)) DESC,
      created_at DESC NULLS LAST,
      id
  )
) r
WHERE rn > 1;

-- Echo how many rows we're about to consolidate (visible in Supabase logs)
DO $$
DECLARE
  c INT;
BEGIN
  SELECT COUNT(*) INTO c FROM _dup_games;
  RAISE NOTICE 'Found % duplicate games row(s) to remove', c;
END $$;

-- ── game_stats ────────────────────────────────────────────────────────────
-- For each (keeper, player) we want to end up with the BEST stats across
-- all duplicate rows for that player. Otherwise simply "keeping the keeper"
-- can lose data when the keeper had 0/0/0 and a duplicate had real numbers.
--
-- Strategy: take the max value across all duplicate rows + the keeper's
-- own existing row, write that into the keeper, then delete the loser
-- rows.

-- 1. Pick best stats per (keeper_id, player_id) across keeper + losers
CREATE TEMP TABLE _best_stats AS
SELECT
  d.keeper_id            AS game_id,
  gs.player_id,
  MAX(gs.team_id)        AS team_id,
  MAX(gs.points)         AS points,
  MAX(gs.three_pointers) AS three_pointers,
  MAX(gs.fouls)          AS fouls
FROM game_stats gs
JOIN _dup_games d
  ON gs.game_id = d.duplicate_id OR gs.game_id = d.keeper_id
GROUP BY d.keeper_id, gs.player_id;

-- 2. Delete every duplicate-and-keeper game_stats row for the affected pairs
--    (we'll re-insert from _best_stats next, with the merged values).
DELETE FROM game_stats gs
USING _dup_games d
WHERE gs.game_id IN (d.duplicate_id, d.keeper_id);

-- 3. Re-insert the merged stats onto the keeper game
INSERT INTO game_stats (game_id, player_id, team_id, points, three_pointers, fouls)
SELECT game_id, player_id, team_id, points, three_pointers, fouls
FROM _best_stats;

DROP TABLE _best_stats;

-- ── game_submissions ─────────────────────────────────────────────────────
-- Best-effort reassignment. If your game_submissions table has a UNIQUE
-- constraint on game_id (or game_id,submitter), the conflicting rows are
-- left attached to the duplicate game and will be removed by CASCADE in
-- the final DELETE below.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='game_submissions') THEN
    EXECUTE $sql$
      UPDATE game_submissions gs
      SET game_id = d.keeper_id
      FROM _dup_games d
      WHERE gs.game_id = d.duplicate_id
        AND NOT EXISTS (
          SELECT 1 FROM game_submissions ks
          WHERE ks.game_id = d.keeper_id
            AND ks.submitted_by = gs.submitted_by
        );
    $sql$;
  END IF;
END $$;

-- ── Final delete ─────────────────────────────────────────────────────────
DELETE FROM games WHERE id IN (SELECT duplicate_id FROM _dup_games);

DROP TABLE _dup_games;

COMMIT;
