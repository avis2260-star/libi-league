import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Run raw SQL via Supabase's pg-meta REST API (uses service-role JWT) */
async function runSQL(query: string) {
  const res = await fetch(`${SUPABASE_URL}/pg-meta/v1/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return res.json();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, action, ...data } = body as {
      type: 'season' | 'record' | 'setup' | 'cup';
      action: 'add' | 'delete' | 'edit' | 'init' | 'upsert';
      [key: string]: unknown;
    };

    /* ── One-time DB setup ──────────────────────────────────────────────── */
    if (type === 'setup' && action === 'init') {
      await runSQL(`
        CREATE TABLE IF NOT EXISTS league_history_seasons (
          id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          year             text NOT NULL,
          champion_name    text,
          champion_logo    text,
          champion_captain text,
          cup_holder_name  text,
          cup_holder_logo  text,
          mvp_name         text,
          mvp_stats        text,
          is_current       boolean DEFAULT false,
          sort_order       int DEFAULT 0,
          created_at       timestamptz DEFAULT now()
        );
        ALTER TABLE league_history_seasons ADD COLUMN IF NOT EXISTS cup_holder_name text;
        ALTER TABLE league_history_seasons ADD COLUMN IF NOT EXISTS cup_holder_logo text;
        CREATE TABLE IF NOT EXISTS league_history_records (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          title       text NOT NULL,
          holder      text,
          value       text,
          record_date date,
          sort_order  int DEFAULT 0,
          created_at  timestamptz DEFAULT now()
        );
      `);
      return NextResponse.json({ ok: true });
    }

    /* ── Seasons ────────────────────────────────────────────────────────── */
    if (type === 'season') {
      if (action === 'add') {
        const { error } = await supabaseAdmin.from('league_history_seasons').insert({
          year:             data.year,
          champion_name:    data.champion_name    ?? null,
          champion_captain: data.champion_captain ?? null,
          cup_holder_name:  data.cup_holder_name  ?? null,
          mvp_name:         data.mvp_name         ?? null,
          mvp_stats:        data.mvp_stats        ?? null,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      if (action === 'edit') {
        const { error } = await supabaseAdmin.from('league_history_seasons').update({
          year:             data.year,
          champion_name:    data.champion_name    ?? null,
          champion_captain: data.champion_captain ?? null,
          cup_holder_name:  data.cup_holder_name  ?? null,
          mvp_name:         data.mvp_name         ?? null,
          mvp_stats:        data.mvp_stats        ?? null,
        }).eq('id', data.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      if (action === 'delete') {
        const { error } = await supabaseAdmin.from('league_history_seasons').delete().eq('id', data.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
    }

    /* ── Cup holders (dedicated endpoint — upserts by year) ─────────────── */
    if (type === 'cup') {
      if (action === 'upsert') {
        const year = String(data.year ?? '').trim();
        if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });
        const cupName = (data.cup_holder_name as string | null | undefined)?.trim() || null;

        const { data: existing } = await supabaseAdmin
          .from('league_history_seasons')
          .select('id')
          .eq('year', year)
          .maybeSingle();

        if (existing) {
          const { error } = await supabaseAdmin
            .from('league_history_seasons')
            .update({ cup_holder_name: cupName })
            .eq('id', existing.id);
          if (error) return NextResponse.json({ error: error.message }, { status: 400 });
          return NextResponse.json({ ok: true, id: existing.id });
        }
        const { data: inserted, error } = await supabaseAdmin
          .from('league_history_seasons')
          .insert({ year, cup_holder_name: cupName })
          .select('id')
          .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, id: inserted?.id });
      }
      if (action === 'edit') {
        const id = String(data.id ?? '');
        const newYear = String(data.year ?? '').trim();
        const newName = (data.cup_holder_name as string | null | undefined)?.trim() || null;
        if (!id || !newYear) return NextResponse.json({ error: 'id and year required' }, { status: 400 });

        // fetch the current row to know the existing year
        const { data: current } = await supabaseAdmin
          .from('league_history_seasons')
          .select('id, year')
          .eq('id', id)
          .maybeSingle();
        if (!current) return NextResponse.json({ error: 'row not found' }, { status: 404 });

        // if the year is unchanged, simple update
        if (current.year === newYear) {
          const { error } = await supabaseAdmin
            .from('league_history_seasons')
            .update({ cup_holder_name: newName })
            .eq('id', id);
          if (error) return NextResponse.json({ error: error.message }, { status: 400 });
          return NextResponse.json({ ok: true, id });
        }

        // year changed — clear cup_holder on old row, upsert onto the new year row
        const { error: clearErr } = await supabaseAdmin
          .from('league_history_seasons')
          .update({ cup_holder_name: null })
          .eq('id', id);
        if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 400 });

        const { data: targetRow } = await supabaseAdmin
          .from('league_history_seasons')
          .select('id')
          .eq('year', newYear)
          .maybeSingle();

        if (targetRow) {
          const { error } = await supabaseAdmin
            .from('league_history_seasons')
            .update({ cup_holder_name: newName })
            .eq('id', targetRow.id);
          if (error) return NextResponse.json({ error: error.message }, { status: 400 });
          return NextResponse.json({ ok: true, id: targetRow.id, moved: true });
        }
        const { data: inserted, error } = await supabaseAdmin
          .from('league_history_seasons')
          .insert({ year: newYear, cup_holder_name: newName })
          .select('id')
          .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, id: inserted?.id, moved: true });
      }
      if (action === 'delete') {
        // clear cup_holder_name — don't delete the season row (may have champion data)
        const { error } = await supabaseAdmin
          .from('league_history_seasons')
          .update({ cup_holder_name: null })
          .eq('id', data.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
    }

    /* ── Records ────────────────────────────────────────────────────────── */
    if (type === 'record') {
      if (action === 'add') {
        const { error } = await supabaseAdmin.from('league_history_records').insert({
          title:  data.title,
          holder: data.holder ?? null,
          value:  data.value  ?? null,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      if (action === 'edit') {
        const { error } = await supabaseAdmin.from('league_history_records').update({
          title:  data.title,
          holder: data.holder ?? null,
          value:  data.value  ?? null,
        }).eq('id', data.id);
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
