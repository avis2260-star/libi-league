-- ─────────────────────────────────────────────────────────────────────────────
-- Consolidate per-game stats into the existing game_stats table.
--
-- The 20260504_player_game_stats.sql migration introduced player_game_stats
-- not realizing migration 005 already created game_stats with the same
-- schema (and that the player profile page was already reading from it).
-- This migration:
--   1. Copies any data the admin entered into player_game_stats over to
--      game_stats (no-op if player_game_stats was unused).
--   2. Drops player_game_stats and its helper trigger / function.
--
-- After this runs, game_stats is the single source of truth for per-game
-- per-player stats — written by the new admin "סטטיסטיקה לפי משחק" tab
-- and read by the player profile, box score, and admin tab itself.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1 — copy rows over (only runs if the source table still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'player_game_stats'
  ) THEN
    INSERT INTO game_stats (game_id, player_id, team_id, points, three_pointers, fouls)
    SELECT pgs.game_id, pgs.player_id, p.team_id,
           pgs.points, pgs.three_pointers, pgs.fouls
    FROM player_game_stats pgs
    JOIN players p ON p.id = pgs.player_id
    WHERE p.team_id IS NOT NULL
    ON CONFLICT (game_id, player_id) DO UPDATE SET
      points         = EXCLUDED.points,
      three_pointers = EXCLUDED.three_pointers,
      fouls          = EXCLUDED.fouls;
  END IF;
END $$;

-- Step 2 — drop the now-redundant table and its trigger / function
DROP TRIGGER IF EXISTS trg_pgs_updated_at ON player_game_stats;
DROP FUNCTION IF EXISTS set_pgs_updated_at();
DROP TABLE IF EXISTS player_game_stats;
