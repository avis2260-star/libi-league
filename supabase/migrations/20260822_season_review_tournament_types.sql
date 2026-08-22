-- Add two new season-review categories: playoffs and cup tournament reviews.
-- Extends the existing review_type CHECK constraint in place (no data loss).
-- Existing rows keep their type; new 'playoffs' / 'cup' reviews become valid.

ALTER TABLE public.season_reviews
  DROP CONSTRAINT IF EXISTS season_reviews_type_chk;

ALTER TABLE public.season_reviews
  ADD CONSTRAINT season_reviews_type_chk
  CHECK (review_type IN ('pre_season', 'mid_season', 'end_season', 'playoffs', 'cup', 'custom'));
