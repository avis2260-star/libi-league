import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { EXCEL_UPLOADS_BUCKET } from '@/lib/excel-uploads';

// GET ?id=<sync log id> — a short-lived signed link to the Excel file that was
// uploaded in that sync. The bucket is private, so a link is only minted for a
// signed-in admin, and it expires after a minute.
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const { data: log, error } = await supabaseAdmin
      .from('sync_logs')
      .select('filename, file_path')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!log) return NextResponse.json({ error: 'רשומת הסנכרון לא נמצאה' }, { status: 404 });
    if (!log.file_path) {
      return NextResponse.json(
        { error: 'הקובץ של העלאה זו לא נשמר — שמירת הקבצים פועלת רק מהעלאות שבוצעו לאחר הפעלתה.' },
        { status: 404 },
      );
    }

    const filename: string = log.filename || 'upload.xlsx';
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(EXCEL_UPLOADS_BUCKET)
      .createSignedUrl(log.file_path, 60, { download: filename });
    if (signErr) throw signErr;
    if (!signed?.signedUrl) throw new Error('יצירת קישור ההורדה נכשלה');

    return NextResponse.json({ url: signed.signedUrl, filename });
  } catch (err: unknown) {
    let msg =
      err instanceof Error ? err.message
      : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message)
      : 'שגיאה';
    if (/file_path/i.test(msg)) {
      msg += ' — הרץ את המיגרציה 20261018_sync_logs_file.sql ב-Supabase.';
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
