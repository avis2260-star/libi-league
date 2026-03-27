import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'league-assets';
const LOGO_PATH = 'league-logo.png';
const SETTING_KEY = 'league_logo_url';

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
  // error code 'already_exists' is fine — just ignore it
  if (error && !error.message.includes('already exist')) throw error;
}

// POST — upload new league logo
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'קובץ חייב להיות תמונה' }, { status: 400 });
    }

    await ensureBucket();

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Always upload with the same fixed path → overwrites old logo
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(LOGO_PATH, buffer, { contentType: file.type, upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(LOGO_PATH);

    // Append cache-busting timestamp so the browser fetches the new image
    const urlWithTs = `${publicUrl}?v=${Date.now()}`;

    await supabaseAdmin
      .from('league_settings')
      .upsert({ key: SETTING_KEY, value: urlWithTs }, { onConflict: 'key' });

    return NextResponse.json({ url: urlWithTs });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}

// GET — return current logo URL
export async function GET() {
  const { data } = await supabaseAdmin
    .from('league_settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .maybeSingle();

  return NextResponse.json({ url: data?.value ?? null });
}

// DELETE — revert to default logo
export async function DELETE() {
  try {
    await supabaseAdmin.storage.from(BUCKET).remove([LOGO_PATH]);
    await supabaseAdmin.from('league_settings').delete().eq('key', SETTING_KEY);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    );
  }
}
