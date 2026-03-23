/**
 * Server-side Supabase client (uses @supabase/ssr).
 * Safe to call from Server Components, Server Actions, and Middleware.
 * Reads/writes session cookies so auth state is preserved across requests.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from Server Components where writes are a no-op.
            // Actual session writes happen in Server Actions and Route Handlers.
          }
        },
      },
    },
  );
}
