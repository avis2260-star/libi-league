-- Snapshot cup data in sync_logs so an Excel sync can be rolled back to its
-- pre-sync cup state (bracket scores, per-player stats, quarters, video,
-- location, and match previews). Complements snapshot_standings /
-- snapshot_results which already exist.

ALTER TABLE public.sync_logs
  ADD COLUMN IF NOT EXISTS snapshot_cup_games    jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_cup_stats    jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_cup_previews jsonb;

COMMENT ON COLUMN public.sync_logs.snapshot_cup_games    IS 'Pre-sync snapshot of cup_games for this season (for rollback).';
COMMENT ON COLUMN public.sync_logs.snapshot_cup_stats    IS 'Pre-sync snapshot of cup_game_stats for this season (for rollback).';
COMMENT ON COLUMN public.sync_logs.snapshot_cup_previews IS 'Pre-sync snapshot of match_previews for this season (for rollback).';
