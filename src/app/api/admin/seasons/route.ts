import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('seasons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ seasons: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, year, start_date, end_date } = await req.json();
    if (!name) return NextResponse.json({ error: 'שם חובה' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('seasons')
      .insert({ name, year: year || null, status: 'active', start_date: start_date || null, end_date: end_date || null })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ season: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id?: string;
      status?: string;
      name?: string;
      year?: string | null;
      start_date?: string | null;
      end_date?: string | null;
    };
    if (!body.id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    // Whitelist of editable fields. Status comes in only from the
    // ארכיון/פעיל toggle; the inline-edit form sends name/year/dates.
    const update: Record<string, unknown> = {};
    if (body.status !== undefined)     update.status     = body.status;
    if (body.name !== undefined)       update.name       = body.name;
    if (body.year !== undefined)       update.year       = body.year;
    if (body.start_date !== undefined) update.start_date = body.start_date;
    if (body.end_date !== undefined)   update.end_date   = body.end_date;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'אין שדות לעדכון' }, { status: 400 });
    }

    if (typeof update.name === 'string' && !update.name.trim()) {
      return NextResponse.json({ error: 'שם העונה לא יכול להיות ריק' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('seasons')
      .update(update)
      .eq('id', body.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const { error } = await supabaseAdmin.from('seasons').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה' }, { status: 500 });
  }
}
