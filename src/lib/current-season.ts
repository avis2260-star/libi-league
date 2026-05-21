/**
 * Single source of truth for "what season are we currently in".
 *
 * The value is stored as a row in `league_settings` (key='current_season').
 * A "התחל עונה חדשה" button in the admin bumps it. Every list query in
 * the app filters by this value so old rows naturally drop out of view
 * without anything being deleted.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';

export const FALLBACK_SEASON = '2025-2026';
const SETTING_KEY = 'current_season';

let cached: { value: string; at: number } | null = null;
const TTL_MS = 30_000;

export async function getCurrentSeason(): Promise<string> {
  // Short in-memory cache so a single page render doesn't hit Supabase
  // multiple times for the same value.
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const { data } = await supabaseAdmin
    .from('league_settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .maybeSingle();

  const value = data?.value?.trim() || FALLBACK_SEASON;
  cached = { value, at: Date.now() };
  return value;
}

/**
 * Invalidate the cache. Call this from the API route that bumps the
 * current season so the next request reads the new value immediately.
 */
export function clearCurrentSeasonCache(): void {
  cached = null;
}

/**
 * Resolve which season a request should display.
 *
 * Pages opt into archive viewing via `?season=2025-2026`. If the param is
 * absent or doesn't match the YYYY-YYYY shape we fall back to the live
 * `current_season` setting. This is the helper every page-level component
 * should call instead of `getCurrentSeason()` directly — it folds the URL
 * override into the same return type.
 *
 * Returns BOTH values so callers can decide whether to show the archive
 * banner (viewing !== current).
 */
export async function resolveSeasonFromParams(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): Promise<{ viewing: string; current: string; isArchive: boolean }> {
  const current = await getCurrentSeason();
  const raw =
    searchParams instanceof URLSearchParams
      ? searchParams.get('season')
      : (Array.isArray(searchParams.season) ? searchParams.season[0] : searchParams.season);

  const requested = typeof raw === 'string' ? raw.trim() : '';
  const viewing = /^\d{4}-\d{4}$/.test(requested) ? requested : current;
  return { viewing, current, isArchive: viewing !== current };
}

/**
 * List every season the DB has data for, newest first.
 *
 * We union DISTINCT season values across the high-volume operational tables
 * (games + game_results). Anything older that never had a games row also
 * wouldn't show up here, but in practice every season produces games rows.
 * Always includes the current_season value so the picker can show "now"
 * even on a freshly-bumped season that has no data yet.
 */
export async function listKnownSeasons(): Promise<string[]> {
  const current = await getCurrentSeason();
  try {
    const [{ data: g }, { data: r }] = await Promise.all([
      supabaseAdmin.from('games').select('season'),
      supabaseAdmin.from('game_results').select('season'),
    ]);
    const all = new Set<string>([current]);
    for (const row of (g ?? []) as { season?: string | null }[]) {
      if (row.season) all.add(row.season);
    }
    for (const row of (r ?? []) as { season?: string | null }[]) {
      if (row.season) all.add(row.season);
    }
    // Sort newest first — '2026-2027' > '2025-2026' lexicographically.
    return [...all].sort((a, b) => b.localeCompare(a));
  } catch {
    return [current];
  }
}
