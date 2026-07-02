import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const season = await getCurrentSeason();
    const { data, error } = await supabaseAdmin
      .from('sync_logs')
      .select('id,uploaded_at,filename,north_count,south_count,results_count,is_rolled_back')
      .eq('season', season)
      .order('uploaded_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json({ logs: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { action, id } = await req.json();
    if (action !== 'rollback' || !id) {
      return NextResponse.json({ error: 'נדרש action=rollback ו-id' }, { status: 400 });
    }

    // Fetch the snapshot
    const { data: log, error: logErr } = await supabaseAdmin
      .from('sync_logs')
      .select('snapshot_standings,snapshot_results')
      .eq('id', id)
      .single();
    if (logErr) throw logErr;
    if (!log) return NextResponse.json({ error: 'לוג לא נמצא' }, { status: 404 });

    const snapshotStandings = (log.snapshot_standings ?? []) as Record<string, unknown>[];
    const snapshotResults   = (log.snapshot_results   ?? []) as Record<string, unknown>[];

    const season = await getCurrentSeason();

    // Restore standings for the current season only (other seasons untouched).
    const { error: delStErr } = await supabaseAdmin.from('standings').delete().eq('season', season);
    if (delStErr) throw delStErr;
    if (snapshotStandings.length > 0) {
      // Re-stamp the snapshot rows with the current season so a future
      // rollback from a different season doesn't drag the wrong tag along.
      const restored = snapshotStandings.map((r) => ({ ...r, season }));
      const { error: insStErr } = await supabaseAdmin.from('standings').insert(restored);
      if (insStErr) throw insStErr;
    }

    // Restore game_results for the current season only.
    const { error: delGrErr } = await supabaseAdmin.from('game_results').delete().eq('season', season);
    if (delGrErr) throw delGrErr;
    if (snapshotResults.length > 0) {
      const restored = snapshotResults.map((r) => ({ ...r, season }));
      const { error: insGrErr } = await supabaseAdmin.from('game_results').insert(restored);
      if (insGrErr) throw insGrErr;
    }

    // Restore cup data (best-effort — older logs / pre-migration DBs won't have
    // these snapshot columns). Deleting cup_games cascades to cup_game_stats and
    // match_previews; we then reinsert all three from the snapshot (rows keep
    // their original ids, so the foreign-key references line up again).
    try {
      const { data: cupLog } = await supabaseAdmin
        .from('sync_logs')
        .select('snapshot_cup_games, snapshot_cup_stats, snapshot_cup_previews')
        .eq('id', id)
        .single();
      if (cupLog) {
        const cupGamesSnap    = (cupLog.snapshot_cup_games    ?? []) as Record<string, unknown>[];
        const cupStatsSnap    = (cupLog.snapshot_cup_stats    ?? []) as Record<string, unknown>[];
        const cupPreviewsSnap = (cupLog.snapshot_cup_previews ?? []) as Record<string, unknown>[];

        await supabaseAdmin.from('cup_games').delete().eq('season', season);
        if (cupGamesSnap.length > 0) {
          await supabaseAdmin.from('cup_games').insert(cupGamesSnap.map((r) => ({ ...r, season })));
        }
        if (cupStatsSnap.length > 0) {
          await supabaseAdmin.from('cup_game_stats').insert(cupStatsSnap.map((r) => ({ ...r, season })));
        }
        if (cupPreviewsSnap.length > 0) {
          await supabaseAdmin.from('match_previews').insert(cupPreviewsSnap.map((r) => ({ ...r, season })));
        }
      }
    } catch (e) {
      // Cup snapshot columns not present, or a cup table differs — the
      // standings/results rollback above still succeeded.
      console.error('[sync-logs rollback] cup restore skipped:', e);
    }

    // Mark log as rolled back
    const { error: updErr } = await supabaseAdmin
      .from('sync_logs')
      .update({ is_rolled_back: true })
      .eq('id', id);
    if (updErr) throw updErr;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
