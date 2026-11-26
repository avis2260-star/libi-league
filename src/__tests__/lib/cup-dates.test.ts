import { parseCupDate, formatCupDate, roundDateLabel } from '@/lib/cup-dates';

describe('parseCupDate', () => {
  it('reads the admin date picker, the Excel sheet, and a full Excel date', () => {
    expect(parseCupDate('2026-11-14')).toEqual({ year: 2026, month: 11, day: 14 });
    expect(parseCupDate('14.11.26')).toEqual({ year: 2026, month: 11, day: 14 });
    expect(parseCupDate('9/1/2027')).toEqual({ year: 2027, month: 1, day: 9 });
  });

  it('takes a missing year from the season', () => {
    expect(parseCupDate('14.11', '2026-2027')).toEqual({ year: 2026, month: 11, day: 14 });
    expect(parseCupDate('9.1', '2026-2027')).toEqual({ year: 2027, month: 1, day: 9 });
    expect(parseCupDate('14.11')).toEqual({ year: null, month: 11, day: 14 });
  });

  it('returns null for anything else', () => {
    expect(parseCupDate('')).toBeNull();
    expect(parseCupDate(null)).toBeNull();
    expect(parseCupDate('TBD')).toBeNull();
    expect(parseCupDate('32.13')).toBeNull();
  });
});

describe('formatCupDate', () => {
  it('shows the weekday and day.month', () => {
    expect(formatCupDate('2026-11-14')).toBe('שבת 14.11');
    expect(formatCupDate('2026-11-14', 'en')).toBe('Sat 14.11');
    expect(formatCupDate('14.11', 'he', '2026-2027')).toBe('שבת 14.11');
  });

  it('leaves out the weekday when the year is unknown, and keeps text it cannot read', () => {
    expect(formatCupDate('14.11')).toBe('14.11');
    expect(formatCupDate('בקרוב')).toBe('בקרוב');
  });
});

describe('roundDateLabel', () => {
  it("uses any game's date — not only the first game's", () => {
    expect(roundDateLabel([{ date: null }, { date: '2026-12-05' }, { date: '' }])).toBe('שבת 05.12');
  });

  it('adds the start time when every timed game shares it', () => {
    expect(roundDateLabel([
      { date: '2026-12-05', game_time: '20:30:00' },
      { date: '2026-12-05', game_time: '20:30' },
      { date: '2026-12-05', game_time: null },
    ])).toBe('שבת 05.12 · 20:30');
    expect(roundDateLabel([
      { date: '2026-12-05', game_time: '19:00' },
      { date: '2026-12-05', game_time: '21:00' },
    ])).toBe('שבת 05.12');
  });

  it('shows a range when the games are on different days', () => {
    expect(roundDateLabel([{ date: '2026-11-21' }, { date: '2026-11-14' }, { date: '2026-11-21' }])).toBe('14.11 – 21.11');
  });

  it('returns null when no game has a date', () => {
    expect(roundDateLabel([{ date: null }, { date: 'TBD' }])).toBeNull();
  });
});
