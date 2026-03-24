import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type StandingRow = {
  rank: number;
  name: string;
  games: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
  techni: number;
  penalty: number;
  pts: number;
};

export async function POST(req: NextRequest) {
  try {
    const { north, south } = (await req.json()) as {
      north: StandingRow[];
      south: StandingRow[];
    };

    if (!Array.isArray(north) || !Array.isArray(south)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const allRows = [
      ...north.map((r) => ({ ...r, division: 'North' })),
      ...south.map((r) => ({ ...r, division: 'South' })),
    ];

    const { error } = await supabaseAdmin
      .from('standings')
      .upsert(allRows, { onConflict: 'name,division' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      updated: north.length + south.length,
      inserted: 0,
      message: `${north.length} קבוצות צפון + ${south.length} קבוצות דרום עודכנו בהצלחה`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    console.error('sync-excel error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
