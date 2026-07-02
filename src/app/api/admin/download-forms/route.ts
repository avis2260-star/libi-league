import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'download-forms';

// 25 MB max per upload — generous for PDFs / Word docs, refuses huge files.
const MAX_BYTES = 25 * 1024 * 1024;

// Allowed MIME types — common form formats. Extend if you need more.
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                       // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
  'application/vnd.ms-excel',                                                 // .xls
  'text/plain',
  'image/jpeg', 'image/png',                                                  // for signed scans
]);

// GET — list all forms, newest first within the configured sort order.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabaseAdmin
    .from('download_forms')
    .select('id, label, filename, file_url, file_type, size_bytes, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ forms: data ?? [] });
}

// POST — upload a new file + insert metadata row.
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const label = String(formData.get('label') ?? '').trim();
    const sortOrder = parseInt(String(formData.get('sort_order') ?? '0'), 10) || 0;

    if (!file)  return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 });
    if (!label) return NextResponse.json({ error: 'חובה להזין שם תצוגה לקובץ' }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 25MB)' }, { status: 400 });
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `סוג קובץ לא נתמך: ${file.type}` }, { status: 400 });
    }

    const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
    const path = `form-${Date.now()}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    const { data: row, error: insErr } = await supabaseAdmin
      .from('download_forms')
      .insert({
        label,
        filename: file.name,
        file_url: publicUrl,
        file_type: ext,
        size_bytes: file.size,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (insErr) {
      // Roll back the storage upload so we don't leave orphans on a DB failure.
      await supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => null);
      throw insErr;
    }

    return NextResponse.json({ form: row });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}

// DELETE — remove a form by id (also wipes the underlying storage object).
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    // Look up the URL first so we can wipe the storage object after the
    // DB row goes away.
    const { data: row, error: selErr } = await supabaseAdmin
      .from('download_forms')
      .select('file_url')
      .eq('id', id)
      .single();
    if (selErr) throw selErr;

    const { error: delErr } = await supabaseAdmin
      .from('download_forms')
      .delete()
      .eq('id', id);
    if (delErr) throw delErr;

    if (row?.file_url) {
      const parts = row.file_url.split(`/${BUCKET}/`);
      if (parts.length === 2) {
        await supabaseAdmin.storage.from(BUCKET).remove([parts[1]]).catch(() => null);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    );
  }
}
