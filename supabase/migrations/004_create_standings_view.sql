-- Migration: Standings view
-- Calculates Wins, Losses, Points For, Points Against, and Total Points
-- for every team based on finished games.
--
-- Total Points uses a standard league format: 2 pts per win, 1 pt per loss.

CREATE OR REPLACE VIEW standings AS
SELECT
  t.id,
  t.name,
  t.logo_url,

  -- Wins
  COUNT(
    CASE
      WHEN g.home_team_id = t.id AND g.home_score > g.away_score THEN 1
      WHEN g.away_team_id = t.id AND g.away_score > g.home_score THEN 1
    END
  ) AS wins,

  -- Losses
  COUNT(
    CASE
      WHEN g.home_team_id = t.id AND g.home_score < g.away_score THEN 1
      WHEN g.away_team_id = t.id AND g.away_score < g.home_score THEN 1
    END
  ) AS losses,

  -- Points For (total points scored by this team)
  COALESCE(SUM(
    CASE
      WHEN g.home_team_id = t.id THEN g.home_score
      WHEN g.away_team_id = t.id THEN g.away_score
    END
  ), 0) AS points_for,

  -- Points Against (total points conceded by this team)
  COALESCE(SUM(
    CASE
      WHEN g.home_team_id = t.id THEN g.away_score
      WHEN g.away_team_id = t.id THEN g.home_score
    END
  ), 0) AS points_against,

  -- Total League Points (2 per win, 1 per loss)
  (
    COUNT(CASE WHEN g.home_team_id = t.id AND g.home_score > g.away_score THEN 1
               WHEN g.away_team_id = t.id AND g.away_score > g.home_score THEN 1 END) * 2
    +
    COUNT(CASE WHEN g.home_team_id = t.id AND g.home_score < g.away_score THEN 1
               WHEN g.away_team_id = t.id AND g.away_score < g.home_score THEN 1 END)
  ) AS total_points

FROM teams t
LEFT JOIN games g
  ON  (g.home_team_id = t.id OR g.away_team_id = t.id)
  AND g.status = 'Finished'

GROUP BY t.id, t.name, t.logo_url
ORDER BY total_points DESC, wins DESC;
