/**
 * The cup's participating-team list is kept PER SEASON, so a new tournament
 * starts from its own list instead of last year's. The list used to live in one
 * shared league_settings key, which was in use up to and including 2026-2027;
 * those seasons still read it as the fallback when they have no list of their
 * own, so nothing saved before is lost. Later seasons start with an empty list.
 */
export const LEGACY_CUP_TEAMS_KEY = 'cup_tournament_teams';
export const LEGACY_LIST_LAST_SEASON = '2026-2027';

export const cupTeamsKey = (season: string) => `${LEGACY_CUP_TEAMS_KEY}:${season}`;

/** The league_settings keys to load for a season's list (own key first). */
export const cupTeamsKeysFor = (season: string) => [cupTeamsKey(season), LEGACY_CUP_TEAMS_KEY];

/** The season's team ids: its own saved list, else the old shared one. */
export function pickCupTeamIds(
  rows: { key: string; value: string | null }[] | null | undefined,
  season: string,
): string[] {
  const list = rows ?? [];
  const usedSharedList = season <= LEGACY_LIST_LAST_SEASON; // 'YYYY-YYYY' sorts by year
  const raw =
    list.find((r) => r.key === cupTeamsKey(season))?.value ??
    (usedSharedList ? list.find((r) => r.key === LEGACY_CUP_TEAMS_KEY)?.value : undefined);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Starting a season's tournament
// ---------------------------------------------------------------------------

/** Knock-out rounds, earliest first, with the number of games in a full round. */
export const CUP_ROUNDS = [
  { name: 'שמינית גמר', games: 8 },
  { name: 'רבע גמר', games: 4 },
  { name: 'חצי גמר', games: 2 },
  { name: 'גמר', games: 1 },
] as const;

export type CupRoundName = (typeof CUP_ROUNDS)[number]['name'];

/** An undrawn slot: the bracket's placeholder for a team not known yet. */
export function isPlaceholderTeam(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return n === '' || n === 'tbd';
}

export type CupSlot = { round: string; round_order: number; game_number: number };

/**
 * The empty bracket of a new tournament: the first round with `firstRoundGames`
 * draw slots (fewer than a full round when some teams get a bye), then every
 * later round at its full size, down to the final.
 */
export function buildCupSkeleton(firstRound: CupRoundName, firstRoundGames: number): CupSlot[] {
  const start = CUP_ROUNDS.findIndex((r) => r.name === firstRound);
  if (start < 0) throw new Error(`unknown cup round: ${firstRound}`);
  const max = CUP_ROUNDS[start].games;
  const first = Number.isFinite(firstRoundGames)
    ? Math.min(Math.max(Math.floor(firstRoundGames), 1), max)
    : max;

  // round_order is the round's fixed place in the cup (שמינית גמר = 1 … גמר = 4),
  // the same numbering the Excel import uses — the bracket groups games by it,
  // so a game added later lands in the same round column.
  const slots: CupSlot[] = [];
  CUP_ROUNDS.slice(start).forEach((r, i) => {
    const count = i === 0 ? first : r.games;
    for (let n = 1; n <= count; n++) {
      slots.push({ round: r.name, round_order: start + i + 1, game_number: n });
    }
  });
  return slots;
}
