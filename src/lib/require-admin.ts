/**
 * Admin authorization guards for Route Handlers and Server Actions.
 *
 * The middleware only intercepts requests that match its matcher — route
 * handlers under /api/admin and server actions are directly reachable over
 * HTTP, so each one must verify the caller itself. Both helpers read the
 * Supabase session from the request cookies and check the same ADMIN_EMAILS
 * allowlist the middleware uses.
 *
 * FAIL CLOSED: when ADMIN_EMAILS is unset or empty, everyone is denied.
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

async function isAdminRequest(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const allow = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (allow.length === 0) return false;

    return allow.includes(user.email?.toLowerCase() ?? '');
  } catch {
    return false;
  }
}

/**
 * Route-handler guard. Call first and return the response when non-null:
 *
 *   const unauthorized = await requireAdmin();
 *   if (unauthorized) return unauthorized;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdminRequest()) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/** Server-action guard: throws when the caller is not an allow-listed admin. */
export async function assertAdmin(): Promise<void> {
  if (!(await isAdminRequest())) throw new Error('Unauthorized');
}
