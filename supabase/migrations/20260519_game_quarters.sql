-- Per-quarter scoring on games. Index 0–3 = Q1–Q4, index 4+ = OT periods.
-- NULL means no quarter breakdown was submitted for this game.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS home_quarters int[],
  ADD COLUMN IF NOT EXISTS away_quarters int[];

ALTER TABLE public.games
  ADD CONSTRAINT games_home_quarters_len_check
    CHECK (home_quarters IS NULL OR array_length(home_quarters, 1) >= 4),
  ADD CONSTRAINT games_away_quarters_len_check
    CHECK (away_quarters IS NULL OR array_length(away_quarters, 1) >= 4),
  ADD CONSTRAINT games_quarters_symmetry_check
    CHECK (
      (home_quarters IS NULL AND away_quarters IS NULL)
      OR (
        home_quarters IS NOT NULL
        AND away_quarters IS NOT NULL
        AND array_length(home_quarters, 1) = array_length(away_quarters, 1)
      )
    );

COMMENT ON COLUMN public.games.home_quarters IS
  'Home team points per period. Indexes 0-3 are Q1-Q4; indexes 4+ are OT periods (OT1, OT2, ...). NULL = no breakdown.';
COMMENT ON COLUMN public.games.away_quarters IS
  'Away team points per period. Indexes 0-3 are Q1-Q4; indexes 4+ are OT periods (OT1, OT2, ...). NULL = no breakdown.';
