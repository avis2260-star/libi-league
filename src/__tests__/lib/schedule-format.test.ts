// current-season (for FALLBACK_SEASON) imports the Supabase admin client.
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: jest.fn() } }));

import {
  formatIsoDate,
  hebrewWeekday,
  sortSchedule,
  summarizeRounds,
  formatDatesWithDay,
  shortDate,
  roundDatesForSeason,
  LEGACY_SEASON,
  ROUND_DATES_2025_2026,
} from '@/lib/schedule-format';
import { FALLBACK_SEASON } from '@/lib/current-season';
import type { ScheduleEntry } from '@/lib/libi-schedule';

const g = (
  round: number,
  date: string,
  homeTeam: string,
  awayTeam: string,
  division: 'North' | 'South',
): ScheduleEntry => ({ round, date, homeTeam, awayTeam, division });

describe('formatIsoDate', () => {
  it('turns YYYY-MM-DD into DD.MM.YYYY', () => {
    expect(formatIsoDate('2026-10-24')).toBe('24.10.2026');
  });
  it('leaves anything else unchanged', () => {
    expect(formatIsoDate('24.10.26')).toBe('24.10.26');
  });
});

describe('hebrewWeekday', () => {
  it('names the day of the week in Hebrew', () => {
    expect(hebrewWeekday('2026-10-24')).toBe('שבת');
    expect(hebrewWeekday('2026-10-25')).toBe('ראשון');
    expect(hebrewWeekday('2027-04-09')).toBe('שישי');
  });
  it('returns an empty string for a non-ISO date', () => {
    expect(hebrewWeekday('soon')).toBe('');
  });
});

describe('sortSchedule', () => {
  it('orders by round, then date, then North before South', () => {
    const sorted = sortSchedule([
      g(2, '2026-10-31', 'א', 'ב', 'North'),
      g(1, '2026-10-24', 'ג', 'ד', 'South'),
      g(1, '2026-10-24', 'ה', 'ו', 'North'),
    ]);
    expect(sorted.map((e) => [e.round, e.division])).toEqual([
      [1, 'North'],
      [1, 'South'],
      [2, 'North'],
    ]);
  });
});

describe('summarizeRounds', () => {
  it('gives each round the dates and games of both divisions', () => {
    const rounds = summarizeRounds([
      g(1, '2026-10-24', 'חולון', 'בני נתניה', 'North'),
      g(1, '2026-10-24', 'אופק רחובות', 'קריית מלאכי', 'South'),
      g(1, '2026-10-24', 'אוריה ירושלים', 'אחים קריית משה', 'South'),
      g(2, '2026-10-31', 'גלי בת-ים', 'חולון', 'North'),
    ]);
    expect(rounds.map((r) => r.round)).toEqual([1, 2]);
    expect(rounds[0].North).toMatchObject({ dates: ['2026-10-24'] });
    expect(rounds[0].North.games).toHaveLength(1);
    expect(rounds[0].South.games).toHaveLength(2);
    // Round 2 has no South games — the division is present but empty.
    expect(rounds[1].South).toEqual({ dates: [], games: [] });
  });

  it('keeps every date of a split round, in order', () => {
    const [r] = summarizeRounds([
      g(5, '2026-12-26', 'א', 'ב', 'North'),
      g(5, '2026-12-19', 'ג', 'ד', 'North'),
    ]);
    expect(r.North.dates).toEqual(['2026-12-19', '2026-12-26']);
  });
});

describe('formatDatesWithDay', () => {
  it('formats one or several dates with their weekday', () => {
    expect(formatDatesWithDay(['2026-10-24'])).toBe('24.10.2026 (שבת)');
    expect(formatDatesWithDay(['2026-10-24', '2026-10-25'])).toBe('24.10.2026 (שבת) / 25.10.2026 (ראשון)');
    expect(formatDatesWithDay([])).toBe('');
  });
});

describe('roundDatesForSeason', () => {
  const schedule = [
    g(2, '2026-11-07', 'א', 'ב', 'North'),
    g(1, '2026-10-31', 'ג', 'ד', 'South'),
    g(1, '2026-10-31', 'ה', 'ו', 'North'),
  ];

  it("gives a new season its own schedule's dates", () => {
    expect(roundDatesForSeason('2026-2027', schedule)).toEqual({ 1: '31.10.26', 2: '07.11.26' });
  });

  it("never fills a new season's rounds with 2025-2026 dates", () => {
    const dates = roundDatesForSeason('2026-2027', schedule);
    expect(dates[3]).toBeUndefined();
    expect(Object.values(dates)).not.toContain('01.11.25');
  });

  it("gives 2025-2026 its actual dates, including the moved rounds 6 and 7", () => {
    const original = [g(6, '2026-01-24', 'א', 'ב', 'North'), g(7, '2026-01-31', 'ג', 'ד', 'North')];
    const dates = roundDatesForSeason(LEGACY_SEASON, original);
    expect(dates[6]).toBe('17.01.26');
    expect(dates[7]).toBe('07.02.26');
    expect(dates).toEqual(ROUND_DATES_2025_2026);
  });

  it('LEGACY_SEASON is the archive season the rest of the app uses', () => {
    expect(LEGACY_SEASON).toBe(FALLBACK_SEASON);
  });
});

describe('shortDate', () => {
  it('turns YYYY-MM-DD into DD.MM.YY and leaves other text alone', () => {
    expect(shortDate('2026-10-31')).toBe('31.10.26');
    expect(shortDate('31.10.26')).toBe('31.10.26');
  });
});
