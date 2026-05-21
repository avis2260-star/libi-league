-- Formalize the cup_games schema. The table is already in production
-- (RLS migration 20260422_enable_rls.sql:26 enables RLS on it; the
-- Excel-sync route notes "cup_games table not created yet — run SQL in
-- Supabase"). CREATE TABLE IF NOT EXISTS so existing rows stay intact.

CREATE TABLE IF NOT EXISTS public.cup_games (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round       text NOT NULL,
  round_order int  NOT NULL DEFAULT 0,
  game_number int  NOT NULL DEFAULT 1,
  home_team   text NOT NULL,
  away_team   text NOT NULL,
  home_score  int,
  away_score  int,
  date        text,
  played      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cup_games_order_idx
  ON public.cup_games (round_order ASC, game_number ASC);

COMMENT ON TABLE public.cup_games IS
  'Cup tournament bracket games. round = round name (free text, e.g. סיבוב ראשון / רבע גמר). home_team = team with home advantage from that round''s lottery draw.';
