import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('sync_logs')
      .select('id,uploaded_at,filename,north_count,south_count,results_count,is_rolled_back')
      .order('uploaded_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json({ logs: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    // Restore standings
    const { error: delStErr } = await supabaseAdmin.from('standings').delete().neq('name', '');
    if (delStErr) throw delStErr;
    if (snapshotStandings.length > 0) {
      const { error: insStErr } = await supabaseAdmin.from('standings').insert(snapshotStandings);
      if (insStErr) throw insStErr;
    }

    // Restore game_results
    const { error: delGrErr } = await supabaseAdmin.from('game_results').delete().neq('round', -1);
    if (delGrErr) throw delGrErr;
    if (snapshotResults.length > 0) {
      const { error: insGrErr } = await supabaseAdmin.from('game_results').insert(snapshotResults);
      if (insGrErr) throw insGrErr;
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
