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
 *   • a season whose games table is empty → the schedule persisted by the last
 *     Excel upload (league_settings key `schedule:<season>`), then a static
 *     per-season fallback, then an empty list. The persisted copy means every
 *     new season's fixtures/dates show up the moment its Excel is uploaded —
 *     even before the games.round migration is run — and never last season's.
 *
 * Server-only (it queries Supabase). Callers that are client components must
 * receive the resolved ScheduleEntry[] as a prop from their server parent.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { LIBI_SCHEDULE, type ScheduleEntry } from '@/lib/libi-schedule';
import { SCHEDULE_2026_2027 } from '@/lib/schedule-2026';
import { FALLBACK_SEASON } from '@/lib/current-season';
import { mergeDivisionNames, normalizeTeamName, isByeTeam } from '@/lib/excel-sync-parsers';

// Static per-season schedules, used ONLY as a fallback when the database has no
// imported games for that season yet. As soon as an Excel upload creates games
// rows (with round), those win. Lets a season's fixtures/dates show on the site
// before the DB import succeeds. 2025-2026 is handled by FALLBACK_SEASON below.
const STATIC_FALLBACK: Record<string, ScheduleEntry[]> = {
  '2026-2027': SCHEDULE_2026_2027,
};

type JoinedTeam = { name: string } | { name: string }[] | null;

function teamName(t: JoinedTeam): string {
  if (Array.isArray(t)) return t[0]?.name ?? '';
  return t?.name ?? '';
}

/** The schedule the last Excel upload persisted for this season, if any. */
async function readStoredSchedule(season: string): Promise<ScheduleEntry[]> {
  try {
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('value')
      .eq('key', `schedule:${season}`)
      .maybeSingle();
    if (!data?.value) return [];
    const parsed = JSON.parse(data.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is ScheduleEntry =>
        !!e && typeof e === 'object' &&
        typeof (e as ScheduleEntry).round === 'number' &&
        typeof (e as ScheduleEntry).homeTeam === 'string' &&
        typeof (e as ScheduleEntry).awayTeam === 'string' &&
        typeof (e as ScheduleEntry).date === 'string')
      .map((e) => ({
        round: e.round,
        date: e.date,
        homeTeam: e.homeTeam,
        awayTeam: e.awayTeam,
        division: e.division === 'North' ? 'North' : 'South',
        location: e.location,
        time: e.time,
      }));
  } catch {
    return [];
  }
}

/** No DB games for this season → persisted upload, then static, then empty. */
async function fallbackSchedule(season: string): Promise<ScheduleEntry[]> {
  const stored = await readStoredSchedule(season);
  if (stored.length > 0) return stored;
  return STATIC_FALLBACK[season] ?? [];
}

export async function getSeasonSchedule(season: string): Promise<ScheduleEntry[]> {
  const raw = await getSeasonScheduleRaw(season);
  // A side listed as פגרה (league break) or גביע (cup week) is a bye, not a
  // real fixture. Filter these out here, at the single source every schedule
  // surface reads, so already-imported / persisted bye rows never display.
  return raw.filter((e) => !isByeTeam(e.homeTeam) && !isByeTeam(e.awayTeam));
}

async function getSeasonScheduleRaw(season: string): Promise<ScheduleEntry[]> {
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

    // No games rows with a round yet (e.g. before the migration runs) → the
    // schedule the last Excel upload persisted, else a static fallback.
    if (!gamesRows || gamesRows.length === 0) return fallbackSchedule(season);

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
    return fallbackSchedule(season);
  }
}
