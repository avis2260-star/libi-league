import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';
import { buildRostersByName } from '@/lib/build-rosters';

// GET — series + games + top 4 from each division for dropdowns,
//       plus rosters (for stat entry) and existing per-game player stats.
export async function GET() {
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

// PUT — update a series team names
export async function PUT(req: NextRequest) {
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
  const season = await getCurrentSeason();
  const body = await req.json();
  const { series_number, game_number, home_score, away_score, played, game_date } = body;

  const update: Record<string, unknown> = { played: played ?? false };
  if (home_score !== undefined) update.home_score = home_score;
  if (away_score !== undefined) update.away_score = away_score;
  if (game_date  !== undefined) update.game_date  = game_date;

  // Upsert keyed on (season, series_number, game_number) — the same shape as
  // the unique constraint added in 20260521_add_season_column.sql. Two seasons
  // can have a row for series 1 game 1 without one stomping the other.
  const { error } = await supabaseAdmin
    .from('playoff_games')
    .upsert({ series_number, game_number, season, ...update }, { onConflict: 'season,series_number,game_number' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
