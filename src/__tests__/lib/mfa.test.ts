import { getClientIp, isTrustedIp, getAal } from '@/lib/mfa';
import type { SupabaseClient } from '@supabase/supabase-js';

// ===========================================================================
// getClientIp — extract the client IP from proxy headers
// ===========================================================================

describe('getClientIp', () => {
  it('reads the IP from x-forwarded-for', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '203.0.113.5' },
    });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('takes the first hop and trims when x-forwarded-for has a chain', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': ' 203.0.113.5 , 10.0.0.1 , 10.0.0.2 ' },
    });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-real-ip': '198.51.100.7' },
    });
    expect(getClientIp(req)).toBe('198.51.100.7');
  });

  it('trims whitespace from x-real-ip', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-real-ip': '  198.51.100.7  ' },
    });
    expect(getClientIp(req)).toBe('198.51.100.7');
  });

  it('prefers x-forwarded-for over x-real-ip when both are present', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '203.0.113.5', 'x-real-ip': '198.51.100.7' },
    });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('returns an empty string when no IP headers are present', () => {
    const req = new Request('https://x.test');
    expect(getClientIp(req)).toBe('');
  });
});

// ===========================================================================
// isTrustedIp — allowlist check against ADMIN_TRUSTED_IPS
// ===========================================================================

describe('isTrustedIp', () => {
  const ORIGINAL = process.env.ADMIN_TRUSTED_IPS;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_TRUSTED_IPS;
    else process.env.ADMIN_TRUSTED_IPS = ORIGINAL;
  });

  it('returns false for an empty ip even when the allowlist is populated', () => {
    process.env.ADMIN_TRUSTED_IPS = '203.0.113.5';
    expect(isTrustedIp('')).toBe(false);
  });

  it('returns true when the ip is in the allowlist', () => {
    process.env.ADMIN_TRUSTED_IPS = '203.0.113.5,198.51.100.7';
    expect(isTrustedIp('198.51.100.7')).toBe(true);
  });

  it('returns false when the ip is not in the allowlist', () => {
    process.env.ADMIN_TRUSTED_IPS = '203.0.113.5';
    expect(isTrustedIp('10.0.0.1')).toBe(false);
  });

  it('tolerates whitespace around allowlist entries', () => {
    process.env.ADMIN_TRUSTED_IPS = ' 203.0.113.5 , 198.51.100.7 ';
    expect(isTrustedIp('203.0.113.5')).toBe(true);
  });

  it('returns false when the allowlist env var is unset', () => {
    delete process.env.ADMIN_TRUSTED_IPS;
    expect(isTrustedIp('203.0.113.5')).toBe(false);
  });

  it('returns false when the allowlist env var is empty', () => {
    process.env.ADMIN_TRUSTED_IPS = '';
    expect(isTrustedIp('203.0.113.5')).toBe(false);
  });
});

// ===========================================================================
// getAal — read the Authenticator Assurance Level from Supabase
// ===========================================================================

describe('getAal', () => {
  function clientReturning(resp: unknown): SupabaseClient {
    return {
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: jest.fn().mockResolvedValue(resp),
        },
      },
    } as unknown as SupabaseClient;
  }

  it('returns aal2 when that is the current level', async () => {
    const c = clientReturning({ data: { currentLevel: 'aal2' }, error: null });
    expect(await getAal(c)).toBe('aal2');
  });

  it('returns aal1 when that is the current level', async () => {
    const c = clientReturning({ data: { currentLevel: 'aal1' }, error: null });
    expect(await getAal(c)).toBe('aal1');
  });

  it('returns null when Supabase responds with an error', async () => {
    const c = clientReturning({ data: null, error: new Error('mfa unavailable') });
    expect(await getAal(c)).toBeNull();
  });

  it('returns null when there is no data', async () => {
    const c = clientReturning({ data: null, error: null });
    expect(await getAal(c)).toBeNull();
  });

  it('returns null when currentLevel itself is null', async () => {
    const c = clientReturning({ data: { currentLevel: null }, error: null });
    expect(await getAal(c)).toBeNull();
  });
});
