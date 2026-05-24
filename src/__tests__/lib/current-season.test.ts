// ---------------------------------------------------------------------------
// We mock @/lib/supabase-admin before importing current-season so that
// the module-level createClient() call never runs.
// ---------------------------------------------------------------------------

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  FALLBACK_SEASON,
  getCurrentSeason,
  clearCurrentSeasonCache,
  resolveSeasonFromParams,
  listKnownSeasons,
} from '@/lib/current-season';

// ---------------------------------------------------------------------------
// Helper – configure the mock chain for getCurrentSeason()
//
// getCurrentSeason does:
//   supabaseAdmin.from('league_settings').select('value').eq('key', …).maybeSingle()
// ---------------------------------------------------------------------------

function mockGetCurrentSeason(resolvedValue: { data: { value: string } | null }) {
  const maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  (supabaseAdmin.from as jest.Mock).mockReturnValue({ select });
}

// ---------------------------------------------------------------------------
// Helper – configure the mock chain for listKnownSeasons()
//
// listKnownSeasons does:
//   Promise.all([
//     supabaseAdmin.from('games').select('season'),       ← thenable
//     supabaseAdmin.from('game_results').select('season'), ← thenable
//   ])
// followed by getCurrentSeason() (which uses the same from mock).
// We therefore set up three sequential from() responses.
// ---------------------------------------------------------------------------

function makeSelectBuilder(rows: { season?: string | null }[]) {
  const selectResult: Record<string, unknown> = {
    data: rows,
    then: (res: (v: { data: typeof rows }) => unknown) =>
      Promise.resolve({ data: rows }).then(res),
  };
  return { select: jest.fn().mockReturnValue(selectResult) };
}

// ---------------------------------------------------------------------------
// FALLBACK_SEASON constant
// ---------------------------------------------------------------------------

describe('FALLBACK_SEASON', () => {
  it('has the YYYY-YYYY format', () => {
    expect(FALLBACK_SEASON).toMatch(/^\d{4}-\d{4}$/);
  });

  it('is the expected value', () => {
    expect(FALLBACK_SEASON).toBe('2025-2026');
  });
});

// ---------------------------------------------------------------------------
// clearCurrentSeasonCache
// ---------------------------------------------------------------------------

describe('clearCurrentSeasonCache', () => {
  it('can be called without throwing', () => {
    expect(() => clearCurrentSeasonCache()).not.toThrow();
  });

  it('can be called multiple times without throwing', () => {
    clearCurrentSeasonCache();
    clearCurrentSeasonCache();
  });
});

// ---------------------------------------------------------------------------
// getCurrentSeason
// ---------------------------------------------------------------------------

describe('getCurrentSeason', () => {
  beforeEach(() => {
    clearCurrentSeasonCache();
    jest.clearAllMocks();
  });

  it('returns the value fetched from the database', async () => {
    mockGetCurrentSeason({ data: { value: '2024-2025' } });
    await expect(getCurrentSeason()).resolves.toBe('2024-2025');
  });

  it('trims whitespace from the returned value', async () => {
    mockGetCurrentSeason({ data: { value: '  2024-2025  ' } });
    await expect(getCurrentSeason()).resolves.toBe('2024-2025');
  });

  it('falls back to FALLBACK_SEASON when the DB row is null', async () => {
    mockGetCurrentSeason({ data: null });
    await expect(getCurrentSeason()).resolves.toBe(FALLBACK_SEASON);
  });

  it('falls back to FALLBACK_SEASON when value is an empty string', async () => {
    mockGetCurrentSeason({ data: { value: '' } });
    await expect(getCurrentSeason()).resolves.toBe(FALLBACK_SEASON);
  });

  it('falls back to FALLBACK_SEASON when value is whitespace only', async () => {
    mockGetCurrentSeason({ data: { value: '   ' } });
    await expect(getCurrentSeason()).resolves.toBe(FALLBACK_SEASON);
  });

  it('caches the result so the DB is not hit on the second call', async () => {
    mockGetCurrentSeason({ data: { value: '2024-2025' } });

    await getCurrentSeason(); // populates cache
    await getCurrentSeason(); // should use cache

    // from() is only called once (one DB round-trip)
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('re-queries after the cache is cleared with clearCurrentSeasonCache()', async () => {
    mockGetCurrentSeason({ data: { value: '2024-2025' } });
    const first = await getCurrentSeason();

    clearCurrentSeasonCache();
    mockGetCurrentSeason({ data: { value: '2025-2026' } });
    const second = await getCurrentSeason();

    expect(first).toBe('2024-2025');
    expect(second).toBe('2025-2026');
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// resolveSeasonFromParams – URLSearchParams input
// ---------------------------------------------------------------------------

describe('resolveSeasonFromParams – URLSearchParams', () => {
  beforeEach(() => {
    clearCurrentSeasonCache();
    jest.clearAllMocks();
    // All tests in this block use '2025-2026' as the "current" season
    mockGetCurrentSeason({ data: { value: '2025-2026' } });
  });

  it('uses the ?season param when it has the correct YYYY-YYYY format', async () => {
    const result = await resolveSeasonFromParams(new URLSearchParams('season=2024-2025'));
    expect(result.viewing).toBe('2024-2025');
  });

  it('falls back to the current season when ?season is absent', async () => {
    const result = await resolveSeasonFromParams(new URLSearchParams(''));
    expect(result.viewing).toBe('2025-2026');
  });

  it('falls back to the current season when ?season format is invalid', async () => {
    const result = await resolveSeasonFromParams(new URLSearchParams('season=invalid'));
    expect(result.viewing).toBe('2025-2026');
  });

  it('falls back to the current season when ?season is a single year (not YYYY-YYYY)', async () => {
    const result = await resolveSeasonFromParams(new URLSearchParams('season=2025'));
    expect(result.viewing).toBe('2025-2026');
  });

  it('falls back to the current season when ?season has the wrong separator', async () => {
    const result = await resolveSeasonFromParams(new URLSearchParams('season=2025/2026'));
    expect(result.viewing).toBe('2025-2026');
  });

  it('always returns the current season value', async () => {
    const result = await resolveSeasonFromParams(new URLSearchParams('season=2024-2025'));
    expect(result.current).toBe('2025-2026');
  });

  it('sets isArchive=false when viewing the current season', async () => {
    const result = await resolveSeasonFromParams(new URLSearchParams('season=2025-2026'));
    expect(result.isArchive).toBe(false);
  });

  it('sets isArchive=true when viewing a different (archive) season', async () => {
    const result = await resolveSeasonFromParams(new URLSearchParams('season=2024-2025'));
    expect(result.isArchive).toBe(true);
  });

  it('sets isArchive=false when no ?season is provided (defaults to current)', async () => {
    const result = await resolveSeasonFromParams(new URLSearchParams());
    expect(result.isArchive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveSeasonFromParams – plain object input (Next.js searchParams shape)
// ---------------------------------------------------------------------------

describe('resolveSeasonFromParams – plain object', () => {
  beforeEach(() => {
    clearCurrentSeasonCache();
    jest.clearAllMocks();
    mockGetCurrentSeason({ data: { value: '2025-2026' } });
  });

  it('uses the season key when it has the correct format', async () => {
    const result = await resolveSeasonFromParams({ season: '2023-2024' });
    expect(result.viewing).toBe('2023-2024');
  });

  it('falls back to current when the season key is absent', async () => {
    const result = await resolveSeasonFromParams({});
    expect(result.viewing).toBe('2025-2026');
  });

  it('falls back to current when season is an empty string', async () => {
    const result = await resolveSeasonFromParams({ season: '' });
    expect(result.viewing).toBe('2025-2026');
  });

  it('handles an array season param by using the first element', async () => {
    const result = await resolveSeasonFromParams({ season: ['2023-2024', '2024-2025'] });
    expect(result.viewing).toBe('2023-2024');
  });

  it('falls back to current when season array is empty', async () => {
    const result = await resolveSeasonFromParams({ season: [] });
    expect(result.viewing).toBe('2025-2026');
  });
});

// ---------------------------------------------------------------------------
// listKnownSeasons
// ---------------------------------------------------------------------------

describe('listKnownSeasons', () => {
  beforeEach(() => {
    clearCurrentSeasonCache();
    jest.clearAllMocks();
  });

  it('always includes the current season even when tables are empty', async () => {
    // from() is called three times:
    //   1st → league_settings (for getCurrentSeason)
    //   2nd → games
    //   3rd → game_results
    const maybeSingle = jest.fn().mockResolvedValue({ data: { value: '2025-2026' } });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const settingsSelect = jest.fn().mockReturnValue({ eq });

    (supabaseAdmin.from as jest.Mock)
      .mockImplementationOnce(() => ({ select: settingsSelect })) // league_settings
      .mockImplementationOnce(() => makeSelectBuilder([]))        // games (empty)
      .mockImplementationOnce(() => makeSelectBuilder([]));       // game_results (empty)

    const seasons = await listKnownSeasons();
    expect(seasons).toContain('2025-2026');
  });

  it('returns seasons sorted newest first', async () => {
    const maybySingle = jest.fn().mockResolvedValue({ data: { value: '2025-2026' } });
    const eq = jest.fn().mockReturnValue({ maybeSingle: maybySingle });
    const settingsSelect = jest.fn().mockReturnValue({ eq });

    (supabaseAdmin.from as jest.Mock)
      .mockImplementationOnce(() => ({ select: settingsSelect }))
      .mockImplementationOnce(() =>
        makeSelectBuilder([{ season: '2023-2024' }, { season: '2024-2025' }]),
      )
      .mockImplementationOnce(() => makeSelectBuilder([{ season: '2022-2023' }]));

    const seasons = await listKnownSeasons();
    // Should be sorted descending
    for (let i = 0; i < seasons.length - 1; i++) {
      expect(seasons[i].localeCompare(seasons[i + 1])).toBeGreaterThan(0);
    }
  });

  it('deduplicates seasons that appear in both games and game_results', async () => {
    const maybySingle = jest.fn().mockResolvedValue({ data: { value: '2025-2026' } });
    const eq = jest.fn().mockReturnValue({ maybeSingle: maybySingle });
    const settingsSelect = jest.fn().mockReturnValue({ eq });

    (supabaseAdmin.from as jest.Mock)
      .mockImplementationOnce(() => ({ select: settingsSelect }))
      .mockImplementationOnce(() => makeSelectBuilder([{ season: '2024-2025' }]))
      .mockImplementationOnce(() => makeSelectBuilder([{ season: '2024-2025' }]));

    const seasons = await listKnownSeasons();
    const count = seasons.filter((s) => s === '2024-2025').length;
    expect(count).toBe(1);
  });

  it('falls back to [current] when the DB throws', async () => {
    const maybySingle = jest.fn().mockResolvedValue({ data: { value: '2025-2026' } });
    const eq = jest.fn().mockReturnValue({ maybeSingle: maybySingle });
    const settingsSelect = jest.fn().mockReturnValue({ eq });

    (supabaseAdmin.from as jest.Mock)
      .mockImplementationOnce(() => ({ select: settingsSelect })) // getCurrentSeason succeeds
      .mockImplementationOnce(() => {
        throw new Error('DB unavailable');
      });

    const seasons = await listKnownSeasons();
    expect(seasons).toEqual(['2025-2026']);
  });
});
