-- Keep the Excel file behind every sync, so it can be downloaded again.
--
-- The sync route used to parse the uploaded workbook and discard it, so the
-- original file could never be recovered. The file now goes to a PRIVATE
-- storage bucket and its object path is recorded on the sync log row; admins
-- download it from the sync-log tab through a short-lived signed link.
--
-- Run once in the Supabase SQL editor (migrations here are applied manually).
-- Idempotent — safe to re-run.

ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS file_path text;

-- Private bucket (no public URLs). The app also creates it on first upload if
-- it is missing, so this insert is belt-and-braces.
INSERT INTO storage.buckets (id, name, public)
VALUES ('excel-uploads', 'excel-uploads', false)
ON CONFLICT (id) DO NOTHING;
