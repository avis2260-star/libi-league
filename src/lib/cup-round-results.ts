/**
 * The cup round the home page's season-facts card rotates through: the
 * latest round that has results (the first round early in the cup, then
 * each later round as its scores come in), with every scored game of it in
 * bracket order. Pure, so the choice is testable.
 */
import { isPlaceholderTeam } from '@/lib/cup-settings';

export type CupResultGame = {
  id: string;
  round: string;
  round_order: number;
  game_number: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
};

export type CupRoundResults = {
  round: string;
  games: { id: string; home_team: string; away_team: string; home_score: number; away_score: number }[];
};

/**
 * `derived` carries scores worked out from quarters / player stats for games
 * whose own score wasn't typed (see cup-derived-scores); an entered score
 * always wins.
 */
export function latestCupRoundResults(
  games: CupResultGame[],
  derived: Map<string, { home: number; away: number }> = new Map(),
): CupRoundResults | null {
  const scored = games
    .filter((g) => !isPlaceholderTeam(g.home_team) && !isPlaceholderTeam(g.away_team))
    .map((g) => {
      const own = g.home_score != null && g.away_score != null ? { home: g.home_score, away: g.away_score } : null;
      const score = own ?? derived.get(g.id) ?? null;
      return score ? { ...g, home_score: score.home, away_score: score.away } : null;
    })
    .filter((g): g is CupResultGame & { home_score: number; away_score: number } => g !== null);
  if (scored.length === 0) return null;

  const latest = Math.max(...scored.map((g) => g.round_order));
  const inRound = scored
    .filter((g) => g.round_order === latest)
    .sort((a, b) => a.game_number - b.game_number);
  return {
    round: inRound[0].round,
    games: inRound.map(({ id, home_team, away_team, home_score, away_score }) => ({
      id, home_team, away_team, home_score, away_score,
    })),
  };
}
