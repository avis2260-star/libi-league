import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { round, round_order, game_number, home_team, away_team, date, home_score, away_score, played } = body;
    if (!round?.trim() || !home_team?.trim() || !away_team?.trim()) {
      return NextResponse.json({ error: 'סיבוב, קבוצת בית וקבוצת חוץ הם שדות חובה' }, { status: 400 });
    }

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
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const allowed = ['round', 'round_order', 'game_number', 'home_team', 'away_team', 'home_score', 'away_score', 'date', 'played', 'video_url', 'location'];
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

    const { error } = await supabaseAdmin
      .from('cup_games')
      .update(update)
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/cup');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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
