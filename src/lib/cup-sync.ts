/**
 * How the Excel upload merges the workbook's cup sheet (גביע / טורניר) into
 * the season's bracket. Pure, so the rules are testable without the route.
 *
 * The cup is managed in the admin, so the upload never changes or removes a
 * game that is already there. For each game the sheet lists, it decides:
 *
 *   • already in the season (same two teams)          → nothing to do
 *   • a copy of an earlier season's result            → skipped (a workbook
 *     carried over from last year still holds last year's cup sheet; those
 *     games must not land in the new tournament)
 *   • a second final, when the season has a real one  → skipped
 *   • its round has an empty TBD slot (the admin opened the tournament) →
 *     fills that slot, so the bracket isn't doubled
 *   • otherwise                                       → inserted
 */
import { normalizeTeamName, type CupGameRow } from '@/lib/excel-sync-parsers';
import { isPlaceholderTeam } from '@/lib/cup-settings';

export type SeasonCupGame = {
  id: string;
  round: string;
  game_number: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  played: boolean;
};

export type OtherSeasonCupGame = {
  round: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
};

export type CupSyncPlan = {
  /** New games to insert (game_number continues after the round's games). */
  insert: CupGameRow[];
  /** Empty TBD slots to fill with a sheet game. */
  fill: { id: string; game: CupGameRow }[];
  /** Sheet games skipped because they repeat an earlier season's result. */
  staleSkipped: number;
};

const FINAL = 'גמר';

const pairKey = (a: string, b: string) => [normalizeTeamName(a), normalizeTeamName(b)].sort().join('|');

/** Round + both teams + each team's score, independent of home/away order. */
function resultKey(g: { round: string; home_team: string; away_team: string; home_score: number | null; away_score: number | null }) {
  if (g.home_score == null || g.away_score == null) return null;
  const sides = [
    `${normalizeTeamName(g.home_team)}:${g.home_score}`,
    `${normalizeTeamName(g.away_team)}:${g.away_score}`,
  ].sort();
  return `${g.round}|${sides.join('|')}`;
}

const isEmptySlot = (g: SeasonCupGame) =>
  isPlaceholderTeam(g.home_team) && isPlaceholderTeam(g.away_team) &&
  !g.played && g.home_score == null && g.away_score == null;

export function planCupSync(
  sheet: CupGameRow[],
  season: SeasonCupGame[],
  otherSeasons: OtherSeasonCupGame[],
): CupSyncPlan {
  const plan: CupSyncPlan = { insert: [], fill: [], staleSkipped: 0 };

  const realGames = season.filter((g) => !isPlaceholderTeam(g.home_team) && !isPlaceholderTeam(g.away_team));
  const pairs = new Set(realGames.map((g) => pairKey(g.home_team, g.away_team)));
  const earlierResults = new Set(otherSeasons.map(resultKey).filter((k): k is string => k !== null));
  let hasFinal = season.some((g) => g.round === FINAL && !isEmptySlot(g));

  // Empty slots per round, in bracket order, and the last game number per round.
  const slots = new Map<string, SeasonCupGame[]>();
  const lastNumber = new Map<string, number>();
  for (const g of [...season].sort((a, b) => a.game_number - b.game_number)) {
    if (isEmptySlot(g)) slots.set(g.round, [...(slots.get(g.round) ?? []), g]);
    lastNumber.set(g.round, Math.max(lastNumber.get(g.round) ?? 0, g.game_number));
  }

  for (const g of sheet) {
    if (isPlaceholderTeam(g.home_team) && isPlaceholderTeam(g.away_team)) continue;
    const pair = pairKey(g.home_team, g.away_team);
    if (pairs.has(pair)) continue;

    const key = resultKey(g);
    if (key && earlierResults.has(key)) { plan.staleSkipped++; continue; }

    if (g.round === FINAL && hasFinal) continue;

    const slot = slots.get(g.round)?.shift();
    if (slot) {
      plan.fill.push({ id: slot.id, game: { ...g, game_number: slot.game_number } });
    } else {
      const n = (lastNumber.get(g.round) ?? 0) + 1;
      lastNumber.set(g.round, n);
      plan.insert.push({ ...g, game_number: n });
    }
    pairs.add(pair);
    if (g.round === FINAL) hasFinal = true;
  }

  return plan;
}
