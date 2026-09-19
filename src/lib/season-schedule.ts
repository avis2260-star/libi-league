/**
 * Season-aware league schedule.
 *
 * Historically the fixture list lived only in the hard-coded LIBI_SCHEDULE
 * (2025-2026). That made every new season a code change. This helper reads the
 * schedule for a given season from the database instead, so a new season is
 * just an Excel upload:
 *
 *   • 2025-2026 (FALLBACK_SEASON) → the hard-coded LIBI_SCHEDULE, verbatim, so
 *     the archive is byte-for-byte unchanged.
 *   • any other season → built from the `games` rows the schedule importer
 *     created (each carries its `round`), with team names joined and the
 *     division derived from teams.division (hard-coded rosters as a fallback).
 *   • a season that has no imported schedule yet → an empty list, NOT the old
 *     hard-coded fixtures, so a freshly-bumped season never shows last year's
 *     games as "upcoming".
 *
 * Server-only (it queries Supabase). Callers that are client components must
 * receive the resolved ScheduleEntry[] as a prop from their server parent.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { LIBI_SCHEDULE, type ScheduleEntry } from '@/lib/libi-schedule';
import { FALLBACK_SEASON } from '@/lib/current-season';
import { mergeDivisionNames, normalizeTeamName } from '@/lib/excel-sync-parsers';

type JoinedTeam = { name: string } | { name: string }[] | null;

function teamName(t: JoinedTeam): string {
  if (Array.isArray(t)) return t[0]?.name ?? '';
  return t?.name ?? '';
}

export async function getSeasonSchedule(season: string): Promise<ScheduleEntry[]> {
  // The 2025-2026 season predates DB-stored rounds — serve the static schedule.
  if (season === FALLBACK_SEASON) return LIBI_SCHEDULE;

  try {
    const [{ data: gamesRows }, { data: teamRows }] = await Promise.all([
      supabaseAdmin
        .from('games')
        .select(
          'round, game_date, game_time, location,' +
            ' home_team:teams!games_home_team_id_fkey(name),' +
            ' away_team:teams!games_away_team_id_fkey(name)',
        )
        .eq('season', season)
        .not('round', 'is', null)
        .order('round', { ascending: true }),
      supabaseAdmin.from('teams').select('name, division'),
    ]);

    // No imported schedule for this season yet → empty (honest) rather than
    // last season's hard-coded fixtures.
    if (!gamesRows || gamesRows.length === 0) return [];

    // Division map: hard-coded rosters merged with teams.division, so even a
    // team whose division column is still NULL is classified via the fallback.
    const { north, south } = mergeDivisionNames(
      (teamRows ?? []) as { name: string; division?: string | null }[],
    );
    const divOf = new Map<string, 'North' | 'South'>();
    for (const n of north) divOf.set(normalizeTeamName(n), 'North');
    for (const s of south) divOf.set(normalizeTeamName(s), 'South');

    type Row = {
      round: number | null;
      game_date: string;
      game_time: string | null;
      location: string | null;
      home_team: JoinedTeam;
      away_team: JoinedTeam;
    };

    const entries: ScheduleEntry[] = [];
    for (const g of (gamesRows ?? []) as unknown as Row[]) {
      const home = teamName(g.home_team);
      const away = teamName(g.away_team);
      if (!home || !away || g.round == null) continue;
      const division =
        divOf.get(normalizeTeamName(home)) ?? divOf.get(normalizeTeamName(away)) ?? 'South';
      entries.push({
        round: g.round,
        date: g.game_date,
        homeTeam: home,
        awayTeam: away,
        division,
        location: g.location ?? undefined,
        time: g.game_time ?? undefined,
      });
    }
    return entries;
  } catch {
    return [];
  }
}
