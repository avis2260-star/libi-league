/**
 * Keep every Excel file the admin syncs, so it can be downloaded again later.
 *
 * The sync route used to parse the upload and throw the file away, so the
 * original spreadsheet could never be recovered from the site. Files now go to
 * a PRIVATE storage bucket (downloaded only through short-lived signed links
 * minted for a signed-in admin) and the object path is recorded on the
 * sync_logs row (`file_path`, migration 20261018_sync_logs_file.sql).
 *
 * Server-only (service-role storage access).
 */
import { supabaseAdmin } from '@/lib/supabase-admin';

export const EXCEL_UPLOADS_BUCKET = 'excel-uploads';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Storage object keys are kept ASCII-only — Supabase rejects some non-ASCII
 * keys, and Hebrew filenames are common here. The original filename lives in
 * sync_logs.filename and is used as the download name, so nothing is lost.
 */
export function safeObjectName(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const rawExt = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
  const ext = /^(xlsx|xlsm|xls)$/.test(rawExt) ? rawExt : 'xlsx';
  const base = (dot >= 0 ? filename.slice(0, dot) : filename)
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `${base || 'upload'}.${ext}`;
}

/**
 * Save an uploaded workbook. Best-effort: returns the object path, or null on
 * any failure — a storage problem must never fail the data sync itself.
 * Creates the private bucket on first use if it doesn't exist yet.
 */
export async function storeUploadedExcel(
  buffer: ArrayBuffer,
  filename: string,
  season: string,
  contentType?: string,
): Promise<string | null> {
  try {
    const path = `${season}/${Date.now()}-${safeObjectName(filename)}`;
    const upload = () =>
      supabaseAdmin.storage
        .from(EXCEL_UPLOADS_BUCKET)
        .upload(path, buffer, { contentType: contentType || XLSX_MIME, upsert: false });

    let { error } = await upload();
    if (error && /not found/i.test(error.message)) {
      const { error: bucketErr } = await supabaseAdmin.storage.createBucket(EXCEL_UPLOADS_BUCKET, {
        public: false,
      });
      if (bucketErr && !/already exist/i.test(bucketErr.message)) throw bucketErr;
      ({ error } = await upload());
    }
    if (error) throw error;
    return path;
  } catch (e) {
    console.error('storeUploadedExcel failed:', e);
    return null;
  }
}

export type SyncLogRow = {
  id: string;
  uploaded_at: string;
  filename: string | null;
  north_count: number;
  south_count: number;
  results_count: number;
  is_rolled_back: boolean;
  file_path?: string | null;
};

const LOG_COLUMNS = 'id,uploaded_at,filename,north_count,south_count,results_count,is_rolled_back';

/**
 * Recent sync logs for a season, newest first. Includes `file_path` once the
 * column exists; before the migration is run it falls back to the old columns
 * so the sync-log tab keeps working.
 */
export async function listSyncLogs(season: string, limit = 20): Promise<SyncLogRow[]> {
  const query = (columns: string) =>
    supabaseAdmin
      .from('sync_logs')
      .select(columns)
      .eq('season', season)
      .order('uploaded_at', { ascending: false })
      .limit(limit);

  const withFile = await query(`${LOG_COLUMNS},file_path`);
  if (!withFile.error) return (withFile.data ?? []) as unknown as SyncLogRow[];

  const plain = await query(LOG_COLUMNS);
  if (plain.error) throw plain.error;
  return (plain.data ?? []) as unknown as SyncLogRow[];
}
