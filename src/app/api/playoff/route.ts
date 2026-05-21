import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';

export async function GET() {
  const season = await getCurrentSeason();
  const [{ data: series }, { data: games }] = await Promise.all([
    supabaseAdmin.from('playoff_series').select('*').eq('season', season).order('series_number'),
    supabaseAdmin.from('playoff_games').select('*').eq('season', season).order('series_number').order('game_number'),
  ]);
  return NextResponse.json({ series: series ?? [], games: games ?? [] });
}
