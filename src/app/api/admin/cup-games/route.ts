import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { getCurrentSeason } from '@/lib/current-season';
import { cupGameTime, CUP_TIME_DELAY_MIGRATION } from '@/lib/cup-settings';
import { cleanDelayNote } from '@/lib/delay-note';

// A save that touches a column the cup time/postponed migration adds, before
// that migration was run, fails with a schema error naming the column.
const NEW_COLUMNS = /game_time|delayed|delay_note/;

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { round, round_order, game_number, home_team, away_team, date, home_score, away_score, played } = body;
    if (!round?.trim() || !home_team?.trim() || !away_team?.trim()) {
      return NextResponse.json({ error: 'סיבוב, קבוצת בית וקבוצת חוץ הם שדות חובה' }, { status: 400 });
    }
    // The season being edited in the admin (default: the current one). Without
    // it the row took the column's DB default, 2025-2026 — so a new
    // tournament's games were filed under last season.
    const season =
      typeof body.season === 'string' && /^\d{4}-\d{4}$/.test(body.season)
        ? body.season
        : await getCurrentSeason();

    const { data, error } = await supabaseAdmin
      .from('cup_games')
      .insert({
        round: round.trim(),
        round_order: Number.isFinite(round_order) ? round_order : 0,
        game_number: Number.isFinite(game_number) ? game_number : 1,
        home_team: home_team.trim(),
        away_team: away_team.trim(),
        date: date || null,
        home_score: home_score ?? null,
        away_score: away_score ?? null,
        played: !!played,
        season,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/cup');
    return NextResponse.json({ game: data });
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

    const allowed = ['round', 'round_order', 'game_number', 'home_team', 'away_team', 'home_score', 'away_score', 'date', 'played', 'video_url', 'location', 'game_time', 'delayed', 'delay_note'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in fields) update[key] = fields[key];
    }

    // Basic URL validation (allow null/empty to clear)
    if ('video_url' in update) {
      const raw = update.video_url;
      const trimmed = typeof raw === 'string' ? raw.trim() : '';
      if (trimmed && !/^https?:\/\/.+/.test(trimmed)) {
        return NextResponse.json({ error: 'קישור וידאו חייב להתחיל ב-http:// או https://' }, { status: 400 });
      }
      update.video_url = trimmed || null;
    }

    // Normalize location (empty → null)
    if ('location' in update) {
      const raw = update.location;
      const trimmed = typeof raw === 'string' ? raw.trim() : '';
      update.location = trimmed || null;
    }

    // Time: "HH:MM" or nothing.
    if ('game_time' in update) {
      const raw = update.game_time;
      const time = typeof raw === 'string' ? cupGameTime(raw) : null;
      if (typeof raw === 'string' && raw.trim() && !time) {
        return NextResponse.json({ error: 'שעה לא תקינה — השתמש בפורמט HH:MM' }, { status: 400 });
      }
      update.game_time = time;
    }
    if ('delayed' in update) update.delayed = !!update.delayed;
    if ('delay_note' in update) {
      update.delay_note = cleanDelayNote(typeof update.delay_note === 'string' ? update.delay_note : null);
    }

    const { error } = await supabaseAdmin
      .from('cup_games')
      .update(update)
      .eq('id', id);

    if (error) {
      if (NEW_COLUMNS.test(error.message ?? '')) {
        return NextResponse.json(
          { error: `השדות שעה / משחק דחוי עדיין לא קיימים בגביע — הרץ ב-Supabase את ${CUP_TIME_DELAY_MIGRATION}` },
          { status: 500 },
        );
      }
      throw error;
    }
    revalidatePath('/cup');
    revalidatePath('/');
    return NextResponse.json({ success: true });
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

    const { error } = await supabaseAdmin.from('cup_games').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/cup');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
