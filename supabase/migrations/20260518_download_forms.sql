-- Downloadable forms / documents that admins can publish for users.
-- The actual files live in Supabase Storage under the `download-forms`
-- bucket; this table just stores the metadata (display label, filename,
-- public URL, file type, optional sort order).

CREATE TABLE IF NOT EXISTS public.download_forms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text  NOT NULL,                 -- user-visible name (e.g. "טופס רישום לעונה 2025-2026")
  filename    text  NOT NULL,                 -- original filename (used for Content-Disposition)
  file_url    text  NOT NULL,                 -- public URL of the file in storage
  file_type   text,                           -- 'pdf' / 'docx' / 'xlsx' / 'txt' / ...
  size_bytes  bigint,
  sort_order  int   NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS download_forms_sort_idx ON public.download_forms (sort_order, created_at DESC);

ALTER TABLE public.download_forms ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can list the available forms.
DROP POLICY IF EXISTS "download_forms_public_read" ON public.download_forms;
CREATE POLICY "download_forms_public_read"
  ON public.download_forms FOR SELECT USING (true);

-- Storage bucket. Public so the file URLs returned by getPublicUrl are
-- directly downloadable. Idempotent — safe to re-run.
INSERT INTO storage.buckets (id, name, public)
VALUES ('download-forms', 'download-forms', true)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.download_forms IS
  'Files that admins publish on /forms for users to download.';
