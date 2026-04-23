-- Add finals-game details (score, date, location) to league history seasons.
-- All fields are free-text to let admins write "85-78", "15/5/2024",
-- "היכל קריית משה", etc. without tight schema constraints.

ALTER TABLE public.league_history_seasons
  ADD COLUMN IF NOT EXISTS final_score    text,
  ADD COLUMN IF NOT EXISTS final_date     text,
  ADD COLUMN IF NOT EXISTS final_location text;
