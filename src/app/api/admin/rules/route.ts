import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    const { title, body, sort_order } = await req.json();
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'כותרת ותיאור חובה' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('league_rules')
      .insert({
        title: title.trim(),
        body: body.trim(),
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/about');
    return NextResponse.json({ rule: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const allowed = ['title', 'body', 'sort_order'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in fields) update[key] = fields[key];
    }

    const { error } = await supabaseAdmin
      .from('league_rules')
      .update(update)
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/about');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const { error } = await supabaseAdmin.from('league_rules').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/about');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
