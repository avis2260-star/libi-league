-- Season reviews: AI-generated or manually-written season articles.
-- One or more reviews per season, each with a type (pre/mid/end/custom).
-- Public can only read published rows; all writes go through service-role API routes.

CREATE TABLE IF NOT EXISTS public.season_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season       text NOT NULL,
  review_type  text NOT NULL DEFAULT 'custom'
               CONSTRAINT season_reviews_type_chk
               CHECK (review_type IN ('pre_season', 'mid_season', 'end_season', 'custom')),
  title        text NOT NULL DEFAULT '',
  content      text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS season_reviews_season_idx
  ON public.season_reviews (season);

CREATE INDEX IF NOT EXISTS season_reviews_pub_idx
  ON public.season_reviews (is_published)
  WHERE is_published = true;

ALTER TABLE public.season_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published" ON public.season_reviews;
CREATE POLICY "public_read_published" ON public.season_reviews
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

CREATE OR REPLACE FUNCTION public.season_reviews_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_season_reviews_updated_at ON public.season_reviews;
CREATE TRIGGER trg_season_reviews_updated_at
  BEFORE UPDATE ON public.season_reviews
  FOR EACH ROW EXECUTE FUNCTION public.season_reviews_touch_updated_at();

COMMENT ON TABLE public.season_reviews IS
  'AI-generated or manually written season review articles. One or more per season, typed as pre/mid/end/custom.';
