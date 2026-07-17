import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';
import { buildRostersByName } from '@/lib/build-rosters';

// GET — series + games + top 4 from each division for dropdowns,
//       plus rosters (for stat entry) and existing per-game player stats.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const season = await getCurrentSeason();
  const [{ data: series }, { data: games }, { data: standings }, { data: teams }, { data: players }, { data: stats }] =
    await Promise.all([
      supabaseAdmin.from('playoff_series').select('*').eq('season', season).order('series_number'),
      supabaseAdmin.from('playoff_games').select('*').eq('season', season).order('series_number').order('game_number'),
      supabaseAdmin.from('standings').select('name,division,rank').eq('season', season).order('rank', { ascending: true }),
      supabaseAdmin.from('teams').select('id,name'),
      supabaseAdmin.from('players').select('id,name,jersey_number,team_id').eq('is_active', true).order('name'),
      supabaseAdmin
        .from('playoff_game_stats')
        .select('series_number,game_number,player_id,points,three_pointers,fouls')
        .eq('season', season),
    ]);

  const all = (standings ?? []) as { name: string; division: string; rank: number }[];
  const northTeams = all.filter(s => s.division === 'North').slice(0, 4).map(s => s.name);
  const southTeams = all.filter(s => s.division === 'South').slice(0, 4).map(s => s.name);

  // Rosters keyed by the team-name strings used on series (team_a / team_b).
  const seriesRows = (series ?? []) as { team_a: string; team_b: string }[];
  const teamNames = [...new Set(seriesRows.flatMap(s => [s.team_a, s.team_b]).filter(Boolean))];
  const rostersByTeam = buildRostersByName(
    teamNames,
    (teams ?? []) as { id: string; name: string }[],
    (players ?? []) as { id: string; name: string; jersey_number: number | null; team_id: string | null }[],
  );

  return NextResponse.json({
    series: series ?? [],
    games: games ?? [],
    northTeams,
    southTeams,
    rostersByTeam,
    stats: stats ?? [],
  });
}

// Bracket template — the 7-series structure used across /playoff
// (1-4 quarter-finals, 5-6 semi-finals fed by QF winners, 7 the final).
const SERIES_TEMPLATE: { series_number: number; team_a_label: string; team_b_label: string }[] = [
  { series_number: 1, team_a_label: 'דרום #1', team_b_label: 'צפון #4' },
  { series_number: 2, team_a_label: 'דרום #2', team_b_label: 'צפון #3' },
  { series_number: 3, team_a_label: 'צפון #1', team_b_label: 'דרום #4' },
  { series_number: 4, team_a_label: 'צפון #2', team_b_label: 'דרום #3' },
  { series_number: 5, team_a_label: 'נצח סדרה 1', team_b_label: 'נצח סדרה 2' },
  { series_number: 6, team_a_label: 'נצח סדרה 3', team_b_label: 'נצח סדרה 4' },
  { series_number: 7, team_a_label: 'נצח סדרה 5', team_b_label: 'נצח סדרה 6' },
];
const SERIES_FEED: Record<number, [number, number]> = { 5: [1, 2], 6: [3, 4], 7: [5, 6] };

// POST — create any missing bracket series for the season, prefilling SF/final
// teams from decided earlier-round winners so the admin rarely has to pick.
export async function POST() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const season = await getCurrentSeason();
  const [{ data: existing }, { data: games }] = await Promise.all([
    supabaseAdmin.from('playoff_series').select('series_number, team_a, team_b').eq('season', season),
    supabaseAdmin.from('playoff_games').select('series_number, game_number, home_score, away_score').eq('season', season),
  ]);

  const rows = (existing ?? []) as { series_number: number; team_a: string | null; team_b: string | null }[];
  const gameRows = (games ?? []) as { series_number: number; game_number: number; home_score: number | null; away_score: number | null }[];
  const have = new Set(rows.map(r => r.series_number));
  const missing = SERIES_TEMPLATE.filter(t => !have.has(t.series_number));
  if (missing.length === 0) return NextResponse.json({ created: 0 });

  // Winner of a decided best-of-3 series (game 2 swaps home/away).
  const winnerOf = (n: number): string => {
    const sr = rows.find(r => r.series_number === n);
    if (!sr?.team_a || !sr?.team_b) return '';
    let winsA = 0, winsB = 0;
    for (const g of gameRows) {
      if (g.series_number !== n || g.home_score == null || g.away_score == null) continue;
      const home: string | null = g.game_number === 2 ? sr.team_b : sr.team_a;
      const homeWon = g.home_score > g.away_score;
      if ((homeWon && home === sr.team_a) || (!homeWon && home !== sr.team_a)) winsA++;
      else winsB++;
    }
    return winsA >= 2 ? (sr.team_a ?? '') : winsB >= 2 ? (sr.team_b ?? '') : '';
  };

  const inserts = missing.map(t => {
    const feed = SERIES_FEED[t.series_number];
    return {
      season,
      series_number: t.series_number,
      team_a_label: t.team_a_label,
      team_b_label: t.team_b_label,
      team_a: feed ? winnerOf(feed[0]) : '',
      team_b: feed ? winnerOf(feed[1]) : '',
    };
  });

  const { error } = await supabaseAdmin.from('playoff_series').insert(inserts);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ created: inserts.length });
}

// PUT — update a series team names
export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const season = await getCurrentSeason();
  const body = await req.json();
  const { series_number, team_a, team_b } = body;
  const { error } = await supabaseAdmin
    .from('playoff_series')
    .update({ team_a, team_b })
    .eq('season', season)
    .eq('series_number', series_number);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH — update a single game result
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const season = await getCurrentSeason();
  const body = await req.json();
  const { series_number, game_number, home_score, away_score, played, game_date, game_time, video_url, location } = body;

  const update: Record<string, unknown> = { played: played ?? false };
  if (home_score !== undefined) update.home_score = home_score;
  if (away_score !== undefined) update.away_score = away_score;
  if (game_date  !== undefined) update.game_date  = game_date;
  if (game_time  !== undefined) {
    const trimmed = typeof game_time === 'string' ? game_time.trim() : '';
    if (trimmed && !/^\d{1,2}:\d{2}$/.test(trimmed)) {
      return NextResponse.json({ error: 'שעה חייבת להיות בפורמט HH:MM' }, { status: 400 });
    }
    update.game_time = trimmed || null;
  }
  if (video_url  !== undefined) {
    const trimmed = typeof video_url === 'string' ? video_url.trim() : '';
    if (trimmed && !/^https?:\/\/.+/.test(trimmed)) {
      return NextResponse.json({ error: 'קישור וידאו חייב להתחיל ב-http:// או https://' }, { status: 400 });
    }
    update.video_url = trimmed || null;
  }
  if (location !== undefined) {
    const trimmed = typeof location === 'string' ? location.trim() : '';
    update.location = trimmed || null;
  }

  // Upsert keyed on (season, series_number, game_number) — the same shape as
  // the unique constraint added in 20260521_add_season_column.sql. Two seasons
  // can have a row for series 1 game 1 without one stomping the other.
  let { error } = await supabaseAdmin
    .from('playoff_games')
    .upsert({ series_number, game_number, season, ...update }, { onConflict: 'season,series_number,game_number' });

  // Tolerate the game_time column not existing yet (migration not applied):
  // retry without it so saving scores/dates still works.
  if (error && 'game_time' in update) {
    const rest = { ...update };
    delete rest.game_time;
    ({ error } = await supabaseAdmin
      .from('playoff_games')
      .upsert({ series_number, game_number, season, ...rest }, { onConflict: 'season,series_number,game_number' }));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
