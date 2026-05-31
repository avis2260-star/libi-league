import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/season-reviews/view
 * Body: { id: string }   — the season_reviews.id to increment
 *
 * Called client-side (via ArticleViewCounter) when a published review card
 * is first viewed in a browser. Uses the service-role client + the atomic
 * increment RPC. Mirrors /api/events/view.
 *
 * Returns: { view_count: number | null }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: 'חסר id' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('increment_season_review_views', {
      review_id: body.id,
    });

    if (error) throw error;

    return NextResponse.json({ view_count: data as number });
  } catch (err: unknown) {
    // A failed view-count call must never break the UI — swallow it.
    console.error('[/api/season-reviews/view]', err);
    return NextResponse.json({ view_count: null }, { status: 200 });
  }
}
