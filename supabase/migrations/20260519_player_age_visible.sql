-- Per-player flag controlling whether the computed age is shown publicly.
-- Defaults to true so existing rows continue to display age as before.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS age_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.players.age_visible IS
  'When false, the player''s age is hidden from public-facing UI even if date_of_birth is set.';
