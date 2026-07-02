/**
 * Tests for the admin guards used by every /api/admin route handler
 * (requireAdmin) and every admin server action (assertAdmin).
 */

const getUserMock = jest.fn();
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  }),
}));

import { requireAdmin, assertAdmin } from '@/lib/require-admin';

const ADMIN_EMAIL = 'admin@libi.test';
const ORIGINAL = process.env.ADMIN_EMAILS;

beforeEach(() => {
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;
  getUserMock.mockReset();
});
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

function setUser(email: string | null) {
  getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } });
}

describe('requireAdmin', () => {
  it('returns null (authorized) for an allowlisted admin', async () => {
    setUser(ADMIN_EMAIL);
    expect(await requireAdmin()).toBeNull();
  });

  it('matches the allowlist case-insensitively', async () => {
    setUser('ADMIN@LIBI.TEST');
    expect(await requireAdmin()).toBeNull();
  });

  it('returns 401 when there is no session', async () => {
    setUser(null);
    const res = await requireAdmin();
    expect(res?.status).toBe(401);
  });

  it('returns 401 for an authenticated but non-allowlisted user', async () => {
    setUser('random@example.com');
    const res = await requireAdmin();
    expect(res?.status).toBe(401);
  });

  it('FAILS CLOSED: returns 401 for everyone when ADMIN_EMAILS is empty', async () => {
    process.env.ADMIN_EMAILS = '';
    setUser(ADMIN_EMAIL);
    const res = await requireAdmin();
    expect(res?.status).toBe(401);
  });

  it('returns 401 when reading the session throws', async () => {
    getUserMock.mockRejectedValue(new Error('cookies unavailable'));
    const res = await requireAdmin();
    expect(res?.status).toBe(401);
  });
});

describe('assertAdmin', () => {
  it('resolves for an allowlisted admin', async () => {
    setUser(ADMIN_EMAIL);
    await expect(assertAdmin()).resolves.toBeUndefined();
  });

  it('throws for a non-admin', async () => {
    setUser('random@example.com');
    await expect(assertAdmin()).rejects.toThrow('Unauthorized');
  });

  it('throws when there is no session', async () => {
    setUser(null);
    await expect(assertAdmin()).rejects.toThrow('Unauthorized');
  });
});
