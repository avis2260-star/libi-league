import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';

const ALLOWED_TYPES = ['technical', 'unsportsmanlike', 'ejection', 'suspension'];

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const season = await getCurrentSeason();
    const { data, error } = await supabaseAdmin
      .from('disciplinary_records')
      .select('*')
      .eq('season', season)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ records: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const season = await getCurrentSeason();
    const { player_id, player_name, team_name, type, round, notes, suspension_until_round } = await req.json();
    if (!player_name || !type) return NextResponse.json({ error: 'שם שחקן וסוג חובה' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: `סוג עבירה לא תקין: ${type}` }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('disciplinary_records')
      .insert({
        player_id: player_id || null,
        player_name,
        team_name: team_name || null,
        type,
        round: round ? parseInt(String(round)) : null,
        notes: notes || null,
        // Only meaningful for type='suspension', else stored as NULL.
        suspension_until_round:
          type === 'suspension' && suspension_until_round
            ? parseInt(String(suspension_until_round))
            : null,
        season,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    if (fields.type && !ALLOWED_TYPES.includes(fields.type)) {
      return NextResponse.json({ error: `סוג עבירה לא תקין: ${fields.type}` }, { status: 400 });
    }

    // Whitelist updatable columns. Coerce numerics, null-out blanks.
    const allowed = ['player_name', 'team_name', 'type', 'round', 'notes', 'suspension_until_round'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (!(key in fields)) continue;
      let v = fields[key];
      if (key === 'round' || key === 'suspension_until_round') {
        v = v === '' || v == null ? null : parseInt(String(v));
      }
      if (typeof v === 'string') v = v.trim() === '' ? null : v;
      update[key] = v;
    }

    // If the type is being changed away from 'suspension', force the
    // until-round to NULL so it doesn't linger on the row misleadingly.
    if ('type' in update && update.type !== 'suspension') {
      update.suspension_until_round = null;
    }

    const { data, error } = await supabaseAdmin
      .from('disciplinary_records')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

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
