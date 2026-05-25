import { makeNameResolver, type TeamRow } from './team-name-resolver';

export type RosterPlayer = { id: string; name: string; jersey_number: number | null };
type PlayerRow = { id: string; name: string; jersey_number: number | null; team_id: string | null };

/**
 * Build a roster lookup keyed by team-NAME strings, for contexts (cup,
 * playoff) where games store team names as free text rather than FK ids.
 *
 * `teamNames` is the set of name strings that actually appear on games
 * (home_team / away_team / series team_a / team_b). Each is resolved
 * through the alias-aware name resolver to its canonical team, then mapped
 * to that team's active roster — so the returned record's keys exactly
 * match what the games reference, regardless of name drift.
 */
export function buildRostersByName(
  teamNames: string[],
  teams: TeamRow[],
  players: PlayerRow[],
): Record<string, RosterPlayer[]> {
  const resolve = makeNameResolver(teams);

  // canonical name → team_id
  const idByName = new Map<string, string>();
  for (const t of teams) idByName.set(t.name, t.id);

  // team_id → roster
  const byTeamId = new Map<string, RosterPlayer[]>();
  for (const p of players) {
    if (!p.team_id) continue;
    const arr = byTeamId.get(p.team_id) ?? [];
    arr.push({ id: p.id, name: p.name, jersey_number: p.jersey_number });
    byTeamId.set(p.team_id, arr);
  }

  const out: Record<string, RosterPlayer[]> = {};
  for (const raw of teamNames) {
    if (!raw || raw in out) continue;
    const canonical = resolve(raw);
    const teamId = idByName.get(canonical);
    out[raw] = teamId ? (byTeamId.get(teamId) ?? []) : [];
  }
  return out;
}
