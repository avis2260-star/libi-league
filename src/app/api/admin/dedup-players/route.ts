import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  // Find duplicate player rows (same name + team_id, keep the one with MIN id)
  const { data: dupes } = await supabaseAdmin
    .from('players')
    .select('id, name, team_id')
    .order('id', { ascending: true });

  if (!dupes) return NextResponse.json({ error: 'query failed' }, { status: 500 });

  // Group by name+team_id, collect all ids after the first
  const seen = new Map<string, string>();
  const toDelete: string[] = [];

  for (const p of dupes) {
    const key = `${p.name}__${p.team_id}`;
    if (seen.has(key)) {
      toDelete.push(p.id);
    } else {
      seen.set(key, p.id);
    }
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ message: 'No duplicates found', deleted: 0 });
  }

  const { error } = await supabaseAdmin
    .from('players')
    .delete()
    .in('id', toDelete);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Done', deleted: toDelete.length });
}
