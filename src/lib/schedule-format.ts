/**
 * Pure helpers for presenting a season's schedule — shared by the admin's
 * round-dates table (client) and the Excel export (server). No server-only or
 * heavy imports here, so it is safe to use from client components.
 */
import type { ScheduleEntry } from '@/lib/libi-schedule';

export type Division = ScheduleEntry['division'];

export const DIVISION_HE: Record<Division, string> = { North: 'צפון', South: 'דרום' };

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/** 'YYYY-MM-DD' → 'DD.MM.YYYY'. Anything else is returned unchanged. */
export function formatIsoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Hebrew weekday of 'YYYY-MM-DD'. Computed in UTC so it never shifts by timezone. */
export function hebrewWeekday(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  return HE_DAYS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
}

/** Display order: round, date, division (North then South), home team. */
export function sortSchedule(schedule: ScheduleEntry[]): ScheduleEntry[] {
  return [...schedule].sort(
    (a, b) =>
      a.round - b.round ||
      a.date.localeCompare(b.date) ||
      (a.division === b.division ? 0 : a.division === 'North' ? -1 : 1) ||
      a.homeTeam.localeCompare(b.homeTeam, 'he'),
  );
}

export type DivisionRound = { dates: string[]; games: ScheduleEntry[] };
export type RoundSummary = { round: number } & Record<Division, DivisionRound>;

/**
 * One entry per round with each division's date(s) and fixtures. A division
 * usually plays a round on a single date, but a round can be split (or the two
 * divisions can play on different days), so dates are kept as a list.
 */
export function summarizeRounds(schedule: ScheduleEntry[]): RoundSummary[] {
  const byRound = new Map<number, RoundSummary>();
  for (const e of sortSchedule(schedule)) {
    let r = byRound.get(e.round);
    if (!r) {
      r = { round: e.round, North: { dates: [], games: [] }, South: { dates: [], games: [] } };
      byRound.set(e.round, r);
    }
    const d = r[e.division];
    d.games.push(e);
    if (!d.dates.includes(e.date)) d.dates.push(e.date);
  }
  return [...byRound.values()].sort((a, b) => a.round - b.round);
}

/** '24.10.2026 (שבת)', several dates joined with ' / ', or '' when none. */
export function formatDatesWithDay(dates: string[]): string {
  return dates.map((d) => `${formatIsoDate(d)} (${hebrewWeekday(d)})`).join(' / ');
}

// ---------------------------------------------------------------------------
// Round dates per season
// ---------------------------------------------------------------------------

/** The archived season whose round dates are kept below (= FALLBACK_SEASON). */
export const LEGACY_SEASON = '2025-2026';

/**
 * 2025-2026's ACTUAL round dates. Rounds 6 and 7 were moved after the fixture
 * list was published, so they differ from LIBI_SCHEDULE (17.01 / 07.02 instead
 * of 24.01 / 31.01). Used for that season only — never for another season.
 */
export const ROUND_DATES_2025_2026: Record<number, string> = {
  1: '01.11.25', 2: '08.11.25', 3: '29.11.25', 4: '20.12.25',
  5: '10.01.26', 6: '17.01.26', 7: '07.02.26', 8: '21.02.26',
  9: '24.04.26', 10: '01.05.26', 11: '08.05.26',
  12: '05.06.26', 13: '12.06.26', 14: '19.06.26',
};

/** 'YYYY-MM-DD' → 'DD.MM.YY'. Anything else is returned unchanged. */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : iso;
}

/**
 * Round → display date ('DD.MM.YY') for a season: the first date of each round
 * in that season's own schedule, plus 2025-2026's actual (moved) dates for
 * that season. Never another season's dates — a new season can't show last
 * season's calendar.
 */
export function roundDatesForSeason(
  season: string,
  schedule: ScheduleEntry[],
): Record<number, string> {
  const out: Record<number, string> = {};
  for (const e of sortSchedule(schedule)) {
    if (!(e.round in out) && e.date) out[e.round] = shortDate(e.date);
  }
  return season === LEGACY_SEASON ? { ...out, ...ROUND_DATES_2025_2026 } : out;
}
