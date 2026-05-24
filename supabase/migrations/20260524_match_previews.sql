-- Match previews — pre-game commentary, one row per cup match-up.
-- Two free-text reviews per row (one for each team) plus an explicit
-- publish flag so the admin can save drafts without exposing them.
--
-- Linked to cup_games.id by FK. ON DELETE CASCADE: if the admin deletes
-- a cup_games row, the orphan preview goes with it.

CREATE TABLE IF NOT EXISTS public.match_previews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cup_game_id     uuid NOT NULL REFERENCES public.cup_games(id) ON DELETE CASCADE,
  season          text NOT NULL DEFAULT '2025-2026',
  home_review     text NOT NULL DEFAULT '',
  away_review     text NOT NULL DEFAULT '',
  is_published    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- One preview per cup game. If you want multiple drafts, do it via
  -- versioning at the app layer; the canonical preview-per-game stays unique.
  UNIQUE (cup_game_id)
);

CREATE INDEX IF NOT EXISTS match_previews_season_idx
  ON public.match_previews (season);

CREATE INDEX IF NOT EXISTS match_previews_published_idx
  ON public.match_previews (is_published)
  WHERE is_published = true;

ALTER TABLE public.match_previews ENABLE ROW LEVEL SECURITY;

-- Public can read ONLY published rows. Drafts stay invisible until the
-- admin flips the flag.
DROP POLICY IF EXISTS "public_read_published" ON public.match_previews;
CREATE POLICY "public_read_published" ON public.match_previews
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- All writes (insert / update / delete) go through the service role from
-- /api/admin routes. No anon write policy → those API routes are the
-- only path to mutate this table.

-- Auto-bump updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.match_previews_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_previews_updated_at ON public.match_previews;
CREATE TRIGGER trg_match_previews_updated_at
  BEFORE UPDATE ON public.match_previews
  FOR EACH ROW
  EXECUTE FUNCTION public.match_previews_touch_updated_at();

COMMENT ON TABLE public.match_previews IS
  'Pre-game commentary for cup match-ups. One row per cup_games row. Admin generates the reviews via Gemini and edits before publishing.';
