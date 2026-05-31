-- Add view_count to season_reviews + an atomic increment RPC, mirroring the
-- match_previews view counter (20260525_match_preview_view_count.sql). The
-- public API route (/api/season-reviews/view) calls this via the service-role
-- client, so no anon grant is needed.

ALTER TABLE public.season_reviews
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.season_reviews.view_count IS
  'Running total of page views since the review was first published.';

CREATE OR REPLACE FUNCTION public.increment_season_review_views(review_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.season_reviews
  SET view_count = view_count + 1
  WHERE id = review_id
  RETURNING view_count;
$$;

COMMENT ON FUNCTION public.increment_season_review_views(uuid) IS
  'Atomically increments view_count for a single season_reviews row and returns the new value.';
