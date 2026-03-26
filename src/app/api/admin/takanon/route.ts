import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const BUCKET = 'takanon';

// POST — upload a new takanon file
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'קובץ לא תקין. מותר: PDF, DOCX, TXT' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
    const path = `takanon-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    // Save URL + metadata to league_settings
    const settings = [
      { key: 'takanon_url',      value: publicUrl },
      { key: 'takanon_filename', value: file.name },
      { key: 'takanon_type',     value: ext },
      { key: 'takanon_updated',  value: new Date().toISOString() },
    ];
    for (const s of settings) {
      await supabaseAdmin.from('league_settings').upsert(s, { onConflict: 'key' });
    }

    return NextResponse.json({ url: publicUrl, filename: file.name });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}

// DELETE — remove current takanon file from storage and clear settings
export async function DELETE() {
  try {
    // Get current file URL to extract path
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('key,value')
      .in('key', ['takanon_url']);

    const url = data?.find(r => r.key === 'takanon_url')?.value ?? null;

    // Extract storage path from public URL and delete from bucket
    if (url) {
      const parts = url.split(`/${BUCKET}/`);
      if (parts.length === 2) {
        await supabaseAdmin.storage.from(BUCKET).remove([parts[1]]);
      }
    }

    // Clear all takanon entries from league_settings
    await supabaseAdmin
      .from('league_settings')
      .delete()
      .in('key', ['takanon_url', 'takanon_filename', 'takanon_type', 'takanon_updated']);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    );
  }
}

// GET — return current takanon info
export async function GET() {
  const { data } = await supabaseAdmin
    .from('league_settings')
    .select('key,value')
    .in('key', ['takanon_url', 'takanon_filename', 'takanon_type', 'takanon_updated']);

  const map: Record<string, string> = {};
  for (const row of (data ?? [])) map[row.key] = row.value;

  return NextResponse.json({
    url:      map['takanon_url']      ?? null,
    filename: map['takanon_filename'] ?? null,
    type:     map['takanon_type']     ?? null,
    updated:  map['takanon_updated']  ?? null,
  });
}
