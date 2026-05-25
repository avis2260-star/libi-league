-- Add flyer_url column to match_previews for per-game flyer images.
ALTER TABLE public.match_previews
  ADD COLUMN IF NOT EXISTS flyer_url text;

COMMENT ON COLUMN public.match_previews.flyer_url IS
  'Optional URL of a promotional flyer image stored in Supabase Storage.';
