-- Fix: "record \"new\" has no field \"updated_at\"" when saving cup game stats.
--
-- An earlier (since-removed) migration created a BEFORE UPDATE trigger on
-- cup_game_stats that set NEW.updated_at. The canonical table — created by
-- 20260525_cup_playoff_stats.sql — has no updated_at column, so every
-- upsert that hits the UPDATE path raises:
--   record "new" has no field "updated_at"
--
-- The trigger is orphaned (its migration file no longer exists) but it still
-- lives in the database. Drop it and its function. cup_game_stats does not
-- track updated_at by design, so no replacement is needed. Idempotent.

DROP TRIGGER  IF EXISTS trg_cup_game_stats_updated_at ON public.cup_game_stats;
DROP FUNCTION IF EXISTS public.cup_game_stats_touch_updated_at();
