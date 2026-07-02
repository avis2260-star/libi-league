import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getClientIp } from '@/lib/mfa';
import { rateLimit } from '@/lib/rate-limit';

// Public endpoint (the /submit flow uploads the scoresheet photo before any
// session exists). Uploads land in a PUBLIC bucket, so restrict this to
// images, cap the size, and rate-limit per IP — otherwise it's free anonymous
// file hosting under our domain.
const RATE_LIMIT = 10;                    // uploads per 10 minutes per IP
const RATE_WINDOW_MS = 10 * 60_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;  // 10 MB
// Any image/* type is accepted (the submit flow sends the picked file's type
// verbatim); non-image uploads are rejected. Extension falls back to the MIME
// subtype, matching the previous naming behavior.
const MEDIA_TYPE_RE = /^image\/[\w.+-]{1,30}$/;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || 'unknown';
    if (!rateLimit(`upload:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'יותר מדי העלאות — נסו שוב בעוד מספר דקות' },
        { status: 429 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    if (!MEDIA_TYPE_RE.test(file.type)) {
      return NextResponse.json({ error: 'סוג קובץ לא נתמך — יש להעלות תמונה' }, { status: 400 });
    }
    const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg');
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 10MB)' }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('scoresheets')
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('scoresheets')
      .getPublicUrl(path);

    return NextResponse.json({ url: publicUrl });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
