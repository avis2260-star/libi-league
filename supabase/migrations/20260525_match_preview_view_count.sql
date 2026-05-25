-- Add view_count to match_previews and a helper RPC to atomically increment it.
-- The public API route (/api/events/view) calls this function via the service-role
-- client, so no special anon grant is needed.

ALTER TABLE public.match_previews
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.match_previews.view_count IS
  'Running total of page views since the preview was first published.';

-- Atomic increment — avoids read-modify-write races in concurrent requests.
CREATE OR REPLACE FUNCTION public.increment_preview_views(preview_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.match_previews
  SET view_count = view_count + 1
  WHERE id = preview_id
  RETURNING view_count;
$$;

COMMENT ON FUNCTION public.increment_preview_views(uuid) IS
  'Atomically increments view_count for a single match_preview row and returns the new value.';
