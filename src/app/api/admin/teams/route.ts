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

// PATCH — update logo_url, name, division and/or captain_name for a team
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json() as { id?: string; logo_url?: string; name?: string; division?: unknown; captain_name?: unknown };
    const { id, logo_url, name } = body;
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const update: Record<string, unknown> = {};

    if (logo_url !== undefined) {
      update.logo_url = logo_url;
    }

    // Head of team / coach. captain_name is NOT NULL, so store a trimmed string
    // (empty string clears it).
    if (body.captain_name !== undefined) {
      const captain = String(body.captain_name ?? '').trim();
      if (captain.length > 80) {
        return NextResponse.json({ error: 'שם ארוך מדי (מקסימום 80 תווים)' }, { status: 400 });
      }
      update.captain_name = captain;
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

// DELETE — remove a team. games.home_team_id / away_team_id are ON DELETE
// CASCADE, so deleting a team that still has games would silently wipe those
// games (and their box scores). To keep this from being a destructive foot-gun
// we refuse when the team is still referenced by games or players, and tell the
// admin what to clear first. Only a team with no games and no players — e.g. a
// leftover test row — can be deleted outright.
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const [{ count: gameCount, error: gamesErr }, { count: playerCount, error: playersErr }] =
      await Promise.all([
        supabaseAdmin
          .from('games')
          .select('id', { count: 'exact', head: true })
          .or(`home_team_id.eq.${id},away_team_id.eq.${id}`),
        supabaseAdmin
          .from('players')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', id),
      ]);
    if (gamesErr) throw gamesErr;
    if (playersErr) throw playersErr;

    const blockers: string[] = [];
    if ((gameCount ?? 0) > 0) blockers.push(`${gameCount} משחקים`);
    if ((playerCount ?? 0) > 0) blockers.push(`${playerCount} שחקנים`);
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error:
            `לא ניתן למחוק — לקבוצה משויכים ${blockers.join(' ו-')}. ` +
            'יש להסיר אותם קודם (מחיקת הקבוצה הייתה מוחקת גם את המשחקים שלה).',
        },
        { status: 409 },
      );
    }

    const { error } = await supabaseAdmin.from('teams').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
