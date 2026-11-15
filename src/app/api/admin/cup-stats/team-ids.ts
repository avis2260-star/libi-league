import { makeNameResolver } from '@/lib/team-name-resolver';

/**
 * Cup games name their teams as text. Resolve each to its teams-table id the
 * way the admin's cup rosters do (exact normalized name, then substring), so
 * the import and template see the same players the stats editor shows.
 */
export function cupTeamIds(
  teams: { id: string; name: string }[],
  homeTeam: string,
  awayTeam: string,
): { homeId: string | null; awayId: string | null } {
  const resolve = makeNameResolver(teams);
  const idByName = new Map(teams.map((t) => [t.name, t.id]));
  return {
    homeId: idByName.get(resolve(homeTeam)) ?? null,
    awayId: idByName.get(resolve(awayTeam)) ?? null,
  };
}
