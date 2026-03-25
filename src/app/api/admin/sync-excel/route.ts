import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type StandingRow = {
  rank: number; name: string; games: number; wins: number; losses: number;
  pf: number; pa: number; diff: number; techni: number; penalty: number; pts: number;
};

type GameResultRow = {
  round: number; date: string; division: string;
  home_team: string; away_team: string;
  home_score: number; away_score: number;
  techni: boolean; techni_note: string;
};

export async function POST(req: NextRequest) {
  try {
    const { north, south, results } = (await req.json()) as {
      north: StandingRow[];
      south: StandingRow[];
      results: GameResultRow[];
    };

    // Upsert standings
    const standingRows = [
      ...north.map((r) => ({ ...r, division: 'North' })),
      ...south.map((r) => ({ ...r, division: 'South' })),
    ];

    if (standingRows.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from('standings')
        .delete()
        .neq('name', '');
      if (delErr) throw delErr;

      const { error: insErr } = await supabaseAdmin
        .from('standings')
        .insert(standingRows);
      if (insErr) throw insErr;
    }

    // Replace game results: delete all, then insert fresh
    let resultsCount = 0;
    {
      const { error: delErr } = await supabaseAdmin
        .from('game_results')
        .delete()
        .neq('round', -1);
      if (delErr) throw delErr;
    }
    if (Array.isArray(results) && results.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from('game_results')
        .insert(results);
      if (insErr) throw insErr;
      resultsCount = results.length;
    }

    const parts = [];
    if (north.length > 0) parts.push(`${north.length} קבוצות צפון`);
    if (south.length > 0) parts.push(`${south.length} קבוצות דרום`);
    if (resultsCount > 0) parts.push(`${resultsCount} תוצאות משחקים`);

    return NextResponse.json({
      success: true,
      message: `✅ עודכנו: ${parts.join(' + ')}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    console.error('sync-excel error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
