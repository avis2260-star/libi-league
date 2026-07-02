// Mock the Supabase SSR client factory so middleware never touches the network.
// We let the real @/lib/mfa helpers run — they're driven by request headers,
// env vars, and the mocked Supabase client, all of which we control here.
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

type FakeUser = { email: string } | null;

/** Build a mocked Supabase server client with a fixed user + AAL. */
function mockSupabase(opts: { user: FakeUser; aal?: 'aal1' | 'aal2' | null }) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: opts.user } }),
      mfa: {
        getAuthenticatorAssuranceLevel: jest.fn().mockResolvedValue({
          data: { currentLevel: opts.aal ?? 'aal1' },
          error: null,
        }),
      },
    },
  };
}

function setSupabase(opts: { user: FakeUser; aal?: 'aal1' | 'aal2' | null }) {
  (createServerClient as jest.Mock).mockReturnValue(mockSupabase(opts));
}

/** Build a NextRequest for a path, optionally with a client IP header. */
function request(path: string, ip?: string) {
  const headers: Record<string, string> = {};
  if (ip) headers['x-forwarded-for'] = ip;
  return new NextRequest(`https://libi.test${path}`, { headers });
}

const ADMIN_EMAIL = 'admin@libi.test';
const TRUSTED_IP = '203.0.113.9';

// Snapshot + restore the env vars middleware reads.
const ENV_KEYS = ['ADMIN_EMAILS', 'ADMIN_TRUSTED_IPS'] as const;
const savedEnv: Record<string, string | undefined> = {};
beforeAll(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});
beforeEach(() => {
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;
  process.env.ADMIN_TRUSTED_IPS = TRUSTED_IP;
});
afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

// ===========================================================================
// /admin protection
// ===========================================================================

describe('middleware: /admin protection', () => {
  it('redirects an unauthenticated user to /login with a next param', async () => {
    setSupabase({ user: null });
    const res = await middleware(request('/admin'));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/login');
    expect(loc.searchParams.get('next')).toBe('/admin');
  });

  it('redirects a logged-in NON-allowlisted user to /403', async () => {
    setSupabase({ user: { email: 'random@example.com' }, aal: 'aal2' });
    const res = await middleware(request('/admin', TRUSTED_IP));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/403');
  });

  it('allows an allowlisted admin from a trusted IP to pass through', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal1' });
    const res = await middleware(request('/admin', TRUSTED_IP));
    // NextResponse.next() — not a redirect
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('allows the admin email regardless of letter-case', async () => {
    setSupabase({ user: { email: 'ADMIN@LIBI.TEST' }, aal: 'aal2' });
    const res = await middleware(request('/admin', TRUSTED_IP));
    expect(res.headers.get('location')).toBeNull();
  });

  it('FAILS CLOSED: denies everyone when ADMIN_EMAILS is empty', async () => {
    process.env.ADMIN_EMAILS = '';
    setSupabase({ user: { email: 'anyone@example.com' }, aal: 'aal2' });
    const res = await middleware(request('/admin', TRUSTED_IP));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/403');
  });
});

// ===========================================================================
// /api/admin protection — 401 JSON instead of redirects
// ===========================================================================

describe('middleware: /api/admin protection', () => {
  it('returns 401 JSON for an unauthenticated API request', async () => {
    setSupabase({ user: null });
    const res = await middleware(request('/api/admin/teams'));
    expect(res.status).toBe(401);
    expect(res.headers.get('location')).toBeNull();
  });

  it('returns 401 JSON for a non-allowlisted user', async () => {
    setSupabase({ user: { email: 'random@example.com' }, aal: 'aal2' });
    const res = await middleware(request('/api/admin/teams', TRUSTED_IP));
    expect(res.status).toBe(401);
  });

  it('returns 401 JSON when AAL is aal1 from an untrusted IP', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal1' });
    const res = await middleware(request('/api/admin/teams', '10.0.0.1'));
    expect(res.status).toBe(401);
  });

  it('lets an allowlisted aal2 admin through', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal2' });
    const res = await middleware(request('/api/admin/teams', '10.0.0.1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

// ===========================================================================
// /admin MFA gate
// ===========================================================================

describe('middleware: /admin MFA gate', () => {
  it('redirects to /login/mfa when the IP is untrusted and AAL is only aal1', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal1' });
    const res = await middleware(request('/admin', '10.0.0.1')); // untrusted IP
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/login/mfa');
    expect(loc.searchParams.get('next')).toBe('/admin');
  });

  it('allows access from an untrusted IP once AAL is aal2', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal2' });
    const res = await middleware(request('/admin', '10.0.0.1'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('does not require MFA from a trusted IP even at aal1', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal1' });
    const res = await middleware(request('/admin', TRUSTED_IP));
    expect(res.headers.get('location')).toBeNull();
  });

  it('exempts /admin/mfa-recovery from the MFA gate', async () => {
    // Untrusted IP + aal1 would normally force MFA, but the recovery page is
    // how you regain access after losing your authenticator.
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal1' });
    const res = await middleware(request('/admin/mfa-recovery', '10.0.0.1'));
    expect(res.headers.get('location')).toBeNull();
  });
});

// ===========================================================================
// /login and /login/mfa redirects
// ===========================================================================

describe('middleware: /login redirects', () => {
  it('redirects an already logged-in user away from /login to /admin', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal2' });
    const res = await middleware(request('/login'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/admin');
  });

  it('lets an unauthenticated user reach /login', async () => {
    setSupabase({ user: null });
    const res = await middleware(request('/login'));
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('middleware: /login/mfa redirects', () => {
  it('sends a logged-in user from a trusted IP straight to /admin', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal1' });
    const res = await middleware(request('/login/mfa', TRUSTED_IP));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/admin');
  });

  it('sends a logged-in user already at aal2 to /admin', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal2' });
    const res = await middleware(request('/login/mfa', '10.0.0.1'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/admin');
  });

  it('keeps a logged-in aal1 user from an untrusted IP on the MFA page', async () => {
    setSupabase({ user: { email: ADMIN_EMAIL }, aal: 'aal1' });
    const res = await middleware(request('/login/mfa', '10.0.0.1'));
    expect(res.headers.get('location')).toBeNull();
  });
});
