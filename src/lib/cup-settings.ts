/**
 * The cup's participating-team list is kept PER SEASON, so a new tournament
 * starts from its own list instead of last year's. The list used to live in one
 * shared league_settings key; that key is still read as the fallback for a
 * season that has no list of its own yet, so nothing saved before is lost.
 */
export const LEGACY_CUP_TEAMS_KEY = 'cup_tournament_teams';

export const cupTeamsKey = (season: string) => `${LEGACY_CUP_TEAMS_KEY}:${season}`;

/** The league_settings keys to load for a season's list (own key first). */
export const cupTeamsKeysFor = (season: string) => [cupTeamsKey(season), LEGACY_CUP_TEAMS_KEY];

/** The season's team ids: its own saved list, else the old shared one. */
export function pickCupTeamIds(
  rows: { key: string; value: string | null }[] | null | undefined,
  season: string,
): string[] {
  const list = rows ?? [];
  const raw =
    list.find((r) => r.key === cupTeamsKey(season))?.value ??
    list.find((r) => r.key === LEGACY_CUP_TEAMS_KEY)?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
