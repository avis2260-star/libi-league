import {
  formatIsoDate,
  hebrewWeekday,
  sortSchedule,
  summarizeRounds,
  formatDatesWithDay,
} from '@/lib/schedule-format';
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
