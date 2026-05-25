import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

const BUCKET = 'Player-photos';

/**
 * POST /api/admin/match-previews/upload
 * Accepts multipart/form-data with:
 *   - file   : the flyer image (jpg / png / webp / gif)
 *   - id     : match_previews.id (to write flyer_url back)
 *
 * Stores the file in the Player-photos bucket under match-flyers/
 * and PATCHes the match_previews row with the public URL.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const previewId = formData.get('id') as string | null;

    if (!file) return NextResponse.json({ error: 'קובץ חסר' }, { status: 400 });
    if (!previewId) return NextResponse.json({ error: 'id חסר' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: 'סוג קובץ לא נתמך. יש להשתמש ב-JPG / PNG / WEBP / GIF' }, { status: 400 });
    }

    const path = `match-flyers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path);

    const { error: dbError } = await supabaseAdmin
      .from('match_previews')
      .update({ flyer_url: publicUrl })
      .eq('id', previewId);

    if (dbError) throw dbError;

    revalidatePath('/events');
    return NextResponse.json({ flyer_url: publicUrl });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שגיאה בהעלאה' },
      { status: 500 },
    );
  }
}
