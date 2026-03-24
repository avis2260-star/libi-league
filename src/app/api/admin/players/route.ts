import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { name, team_id, jersey_number, position } = await req.json();
    if (!name || !team_id) return NextResponse.json({ error: 'שם וקבוצה חובה' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('players')
      .insert({ name, team_id, jersey_number, position, points: 0, fouls: 0, three_pointers: 0 })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ player: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const { error } = await supabaseAdmin.from('players').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
