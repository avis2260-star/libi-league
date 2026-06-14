// Mock supabase-admin so importing season-phase never runs a real client.
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

import { resolveSeasonPhase, isSeasonPhase } from '@/lib/season-phase';

describe('isSeasonPhase', () => {
  it('accepts the three known phases', () => {
    expect(isSeasonPhase('regular')).toBe(true);
    expect(isSeasonPhase('playoffs')).toBe(true);
    expect(isSeasonPhase('offseason')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isSeasonPhase('finals')).toBe(false);
    expect(isSeasonPhase('')).toBe(false);
    expect(isSeasonPhase(null)).toBe(false);
    expect(isSeasonPhase(undefined)).toBe(false);
  });
});

describe('resolveSeasonPhase', () => {
  it('honours an explicit admin setting over auto-detection', () => {
    // Even with a completed regular season + playoff games, an explicit
    // "regular" keeps the regular strip up (admin override wins).
    expect(resolveSeasonPhase({ setting: 'regular', regularSeasonComplete: true, hasPlayoffGames: true })).toBe('regular');
    expect(resolveSeasonPhase({ setting: 'playoffs', regularSeasonComplete: false, hasPlayoffGames: false })).toBe('playoffs');
    expect(resolveSeasonPhase({ setting: 'offseason', regularSeasonComplete: true, hasPlayoffGames: true })).toBe('offseason');
  });

  it('is case/whitespace tolerant on the setting', () => {
    expect(resolveSeasonPhase({ setting: '  PLAYOFFS ', regularSeasonComplete: false, hasPlayoffGames: false })).toBe('playoffs');
  });

  it('auto-detects playoffs only when the season is over AND playoff games exist', () => {
    expect(resolveSeasonPhase({ setting: null, regularSeasonComplete: true, hasPlayoffGames: true })).toBe('playoffs');
    expect(resolveSeasonPhase({ setting: '', regularSeasonComplete: true, hasPlayoffGames: true })).toBe('playoffs');
  });

  it('falls back to regular when auto-detection is not satisfied', () => {
    expect(resolveSeasonPhase({ setting: null, regularSeasonComplete: false, hasPlayoffGames: true })).toBe('regular');
    expect(resolveSeasonPhase({ setting: null, regularSeasonComplete: true, hasPlayoffGames: false })).toBe('regular');
    expect(resolveSeasonPhase({ setting: 'garbage', regularSeasonComplete: false, hasPlayoffGames: false })).toBe('regular');
  });
});
