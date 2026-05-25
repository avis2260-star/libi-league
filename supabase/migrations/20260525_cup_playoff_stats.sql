-- Per-game player stats + quarter scores for CUP and PLAYOFF games.
-- These are kept SEPARATE from regular-season game_stats: they do NOT roll
-- into players' cumulative season totals or the scorers leaderboard.

-- ── Quarter score arrays (mirror games.home_quarters / away_quarters) ──────
ALTER TABLE public.cup_games     ADD COLUMN IF NOT EXISTS home_quarters int[];
ALTER TABLE public.cup_games     ADD COLUMN IF NOT EXISTS away_quarters int[];
ALTER TABLE public.playoff_games ADD COLUMN IF NOT EXISTS home_quarters int[];
ALTER TABLE public.playoff_games ADD COLUMN IF NOT EXISTS away_quarters int[];

-- ── Cup per-player stats (keyed on cup_games.id) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.cup_game_stats (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cup_game_id    uuid NOT NULL REFERENCES public.cup_games(id) ON DELETE CASCADE,
  player_id      uuid NOT NULL REFERENCES public.players(id)   ON DELETE CASCADE,
  team_id        uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  season         text NOT NULL DEFAULT '2025-2026',
  points         int NOT NULL DEFAULT 0,
  three_pointers int NOT NULL DEFAULT 0,
  fouls          int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cup_game_id, player_id)
);
CREATE INDEX IF NOT EXISTS cup_game_stats_game_idx   ON public.cup_game_stats (cup_game_id);
CREATE INDEX IF NOT EXISTS cup_game_stats_season_idx ON public.cup_game_stats (season);

-- ── Playoff per-player stats (keyed on season+series+game, like playoff_games) ──
CREATE TABLE IF NOT EXISTS public.playoff_game_stats (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season         text NOT NULL DEFAULT '2025-2026',
  series_number  int NOT NULL,
  game_number    int NOT NULL,
  player_id      uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id        uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  points         int NOT NULL DEFAULT 0,
  three_pointers int NOT NULL DEFAULT 0,
  fouls          int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season, series_number, game_number, player_id)
);
CREATE INDEX IF NOT EXISTS playoff_game_stats_game_idx
  ON public.playoff_game_stats (season, series_number, game_number);

-- ── RLS: public read, service-role writes (mirror player_game_stats) ───────
ALTER TABLE public.cup_game_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playoff_game_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON public.cup_game_stats;
CREATE POLICY "public_read" ON public.cup_game_stats
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read" ON public.playoff_game_stats;
CREATE POLICY "public_read" ON public.playoff_game_stats
  FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE public.cup_game_stats IS
  'Per-player stats for cup games. Separate from season game_stats; does not affect season totals.';
COMMENT ON TABLE public.playoff_game_stats IS
  'Per-player stats for playoff games. Separate from season game_stats; does not affect season totals.';
