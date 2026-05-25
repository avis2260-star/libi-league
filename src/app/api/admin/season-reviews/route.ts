import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';
import { revalidatePath } from 'next/cache';

// GET — all reviews for a season (defaults to current).
export async function GET(req: NextRequest) {
  try {
    const season = new URL(req.url).searchParams.get('season') || await getCurrentSeason();
    const { data, error } = await supabaseAdmin
      .from('season_reviews')
      .select('id, season, review_type, title, content, is_published, created_at, updated_at')
      .eq('season', season)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ reviews: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

// POST — create a new review.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      season?: string;
      review_type?: string;
      title?: string;
      content?: string;
      is_published?: boolean;
    };
    const season = body.season?.trim() || await getCurrentSeason();
    const { data, error } = await supabaseAdmin
      .from('season_reviews')
      .insert({
        season,
        review_type:  body.review_type  ?? 'custom',
        title:        body.title        ?? '',
        content:      body.content      ?? '',
        is_published: body.is_published ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    revalidatePath('/season-review');
    return NextResponse.json({ review: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

// PATCH — update title, content, or is_published by id.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id?: string;
      title?: string;
      content?: string;
      is_published?: boolean;
    };
    if (!body.id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (body.title        !== undefined) update.title        = body.title;
    if (body.content      !== undefined) update.content      = body.content;
    if (body.is_published !== undefined) update.is_published = body.is_published;

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: 'אין שדות לעדכון' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('season_reviews')
      .update(update)
      .eq('id', body.id);
    if (error) throw error;
    revalidatePath('/season-review');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

// DELETE — remove a review by id.
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });
    const { error } = await supabaseAdmin.from('season_reviews').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/season-review');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
