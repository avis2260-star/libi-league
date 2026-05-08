-- ─────────────────────────────────────────────────────────────────────────────
-- Per-game player stats
--
-- Stores one row per (player, game) pair so the admin can enter and edit
-- stats for each game individually instead of mutating cumulative season
-- totals on the players table.
--
-- The cumulative columns (players.points, three_pointers, fouls) remain the
-- single source of truth for everything the public site reads. The admin
-- "Per-game stats" UI keeps them in sync via deltas:
--   • INSERT new row  → players.cumulative += new value
--   • UPDATE row      → players.cumulative += (new value - old value)
--   • DELETE row      → players.cumulative -= old value
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_game_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id         uuid NOT NULL REFERENCES games(id)   ON DELETE CASCADE,
  points          int  NOT NULL DEFAULT 0 CHECK (points         >= 0),
  three_pointers  int  NOT NULL DEFAULT 0 CHECK (three_pointers >= 0),
  fouls           int  NOT NULL DEFAULT 0 CHECK (fouls          >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_pgs_player ON player_game_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_pgs_game   ON player_game_stats(game_id);

-- Auto-bump updated_at on UPDATE
CREATE OR REPLACE FUNCTION set_pgs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pgs_updated_at ON player_game_stats;
CREATE TRIGGER trg_pgs_updated_at
  BEFORE UPDATE ON player_game_stats
  FOR EACH ROW EXECUTE FUNCTION set_pgs_updated_at();

-- ─── RLS: match the project's display-data pattern ───────────────────────
-- Anon can read; writes are restricted to the service-role key used by
-- server actions (RLS bypassed for that role).

ALTER TABLE public.player_game_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON public.player_game_stats;
CREATE POLICY "public_read" ON public.player_game_stats
  FOR SELECT TO anon, authenticated USING (true);
