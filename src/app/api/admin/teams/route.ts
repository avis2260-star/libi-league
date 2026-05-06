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

// PATCH — update logo_url and/or name for a team
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id?: string; logo_url?: string; name?: string };
    const { id, logo_url, name } = body;
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const update: Record<string, unknown> = {};

    if (logo_url !== undefined) {
      update.logo_url = logo_url;
    }

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: 'שם הקבוצה לא יכול להיות ריק' }, { status: 400 });
      }
      if (trimmed.length > 80) {
        return NextResponse.json({ error: 'שם הקבוצה ארוך מדי (מקסימום 80 תווים)' }, { status: 400 });
      }

      // Make sure no other team already has this name
      const { data: clash } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('name', trimmed)
        .neq('id', id)
        .maybeSingle();
      if (clash) {
        return NextResponse.json({ error: 'קבוצה אחרת כבר משתמשת בשם הזה' }, { status: 409 });
      }

      update.name = trimmed;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'אין שדות לעדכון' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('teams')
      .update(update)
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
