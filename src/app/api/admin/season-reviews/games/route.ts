import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';

// GET /api/admin/season-reviews/games?season=YYYY-YYYY
//
// Returns the season's individual games / events (league results, cup games,
// playoff games) so the admin can pick ONE to focus a "free" review on. Each
// entry carries everything the generator needs, so the POST step doesn't
// re-query.

export type FocusGame = {
  competition: 'league' | 'cup' | 'playoff';
  label: string;
  round: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  date: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const season = new URL(req.url).searchParams.get('season')?.trim() || await getCurrentSeason();

    const [{ data: league }, { data: cup }, { data: series }, { data: pgames }] = await Promise.all([
      supabaseAdmin
        .from('game_results')
        .select('round, date, home_team, away_team, home_score, away_score')
        .eq('season', season)
        .order('round', { ascending: false }),
      supabaseAdmin
        .from('cup_games')
        .select('round, round_order, game_number, home_team, away_team, home_score, away_score, played, date')
        .eq('season', season)
        .order('round_order', { ascending: false })
        .order('game_number', { ascending: false }),
      supabaseAdmin
        .from('playoff_series')
        .select('series_number, team_a, team_b')
        .eq('season', season),
      supabaseAdmin
        .from('playoff_games')
        .select('series_number, game_number, home_score, away_score, played, game_date')
        .eq('season', season)
        .order('series_number', { ascending: false })
        .order('game_number', { ascending: true }),
    ]);

    const games: FocusGame[] = [];

    // ── Cup (events) ──────────────────────────────────────────────────────
    for (const g of (cup ?? []) as {
      round: string; home_team: string; away_team: string;
      home_score: number | null; away_score: number | null; played: boolean; date: string | null;
    }[]) {
      if (!g.played || g.home_score == null || g.away_score == null) continue;
      games.push({
        competition: 'cup',
        round: g.round,
        home_team: g.home_team,
        away_team: g.away_team,
        home_score: g.home_score,
        away_score: g.away_score,
        date: g.date,
        label: `🏆 גביע · ${g.round}: ${g.home_team} ${g.home_score}–${g.away_score} ${g.away_team}`,
      });
    }

    // ── Playoff games ─────────────────────────────────────────────────────
    const seriesByNum = new Map<number, { team_a: string; team_b: string }>();
    for (const s of (series ?? []) as { series_number: number; team_a: string; team_b: string }[]) {
      seriesByNum.set(s.series_number, { team_a: s.team_a, team_b: s.team_b });
    }
    for (const g of (pgames ?? []) as {
      series_number: number; game_number: number; home_score: number | null; away_score: number | null;
      played: boolean; game_date: string | null;
    }[]) {
      if (!g.played || g.home_score == null || g.away_score == null) continue;
      const s = seriesByNum.get(g.series_number);
      if (!s?.team_a || !s?.team_b) continue;
      // homeForGame: game 2 swaps home/away (matches /playoff/series logic).
      const home = g.game_number === 2 ? s.team_b : s.team_a;
      const away = g.game_number === 2 ? s.team_a : s.team_b;
      games.push({
        competition: 'playoff',
        round: `סדרה ${g.series_number} · משחק ${g.game_number}`,
        home_team: home,
        away_team: away,
        home_score: g.home_score,
        away_score: g.away_score,
        date: g.game_date,
        label: `🥇 פלייאוף · סדרה ${g.series_number} משחק ${g.game_number}: ${home} ${g.home_score}–${g.away_score} ${away}`,
      });
    }

    // ── League results ────────────────────────────────────────────────────
    for (const g of (league ?? []) as {
      round: number; date: string | null; home_team: string; away_team: string;
      home_score: number | null; away_score: number | null;
    }[]) {
      if (g.home_score == null || g.away_score == null) continue;
      games.push({
        competition: 'league',
        round: `מחזור ${g.round}`,
        home_team: g.home_team,
        away_team: g.away_team,
        home_score: g.home_score,
        away_score: g.away_score,
        date: g.date,
        label: `🏀 ליגה · מחזור ${g.round}: ${g.home_team} ${g.home_score}–${g.away_score} ${g.away_team}`,
      });
    }

    return NextResponse.json({ games });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה';
    return NextResponse.json({ error: msg, games: [] }, { status: 500 });
  }
}
