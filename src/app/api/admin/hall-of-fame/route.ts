import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, action, ...data } = body as {
      type: 'season' | 'record';
      action: 'add' | 'delete';
      [key: string]: unknown;
    };

    if (type === 'season') {
      if (action === 'add') {
        const { error } = await supabaseAdmin.from('league_history_seasons').insert({
          year: data.year,
          champion_name: data.champion_name ?? null,
          champion_captain: data.champion_captain ?? null,
          mvp_name: data.mvp_name ?? null,
          mvp_stats: data.mvp_stats ?? null,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      if (action === 'delete') {
        const { error } = await supabaseAdmin.from('league_history_seasons').delete().eq('id', data.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
    }

    if (type === 'record') {
      if (action === 'add') {
        const { error } = await supabaseAdmin.from('league_history_records').insert({
          title: data.title,
          holder: data.holder ?? null,
          value: data.value ?? null,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      if (action === 'delete') {
        const { error } = await supabaseAdmin.from('league_history_records').delete().eq('id', data.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ error: 'invalid type or action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
