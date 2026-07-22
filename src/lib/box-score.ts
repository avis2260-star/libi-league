import type { BoxPlayer } from '@/components/PublicBoxScore';

export type RawStat = {
  player_id: string;
  team_id: string | null;
  points: number;
  three_pointers: number;
  fouls: number;
  // Optional per-player breakdown (present only where the query selects them).
  quarter_points?: number[] | null;
  two_pointers?: number | null;
  free_throws?: number | null;
};

type PlayerMeta = { name: string; jersey_number: number | null };

/**
 * Split a single game's stat rows into home/away player box-score lists.
 * Rows are assigned by their team_id; any row whose team_id matches neither
 * side (data drift) is dropped rather than mis-attributed.
 */
export function bucketGameStats(
  statsForGame: RawStat[],
  playerById: Map<string, PlayerMeta>,
  homeTeamId: string | null,
  awayTeamId: string | null,
): { homePlayers: BoxPlayer[]; awayPlayers: BoxPlayer[] } {
  const homePlayers: BoxPlayer[] = [];
  const awayPlayers: BoxPlayer[] = [];

  for (const s of statsForGame) {
    const meta = playerById.get(s.player_id);
    if (!meta) continue;
    const row: BoxPlayer = {
      name: meta.name,
      jersey_number: meta.jersey_number,
      points: s.points,
      three_pointers: s.three_pointers,
      fouls: s.fouls,
      quarter_points: s.quarter_points ?? null,
      two_pointers: s.two_pointers ?? null,
      free_throws: s.free_throws ?? null,
    };
    if (homeTeamId && s.team_id === homeTeamId) homePlayers.push(row);
    else if (awayTeamId && s.team_id === awayTeamId) awayPlayers.push(row);
  }

  return { homePlayers, awayPlayers };
}
