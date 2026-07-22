// DB-backed wrapper around the pure ticker-auto builder. Fetches the current
// season's scoring leader, standings and results, resolves team names through
// the admin "קבוצות" tab, and returns the spotlight items. Used by both the
// public home page and the admin "הודעות" tab (for the live preview).

import { supabaseAdmin } from './supabase-admin';
import { makeNameResolver } from './team-name-resolver';
import { isSeasonPhase, SEASON_PHASE_KEY, type SeasonPhase } from './season-phase';
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
      { data: cupFinals },
      { data: playoffGames },
      { data: playoffSeries },
      { data: playoffStats },
      { data: phaseRow },
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
      supabaseAdmin.from('players').select('id, name, points, is_active'),
      // Season-end / playoff lines:
      supabaseAdmin.from('cup_games').select('home_team, away_team, home_score, away_score, played').eq('season', season).eq('round', 'גמר'),
      supabaseAdmin.from('playoff_games').select('series_number, game_number, home_score, away_score, played, game_date, game_time').eq('season', season),
      supabaseAdmin.from('playoff_series').select('series_number, team_a, team_b').eq('season', season),
      supabaseAdmin.from('playoff_game_stats').select('player_id, points').eq('season', season),
      supabaseAdmin.from('league_settings').select('value').eq('key', SEASON_PHASE_KEY).maybeSingle(),
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

    // ── Playoff lines ──────────────────────────────────────────────────────
    type PoGame = {
      series_number: number; game_number: number;
      home_score: number | null; away_score: number | null;
      played: boolean | null; game_date: string | null; game_time: string | null;
    };
    const poGames = (playoffGames ?? []) as PoGame[];

    // Playoffs underway = at least one unplayed playoff game this season.
    const playoffsActive = poGames.some((g) => !g.played);

    // Active phase: the explicit admin setting wins; else having any playoff
    // rows for the season is a good-enough signal (regular-season spotlight
    // data is frozen by then anyway).
    const phaseSetting = (phaseRow?.value ?? '').trim().toLowerCase();
    const phase: SeasonPhase = isSeasonPhase(phaseSetting)
      ? phaseSetting
      : poGames.length > 0 ? 'playoffs' : 'regular';

    // Playoff cumulative scoring leader (playoff_game_stats is playoff-only).
    const poTotals = new Map<string, number>();
    for (const s of (playoffStats ?? []) as { player_id: string; points: number | null }[]) {
      poTotals.set(s.player_id, (poTotals.get(s.player_id) ?? 0) + (s.points ?? 0));
    }
    let playoffTopScorer: { name: string; points: number } | null = null;
    for (const [pid, pts] of poTotals) {
      const nm = nameById.get(pid);
      if (nm && pts > 0 && pts > (playoffTopScorer?.points ?? 0)) playoffTopScorer = { name: nm, points: pts };
    }

    // Series teams (explicit team_a/team_b only) + wins tally, mirroring the
    // game-2 home/away swap used across /playoff.
    const pairBySeries = new Map<number, { a: string; b: string }>();
    for (const s of (playoffSeries ?? []) as { series_number: number; team_a: string | null; team_b: string | null }[]) {
      const a = s.team_a?.trim(); const b = s.team_b?.trim();
      if (a && b) pairBySeries.set(s.series_number, { a: resolve(a), b: resolve(b) });
    }
    const homeFor = (pair: { a: string; b: string }, gNum: number) => (gNum === 2 ? pair.b : pair.a);
    const winsBySeries = new Map<number, { a: number; b: number }>();
    for (const g of poGames) {
      if (g.home_score == null || g.away_score == null) continue;
      const pair = pairBySeries.get(g.series_number); if (!pair) continue;
      const home = homeFor(pair, g.game_number);
      const homeWon = g.home_score > g.away_score;
      const w = winsBySeries.get(g.series_number) ?? { a: 0, b: 0 };
      if ((homeWon && home === pair.a) || (!homeWon && home !== pair.a)) w.a++; else w.b++;
      winsBySeries.set(g.series_number, w);
    }
    const winsNeeded = (n: number) => (n >= 7 ? 1 : 2); // final = single game

    // Next playoff game — earliest-dated pending game of an undecided series
    // (undated games sort last).
    let playoffNextGame: { teamA: string; teamB: string; dateLabel: string | null } | null = null;
    let nextKey = '';
    for (const g of poGames) {
      if (g.played || (g.home_score != null && g.away_score != null)) continue;
      const pair = pairBySeries.get(g.series_number); if (!pair) continue;
      const w = winsBySeries.get(g.series_number) ?? { a: 0, b: 0 };
      if (w.a >= winsNeeded(g.series_number) || w.b >= winsNeeded(g.series_number)) continue;
      const key = `${g.game_date ?? '9999-12-31'}|${String(g.series_number).padStart(2, '0')}|${g.game_number}`;
      if (playoffNextGame && key >= nextKey) continue;
      nextKey = key;
      const m = g.game_date?.match(/^\d{4}-(\d{2})-(\d{2})/);
      const dateLabel = m ? `${parseInt(m[2], 10)}.${parseInt(m[1], 10)}` : null;
      const time = g.game_time && g.game_time !== '00:00:00' ? g.game_time.slice(0, 5) : null;
      const teamA = homeFor(pair, g.game_number);
      playoffNextGame = {
        teamA,
        teamB: teamA === pair.a ? pair.b : pair.a,
        dateLabel: dateLabel && time ? `${dateLabel} · ${time}` : (dateLabel ?? time),
      };
    }

    // Latest playoff result — most recent played game (by date, then series/game).
    let playoffResult: { seriesNumber: number; homeName: string; awayName: string; homeScore: number; awayScore: number } | null = null;
    let resKey = '';
    for (const g of poGames) {
      if (g.home_score == null || g.away_score == null) continue;
      const pair = pairBySeries.get(g.series_number); if (!pair) continue;
      const key = `${g.game_date ?? ''}|${String(g.series_number).padStart(2, '0')}|${g.game_number}`;
      if (playoffResult && key <= resKey) continue;
      resKey = key;
      const homeName = homeFor(pair, g.game_number);
      playoffResult = {
        seriesNumber: g.series_number,
        homeName,
        awayName: homeName === pair.a ? pair.b : pair.a,
        homeScore: g.home_score,
        awayScore: g.away_score,
      };
    }

    // Season cumulative scoring leader — only surfaced once the season is
    // winding down (playoffs underway); during the regular season the
    // "קלע המחזור" round line already covers scoring.
    const seasonLeader = ((players ?? []) as { id: string; name: string; points: number | null; is_active?: boolean }[])
      .filter((p) => p.is_active !== false)
      .reduce<{ id: string; name: string; points: number } | null>(
        (best, p) => ((p.points ?? 0) > (best?.points ?? 0) ? { id: p.id, name: p.name, points: p.points ?? 0 } : best),
        null,
      );
    const seasonTopScorer = playoffsActive && seasonLeader && seasonLeader.points > 0 ? seasonLeader : null;

    // Cup holder = decided cup-final winner (resolved to the canonical team name).
    type CupFinalRow = { home_team: string; away_team: string; home_score: number | null; away_score: number | null; played: boolean | null };
    const decidedCup = ((cupFinals ?? []) as CupFinalRow[]).find(
      (f) => f.played && f.home_score != null && f.away_score != null && f.home_score !== f.away_score,
    );
    const cupHolder = decidedCup
      ? resolve(decidedCup.home_score! > decidedCup.away_score! ? decidedCup.home_team : decidedCup.away_team)
      : null;

    return buildAutoTickerItems({
      config, topScorer, divisions, streaks, seasonTopScorer, cupHolder, playoffsActive,
      playoffTopScorer, playoffNextGame, playoffResult, phase,
    });
  } catch {
    // On any failure, return nothing auto-generated rather than breaking the
    // page or the admin tab.
    return [];
  }
}
