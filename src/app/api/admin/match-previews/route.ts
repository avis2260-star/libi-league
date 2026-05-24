import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';
import { revalidatePath } from 'next/cache';

/**
 * CRUD for match_previews (the editable team-by-team commentary tied to
 * cup_games). Generation lives in /generate/route.ts; this file is just
 * the store-and-publish layer.
 */

// GET — all previews for the current season (or ?season=...).
export async function GET(req: NextRequest) {
  try {
    const season = new URL(req.url).searchParams.get('season') || await getCurrentSeason();
    const { data, error } = await supabaseAdmin
      .from('match_previews')
      .select('id, cup_game_id, season, home_review, away_review, is_published, created_at, updated_at')
      .eq('season', season);
    if (error) throw error;
    return NextResponse.json({ previews: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

// POST — create or upsert a preview row for a given cup_game_id.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      cup_game_id?: string;
      home_review?: string;
      away_review?: string;
      is_published?: boolean;
    };

    if (!body.cup_game_id) {
      return NextResponse.json({ error: 'cup_game_id חובה' }, { status: 400 });
    }

    const season = await getCurrentSeason();
    const { data, error } = await supabaseAdmin
      .from('match_previews')
      .upsert(
        {
          cup_game_id:  body.cup_game_id,
          season,
          home_review:  body.home_review  ?? '',
          away_review:  body.away_review  ?? '',
          is_published: body.is_published ?? false,
        },
        { onConflict: 'cup_game_id' },
      )
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/events');
    return NextResponse.json({ preview: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

// PATCH — update an existing preview by id. Accepts any subset of the
// editable fields (home_review, away_review, is_published).
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id?: string;
      home_review?: string;
      away_review?: string;
      is_published?: boolean;
    };
    if (!body.id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (body.home_review  !== undefined) update.home_review  = body.home_review;
    if (body.away_review  !== undefined) update.away_review  = body.away_review;
    if (body.is_published !== undefined) update.is_published = body.is_published;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'אין שדות לעדכון' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('match_previews')
      .update(update)
      .eq('id', body.id);
    if (error) throw error;
    revalidatePath('/events');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

// DELETE — drop a preview row by id.
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });
    const { error } = await supabaseAdmin.from('match_previews').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/events');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
