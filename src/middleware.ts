import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getAal, getClientIp, isTrustedIp } from '@/lib/mfa';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Build a server client that can refresh the session cookie
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — must be called before any auth checks
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Protect /admin pages AND /api/admin route handlers ─────────────────────
  // API callers get a 401 JSON response (a redirect would hand fetch() an HTML
  // login page); browser page loads keep the original redirect flows.
  // NOTE: this is defense-in-depth — every /api/admin handler ALSO calls
  // requireAdmin() itself (see src/lib/require-admin.ts), so a middleware
  // bypass alone can't reach the service-role client.
  const isAdminApi = pathname.startsWith('/api/admin');
  if (pathname.startsWith('/admin') || isAdminApi) {
    const deny = (redirectTo: URL) =>
      isAdminApi
        ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        : NextResponse.redirect(redirectTo);

    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      return deny(loginUrl);
    }

    // Admin email allowlist check. FAIL CLOSED: an unset/empty ADMIN_EMAILS
    // denies everyone rather than letting any authenticated user through.
    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) {
      return deny(new URL('/403', request.url));
    }

    // MFA gate: required when request is from an untrusted IP.
    // /admin/mfa-recovery is exempt — that's how you regain access after
    // losing your authenticator (you arrive via emailed magic link).
    if (pathname !== '/admin/mfa-recovery') {
      const trusted = isTrustedIp(getClientIp(request));
      if (!trusted) {
        const aal = await getAal(supabase);
        if (aal !== 'aal2') {
          const url = request.nextUrl.clone();
          url.pathname = '/login/mfa';
          url.searchParams.set('next', pathname);
          return deny(url);
        }
      }
    }
  }

  // ── Redirect logged-in users away from /login ───────────────────────────────
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // ── Skip /login/mfa if already at aal2 from a trusted IP path ──────────────
  if (pathname === '/login/mfa' && user) {
    const trusted = isTrustedIp(getClientIp(request));
    const aal = await getAal(supabase);
    if (trusted || aal === 'aal2') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/admin/:path*', '/login/:path*', '/api/admin/:path*'],
};
