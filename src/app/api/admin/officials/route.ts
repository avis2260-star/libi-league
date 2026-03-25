import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('officials')
      .select('*')
      .order('name');
    if (error) throw error;
    return NextResponse.json({ officials: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, role, phone, email } = await req.json();
    if (!name || !role) return NextResponse.json({ error: 'שם ותפקיד חובה' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('officials')
      .insert({ name, role, phone: phone || null, email: email || null })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ official: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const { error } = await supabaseAdmin.from('officials').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
