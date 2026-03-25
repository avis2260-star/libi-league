import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('disciplinary_records')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { player_id, player_name, team_name, type, round, notes } = await req.json();
    if (!player_name || !type) return NextResponse.json({ error: 'שם שחקן וסוג חובה' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('disciplinary_records')
      .insert({
        player_id: player_id || null,
        player_name,
        team_name: team_name || null,
        type,
        round: round ? parseInt(round) : null,
        notes: notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const { error } = await supabaseAdmin.from('disciplinary_records').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
