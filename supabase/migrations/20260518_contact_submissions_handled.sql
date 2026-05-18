-- Add a "handled / resolved" state to contact submissions, independent
-- of the existing is_read flag. Workflow:
--   * is_read=false, is_handled=false → "טרם נקרא"
--   * is_read=true,  is_handled=false → "נקרא"  (admin has seen it)
--   * is_read=true,  is_handled=true  → "טופל"  (admin has handled / replied to it)
--
-- Defaults FALSE so existing rows are unaffected — they all show up as
-- "נקרא" (since they already have is_read=true) until an admin marks
-- them handled.

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS is_handled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contact_submissions.is_handled IS
  'Set true once the admin has resolved / replied to the submission.';
