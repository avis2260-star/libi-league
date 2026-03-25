import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET all teams
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id,name,logo_url,captain_name,contact_info')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams: data });
}

// PATCH — update logo_url for a team
export async function PATCH(req: NextRequest) {
  try {
    const { id, logo_url } = await req.json();
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });
    const { error } = await supabaseAdmin
      .from('teams')
      .update({ logo_url })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
