import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ announcements: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, type, bg_color, expires_at } = await req.json();
    if (!message) return NextResponse.json({ error: 'הודעה חובה' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        message,
        type: type || 'ticker',
        bg_color: bg_color || 'orange',
        active: true,
        expires_at: expires_at || null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ announcement: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, active } = await req.json();
    if (!id || active === undefined) return NextResponse.json({ error: 'חסר id או active' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('announcements')
      .update({ active })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
