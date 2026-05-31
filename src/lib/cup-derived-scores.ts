import { makeNameResolver } from '@/lib/team-name-resolver';

// Derives a cup game's final score when the admin entered the result as
// per-player stats and/or a quarter breakdown but never typed an explicit
// home_score/away_score on the cup_games row. This lets a finished final
// crown a champion (home page banner + bracket) off the stats alone.
//
// Precedence per game:
//   1. official cup_games.home_score / away_score (if both set) — never overridden
//   2. quarter breakdown summed (home_quarters / away_quarters on the row)
//   3. per-player stat points summed per team (cup_game_stats) — both teams
//      must have at least one recorded row, so a half-entered game doesn't
//      crown a premature winner.

export type CupGameLike = {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  home_quarters?: number[] | null;
  away_quarters?: number[] | null;
};

export type CupStatRow = { cup_game_id: string; team_id: string | null; points: number | null };
export type TeamRow = { id: string; name: string };

const sum = (a: number[] | null | undefined) =>
  Array.isArray(a) ? a.reduce((s, n) => s + (n ?? 0), 0) : 0;

/**
 * Returns cup_game_id → { home, away } for games whose own score is null but
 * whose result can be derived (quarters or per-player stats). Games that
 * already have an explicit score are omitted (the caller keeps the official one).
 */
export function deriveCupScores(
  games: CupGameLike[],
  teams: TeamRow[],
  stats: CupStatRow[],
): Map<string, { home: number; away: number }> {
  const resolve = makeNameResolver(teams.map((t) => ({ id: t.id, name: t.name })));
  const idByName = new Map(teams.map((t) => [t.name, t.id]));
  const nameToId = (name: string) => idByName.get(resolve(name)) ?? null;

  // cup_game_id → (team_id → summed points)
  const byGame = new Map<string, Map<string, number>>();
  for (const s of stats) {
    if (!s.team_id) continue;
    const g = byGame.get(s.cup_game_id) ?? new Map<string, number>();
    g.set(s.team_id, (g.get(s.team_id) ?? 0) + (s.points ?? 0));
    byGame.set(s.cup_game_id, g);
  }

  const out = new Map<string, { home: number; away: number }>();
  for (const game of games) {
    if (game.home_score != null && game.away_score != null) continue; // keep official

    // 2. quarter breakdown on the row
    const hasQuarters =
      (game.home_quarters?.length ?? 0) > 0 && (game.away_quarters?.length ?? 0) > 0;
    if (hasQuarters) {
      out.set(game.id, { home: sum(game.home_quarters), away: sum(game.away_quarters) });
      continue;
    }

    // 3. per-player stats — require both teams to have recorded rows
    const sums = byGame.get(game.id);
    if (!sums) continue;
    const homeId = nameToId(game.home_team);
    const awayId = nameToId(game.away_team);
    if (!homeId || !awayId || !sums.has(homeId) || !sums.has(awayId)) continue;
    out.set(game.id, { home: sums.get(homeId) ?? 0, away: sums.get(awayId) ?? 0 });
  }
  return out;
}
