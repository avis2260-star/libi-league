-- Admin-editable rule cards shown in the "פורמט הליגה" section on /about.
-- Replaces the previously hardcoded list. Public page falls back to the
-- hardcoded defaults when this table is empty.

CREATE TABLE IF NOT EXISTS public.league_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_rules_sort_idx
  ON public.league_rules (sort_order ASC, created_at ASC);

COMMENT ON TABLE public.league_rules IS
  'Editable rule/format cards rendered in the public About page. Empty table = fall back to baked-in defaults.';
