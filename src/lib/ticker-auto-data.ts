// DB-backed wrapper around the pure ticker-auto builder. Fetches the current
// season's scoring leader, standings and results, resolves team names through
// the admin "קבוצות" tab, and returns the spotlight items. Used by both the
// public home page and the admin "הודעות" tab (for the live preview).

import { supabaseAdmin } from './supabase-admin';
import { makeNameResolver } from './team-name-resolver';
import {
  parseAutoConfig,
  computeStreaks,
  lastRoundHighScorer,
  buildAutoTickerItems,
  type AutoTickerItem,
  type GameResultLike,
  type GameStatLike,
  type GameDateLike,
} from './ticker-auto';

type StandingRow = { name: string; division: string; pts: number | null; rank: number | null };

export async function getAutoTickerItems(season: string): Promise<AutoTickerItem[]> {
  try {
    const [
      { data: cfgRow },
      { data: standings },
      { data: results },
      { data: teams },
      { data: games },
      { data: gameStats },
      { data: players },
    ] = await Promise.all([
      supabaseAdmin.from('league_settings').select('value').eq('key', 'ticker_auto').maybeSingle(),
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
      // For the last-round high scorer: game dates + per-game player points.
      supabaseAdmin.from('games').select('id, game_date').eq('season', season),
      supabaseAdmin.from('game_stats').select('player_id, points, game_id').eq('season', season),
      supabaseAdmin.from('players').select('id, name'),
    ]);

    const config = parseAutoConfig(cfgRow?.value ?? null);
    const resolve = makeNameResolver((teams ?? []) as { id: string; name: string }[]);

    // Top scorer = the high scorer of the most recent round that has stats
    // (not the season cumulative leader). Player names aren't team names, so
    // no name resolution is needed.
    const todayIso = new Date().toISOString().slice(0, 10);
    const winner = lastRoundHighScorer(
      (gameStats ?? []) as GameStatLike[],
      (games ?? []) as GameDateLike[],
      todayIso,
    );
    const nameById = new Map(((players ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]));
    const topScorer = winner && nameById.has(winner.playerId)
      ? { id: winner.playerId, name: nameById.get(winner.playerId)!, points: winner.points }
      : null;

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
