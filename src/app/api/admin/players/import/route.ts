import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const team_id = formData.get('team_id') as string | null;

    if (!file || !team_id) {
      return NextResponse.json({ error: 'קובץ וקבוצה חובה' }, { status: 400 });
    }

    let names: string[] = [];

    if (file.name.toLowerCase().endsWith('.txt')) {
      const text = await file.text();
      names = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    } else if (file.name.toLowerCase().match(/\.xlsx?$/)) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
      names = rows
        .map((r) => String((r as unknown[])[0] ?? '').trim())
        .filter(Boolean);
    } else {
      return NextResponse.json(
        { error: 'סוג קובץ לא נתמך — השתמש ב-.txt או .xlsx' },
        { status: 400 },
      );
    }

    if (names.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו שמות בקובץ' }, { status: 400 });
    }

    const rows = names.map((name) => ({
      name,
      team_id,
      points: 0,
      fouls: 0,
      three_pointers: 0,
    }));

    const { data, error } = await supabaseAdmin
      .from('players')
      .insert(rows)
      .select();

    if (error) throw error;

    return NextResponse.json({ inserted: data.length, players: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שגיאה בעיבוד הקובץ' },
      { status: 500 },
    );
  }
}
