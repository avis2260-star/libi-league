/**
 * Service-role Supabase client — bypasses RLS.
 * NEVER import this in client components or expose to the browser.
 * Use only in Server Actions and Route Handlers that are already
 * protected by middleware auth checks.
 */
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
