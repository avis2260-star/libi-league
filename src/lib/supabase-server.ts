/**
 * Server-side Supabase client (uses @supabase/ssr).
 * Safe to call from Server Components, Server Actions, and Middleware.
 * Reads/writes session cookies so auth state is preserved across requests.
 *
 * Next.js 15+: cookies() is async — this function must be awaited.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // getAll / setAll — used by @supabase/ssr ≥ 0.4
        getAll() {
          // Robust across Next.js 14, 15, and 16 cookie-store shapes
          const store = cookieStore as unknown as {
            getAll?: () => { name: string; value: string }[];
            entries?: () => Iterable<[string, string]>;
          };
          if (typeof store.getAll === 'function') return store.getAll();
          if (typeof store.entries === 'function') {
            return Array.from(store.entries()).map(([name, value]) => ({ name, value }));
          }
          return [];
        },
        setAll(cookiesToSet) {
          try {
            const store = cookieStore as unknown as {
              set: (name: string, value: string, options?: object) => void;
            };
            cookiesToSet.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            // no-op in Server Components; actual writes happen in Server Actions
          }
        },
      },
    },
  );
}
