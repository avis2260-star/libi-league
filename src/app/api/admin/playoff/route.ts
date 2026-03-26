import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET — same as public
export async function GET() {
  const [{ data: series }, { data: games }] = await Promise.all([
    supabaseAdmin.from('playoff_series').select('*').order('series_number'),
    supabaseAdmin.from('playoff_games').select('*').order('series_number').order('game_number'),
  ]);
  return NextResponse.json({ series: series ?? [], games: games ?? [] });
}

// PUT — update a series team names
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { series_number, team_a, team_b } = body;
  const { error } = await supabaseAdmin
    .from('playoff_series')
    .update({ team_a, team_b })
    .eq('series_number', series_number);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH — update a single game result
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { series_number, game_number, home_score, away_score, played, game_date } = body;

  const update: Record<string, unknown> = { played: played ?? false };
  if (home_score !== undefined) update.home_score = home_score;
  if (away_score !== undefined) update.away_score = away_score;
  if (game_date  !== undefined) update.game_date  = game_date;

  // Upsert by (series_number, game_number)
  const { error } = await supabaseAdmin
    .from('playoff_games')
    .upsert({ series_number, game_number, ...update }, { onConflict: 'series_number,game_number' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
