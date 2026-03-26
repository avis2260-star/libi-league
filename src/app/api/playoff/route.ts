import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const [{ data: series }, { data: games }] = await Promise.all([
    supabaseAdmin.from('playoff_series').select('*').order('series_number'),
    supabaseAdmin.from('playoff_games').select('*').order('series_number').order('game_number'),
  ]);
  return NextResponse.json({ series: series ?? [], games: games ?? [] });
}
