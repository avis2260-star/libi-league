/**
 * Live champion / cup-holder derivation from playoff + cup data.
 *
 * Shared by the Hall of Fame index (reigning cards + auto wall cards) and the
 * per-season detail page, so a season that was never manually curated in
 * league_history_seasons still resolves its champion, runner-up and cup holder
 * straight from the recorded playoff_series #7 final and cup 'גמר' game.
 */
import { seriesWinner } from '@/lib/playoff-format';

export type PlayoffSeries = { series_number: number; team_a: string; team_b: string };
export type PlayoffGame = {
  series_number: number;
  game_number: number;
  home_score: number | null;
  away_score: number | null;
  played: boolean | null;
};
export type CupGame = {
  round: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  played: boolean | null;
};

/** The playoff format alternates home court by game number (game 2 flips). */
export function homeForGame(s: PlayoffSeries, gNum: number): string {
  return gNum === 2 ? s.team_b : s.team_a;
}

/** Winner of a playoff series, or null while it's undecided. */
export function playoffSeriesWinner(s: PlayoffSeries, games: PlayoffGame[]): string | null {
  let winsA = 0;
  let winsB = 0;
  for (const g of games.filter((g) => g.series_number === s.series_number && g.played)) {
    const home = homeForGame(s, g.game_number);
    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
    if ((homeWon && home === s.team_a) || (!homeWon && home !== s.team_a)) winsA++;
    else winsB++;
  }
  return seriesWinner(s.series_number, winsA, s.team_a, winsB, s.team_b);
}

/** Loser of a decided playoff final (the runner-up), or null. */
export function playoffSeriesRunnerUp(s: PlayoffSeries, games: PlayoffGame[]): string | null {
  const winner = playoffSeriesWinner(s, games);
  if (!winner) return null;
  return winner === s.team_a ? s.team_b : s.team_a;
}

/** Winner of the cup final ('גמר'), or null while it's unplayed. */
export function cupFinalWinner(games: CupGame[]): string | null {
  const finalGame = games.find(
    (g) => g.round === 'גמר' && g.played && g.home_score !== null && g.away_score !== null,
  );
  if (!finalGame) return null;
  return (finalGame.home_score ?? 0) > (finalGame.away_score ?? 0)
    ? finalGame.home_team
    : finalGame.away_team;
}

/** Cup final score line "hi – lo" (champion first), or null. */
export function cupFinalScore(games: CupGame[]): string | null {
  const finalGame = games.find(
    (g) => g.round === 'גמר' && g.played && g.home_score !== null && g.away_score !== null,
  );
  if (!finalGame) return null;
  const a = finalGame.home_score ?? 0;
  const b = finalGame.away_score ?? 0;
  return `${Math.max(a, b)} – ${Math.min(a, b)}`;
}
