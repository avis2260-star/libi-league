import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Division is optional; when present it must be one of these two values so it
// lines up with the `division` CHECK constraint on the teams table and the
// 'North'/'South' strings the standings rows / Excel sync use. Callers only
// invoke this when the field was actually supplied (body.division !== undefined);
// '' and null both mean "clear the division".
type Division = 'North' | 'South';
function parseDivision(value: unknown): { ok: true; value: Division | null } | { ok: false } {
  if (value === null || value === '') return { ok: true, value: null };
  if (value === 'North' || value === 'South') return { ok: true, value };
  return { ok: false };
}

// GET all teams
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id,name,logo_url,captain_name,contact_info,division')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams: data });
}

// POST — create a new team. The team is shared across every season (the teams
// table has no season column), so a team added here is immediately available
// in the current season and every archive.
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json() as {
      name?: string;
      division?: unknown;
      captain_name?: string;
      contact_info?: string;
      logo_url?: string;
    };

    const name = (body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ error: 'שם הקבוצה חובה' }, { status: 400 });
    }
    if (name.length > 80) {
      return NextResponse.json({ error: 'שם הקבוצה ארוך מדי (מקסימום 80 תווים)' }, { status: 400 });
    }

    let division: Division | null = null;
    if (body.division !== undefined) {
      const parsed = parseDivision(body.division);
      if (!parsed.ok) {
        return NextResponse.json({ error: 'מחוז לא תקין — חייב להיות North או South' }, { status: 400 });
      }
      division = parsed.value;
    }

    // Reject a duplicate name (same check the rename path uses).
    const { data: clash } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('name', name)
      .maybeSingle();
    if (clash) {
      return NextResponse.json({ error: 'קבוצה בשם הזה כבר קיימת' }, { status: 409 });
    }

    // captain_name is NOT NULL on the teams table — default to '' when omitted
    // so the admin can add a team before knowing the captain.
    const { data: team, error } = await supabaseAdmin
      .from('teams')
      .insert({
        name,
        captain_name: (body.captain_name ?? '').trim(),
        contact_info: body.contact_info?.trim() || null,
        logo_url: body.logo_url?.trim() || null,
        division,
      })
      .select('id,name,logo_url,captain_name,contact_info,division')
      .single();

    if (error) throw error;
    return NextResponse.json({ team });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

// PATCH — update logo_url, name, and/or division for a team
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json() as { id?: string; logo_url?: string; name?: string; division?: unknown };
    const { id, logo_url, name } = body;
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const update: Record<string, unknown> = {};

    if (logo_url !== undefined) {
      update.logo_url = logo_url;
    }

    if (body.division !== undefined) {
      const parsed = parseDivision(body.division);
      if (!parsed.ok) {
        return NextResponse.json({ error: 'מחוז לא תקין — חייב להיות North או South' }, { status: 400 });
      }
      update.division = parsed.value;
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
