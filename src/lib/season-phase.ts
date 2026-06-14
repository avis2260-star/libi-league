// Single source of truth for "which phase of the season are we in".
//
// The phase drives what the home page leads with: during the regular season
// it shows the next-round league scoreboard strip; during the playoffs it
// swaps in the playoff scoreboard strip (upcoming playoff games). The value is
// stored as a row in `league_settings` (key='season_phase') — the same config
// pattern as `current_season`, `round_dates`, `ticker_auto`, etc. — and the
// league manager flips it from the admin "הגדרות ליגה" tab.
//
// When the admin hasn't set it explicitly we fall back to auto-detection:
// once the regular season is complete AND playoff games exist for the season,
// we treat the phase as 'playoffs'. This module is kept PURE for the resolver
// (no DB, no React) so it can be unit-tested in isolation; the DB getter is a
// thin wrapper at the bottom.

import { supabaseAdmin } from '@/lib/supabase-admin';

export type SeasonPhase = 'regular' | 'playoffs' | 'offseason';

export const SEASON_PHASE_KEY = 'season_phase';

export const SEASON_PHASE_LABELS: Record<SeasonPhase, { he: string; en: string }> = {
  regular:  { he: 'עונה סדירה', en: 'Regular season' },
  playoffs: { he: 'פלייאוף',    en: 'Playoffs' },
  offseason:{ he: 'בין העונות', en: 'Off-season' },
};

export function isSeasonPhase(v: unknown): v is SeasonPhase {
  return v === 'regular' || v === 'playoffs' || v === 'offseason';
}

/**
 * Resolve the active phase. The explicit admin setting always wins; only when
 * it is missing/garbled do we auto-detect playoffs from the season state.
 */
export function resolveSeasonPhase(opts: {
  setting: string | null | undefined;
  regularSeasonComplete: boolean;
  hasPlayoffGames: boolean;
}): SeasonPhase {
  const s = (opts.setting ?? '').trim().toLowerCase();
  if (isSeasonPhase(s)) return s;
  if (opts.regularSeasonComplete && opts.hasPlayoffGames) return 'playoffs';
  return 'regular';
}

/** Read the explicit league_settings.season_phase value (null when unset). */
export async function getSeasonPhaseSetting(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('value')
      .eq('key', SEASON_PHASE_KEY)
      .maybeSingle();
    return data?.value?.trim() || null;
  } catch {
    return null;
  }
}
