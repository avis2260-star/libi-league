-- Add runner-up (סגנית אלופה) column to league history seasons.
-- Represents the team that reached the finals but lost to the champion.

ALTER TABLE public.league_history_seasons
  ADD COLUMN IF NOT EXISTS runner_up_name text;
