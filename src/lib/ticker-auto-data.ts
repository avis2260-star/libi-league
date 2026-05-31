// DB-backed wrapper around the pure ticker-auto builder. Fetches the current
// season's scoring leader, standings and results, resolves team names through
// the admin "קבוצות" tab, and returns the spotlight items. Used by both the
// public home page and the admin "הודעות" tab (for the live preview).

import { supabaseAdmin } from './supabase-admin';
import { makeNameResolver } from './team-name-resolver';
import {
  parseAutoConfig,
  computeStreaks,
  buildAutoTickerItems,
  type AutoTickerItem,
  type GameResultLike,
} from './ticker-auto';

type StandingRow = { name: string; division: string; pts: number | null; rank: number | null };

export async function getAutoTickerItems(season: string): Promise<AutoTickerItem[]> {
  try {
    const [
      { data: cfgRow },
      { data: topRows },
      { data: standings },
      { data: results },
      { data: teams },
    ] = await Promise.all([
      supabaseAdmin.from('league_settings').select('value').eq('key', 'ticker_auto').maybeSingle(),
      supabaseAdmin
        .from('players')
        .select('id, name, points')
        .eq('is_active', true)
        .gt('points', 0)
        .order('points', { ascending: false })
        .limit(1),
      supabaseAdmin
        .from('standings')
        .select('name, division, pts, rank')
        .eq('season', season)
        .order('rank', { ascending: true }),
      supabaseAdmin
        .from('game_results')
        .select('round, home_team, away_team, home_score, away_score, techni')
        .eq('season', season),
      supabaseAdmin.from('teams').select('id, name'),
    ]);

    const config = parseAutoConfig(cfgRow?.value ?? null);
    const resolve = makeNameResolver((teams ?? []) as { id: string; name: string }[]);

    // Top scorer (player names aren't team names — no resolution needed)
    const top = (topRows ?? [])[0] as { id: string; name: string; points: number } | undefined;
    const topScorer = top ? { id: top.id, name: top.name, points: top.points } : null;

    // Standings grouped by division, names resolved, kept rank-sorted.
    const divMap = new Map<string, { name: string; pts: number }[]>();
    for (const s of (standings ?? []) as StandingRow[]) {
      const arr = divMap.get(s.division) ?? [];
      arr.push({ name: resolve(s.name), pts: s.pts ?? 0 });
      divMap.set(s.division, arr);
    }
    const divisions = [...divMap.entries()].map(([division, rows]) => ({ division, rows }));

    // Resolve team names on results BEFORE computing streaks so a team's games
    // aren't split across name variants (parity with the standings page).
    const resolvedResults = ((results ?? []) as GameResultLike[]).map((r) => ({
      ...r,
      home_team: r.home_team ? resolve(r.home_team) : r.home_team,
      away_team: r.away_team ? resolve(r.away_team) : r.away_team,
    }));
    const streaks = computeStreaks(resolvedResults);

    return buildAutoTickerItems({ config, topScorer, divisions, streaks });
  } catch {
    // On any failure, return nothing auto-generated rather than breaking the
    // page or the admin tab.
    return [];
  }
}
