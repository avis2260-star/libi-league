-- Migration: Enable Row-Level Security on all public tables
-- Addresses Supabase security alert: rls_disabled_in_public
--
-- Strategy:
--   1. Enable RLS on every table in the public schema.
--   2. Add "anyone can read" SELECT policies for tables whose data is
--      displayed on the public site (teams, players, games, standings, etc.).
--   3. Do NOT add any anon INSERT/UPDATE/DELETE policies. All writes go
--      through server-side API routes that use the service-role key, which
--      bypasses RLS.
--   4. Sensitive tables (form submissions, disciplinary records, sync logs,
--      officials contact info) get RLS enabled but NO public policies, so
--      they remain accessible only via the service role.
--
-- Result: the anon key can read display data but cannot write or read
-- sensitive records. The service role (used in API routes) is unaffected.

-- ─── Display-data tables (anon read allowed) ──────────────────────────────

ALTER TABLE public.teams                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_results            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playoff_series          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playoff_games           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cup_games               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_history_seasons  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_history_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons                 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON public.teams;
CREATE POLICY "public_read" ON public.teams
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.players;
CREATE POLICY "public_read" ON public.players
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.games;
CREATE POLICY "public_read" ON public.games
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.game_results;
CREATE POLICY "public_read" ON public.game_results
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.playoff_series;
CREATE POLICY "public_read" ON public.playoff_series
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.playoff_games;
CREATE POLICY "public_read" ON public.playoff_games
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.cup_games;
CREATE POLICY "public_read" ON public.cup_games
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.league_history_seasons;
CREATE POLICY "public_read" ON public.league_history_seasons
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.league_history_records;
CREATE POLICY "public_read" ON public.league_history_records
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.league_settings;
CREATE POLICY "public_read" ON public.league_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.announcements;
CREATE POLICY "public_read" ON public.announcements
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.seasons;
CREATE POLICY "public_read" ON public.seasons
  FOR SELECT TO anon, authenticated USING (true);

-- ─── Sensitive tables (RLS on, NO public policies) ────────────────────────
-- These tables remain accessible ONLY through the service-role key used in
-- server-side API routes. Anon requests return empty results.

ALTER TABLE public.game_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officials           ENABLE ROW LEVEL SECURITY;

-- ─── standings (now a regular table, RLS already enabled) ────────────────
-- standings was originally created as a view (migration 004) but was later
-- converted to a regular table. RLS is already enabled on it; we just need
-- to add the public read policy so anon can read it like the others.

DROP POLICY IF EXISTS "public_read" ON public.standings;
CREATE POLICY "public_read" ON public.standings
  FOR SELECT TO anon, authenticated USING (true);
