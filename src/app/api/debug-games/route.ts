import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('id, game_date, round, status, home_team_id, away_team_id')
    .order('game_date', { ascending: false })
    .limit(10);

  return NextResponse.json({ data, error, count: data?.length ?? 0 });
}
