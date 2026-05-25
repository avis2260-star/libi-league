import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/events/view
 * Body: { id: string }   — the match_previews.id to increment
 *
 * Called client-side when an article card becomes visible.
 * Uses the service-role client so it bypasses RLS and calls the
 * atomic increment function directly.
 *
 * Returns: { view_count: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: 'חסר id' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('increment_preview_views', {
      preview_id: body.id,
    });

    if (error) throw error;

    // rpc() returns the scalar returned by the SQL function (the new view_count).
    return NextResponse.json({ view_count: data as number });
  } catch (err: unknown) {
    // Never surface a 500 to the client for a view-count call — just swallow it.
    console.error('[/api/events/view]', err);
    return NextResponse.json({ view_count: null }, { status: 200 });
  }
}
