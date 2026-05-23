// Server actions talk to Supabase and call next/navigation's redirect().
// Mock all three so the actions run as plain functions we can assert on.
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
}));
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { auth: { admin: { generateLink: jest.fn().mockResolvedValue({}) } } },
}));
jest.mock('next/navigation', () => ({
  // In production redirect() throws NEXT_REDIRECT to halt execution; in tests
  // it's the last statement in each action, so a no-op spy is sufficient.
  redirect: jest.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redirect } from 'next/navigation';
import { loginAction, logoutAction } from '@/app/login/actions';
import {
  enrollMfaAction,
  verifyMfaAction,
  sendRecoveryLinkAction,
} from '@/app/login/mfa/actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setServerClient(client: any) {
  (createSupabaseServerClient as jest.Mock).mockResolvedValue(client);
}

function formDataOf(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

// ===========================================================================
// loginAction
// ===========================================================================

describe('loginAction', () => {
  it('signs in with the trimmed email and redirects to /admin by default', async () => {
    const signInWithPassword = jest.fn().mockResolvedValue({ error: null });
    setServerClient({ auth: { signInWithPassword } });

    await loginAction(formDataOf({ email: '  admin@libi.test  ', password: 'secret' }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@libi.test',
      password: 'secret',
    });
    expect(redirect).toHaveBeenCalledWith('/admin');
  });

  it('redirects to the supplied next path on success', async () => {
    setServerClient({ auth: { signInWithPassword: jest.fn().mockResolvedValue({ error: null }) } });

    await loginAction(formDataOf({ email: 'admin@libi.test', password: 'pw', next: '/admin/players' }));

    expect(redirect).toHaveBeenCalledWith('/admin/players');
  });

  it('returns the error message and does NOT redirect on failed login', async () => {
    setServerClient({
      auth: { signInWithPassword: jest.fn().mockResolvedValue({ error: { message: 'Invalid login credentials' } }) },
    });

    const result = await loginAction(formDataOf({ email: 'admin@libi.test', password: 'wrong' }));

    expect(result).toEqual({ error: 'Invalid login credentials' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('treats missing form fields as empty strings', async () => {
    const signInWithPassword = jest.fn().mockResolvedValue({ error: null });
    setServerClient({ auth: { signInWithPassword } });

    await loginAction(new FormData());

    expect(signInWithPassword).toHaveBeenCalledWith({ email: '', password: '' });
    expect(redirect).toHaveBeenCalledWith('/admin');
  });
});

// ===========================================================================
// logoutAction
// ===========================================================================

describe('logoutAction', () => {
  it('signs out and redirects to /login', async () => {
    const signOut = jest.fn().mockResolvedValue({});
    setServerClient({ auth: { signOut } });

    await logoutAction();

    expect(signOut).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});

// ===========================================================================
// enrollMfaAction
// ===========================================================================

describe('enrollMfaAction', () => {
  it('returns the factor id, QR and secret on success', async () => {
    setServerClient({
      auth: {
        mfa: {
          enroll: jest.fn().mockResolvedValue({
            data: { id: 'factor-123', totp: { qr_code: 'data:image/png;base64,AAA', secret: 'JBSWY3DP' } },
            error: null,
          }),
        },
      },
    });

    const res = await enrollMfaAction();

    expect(res).toEqual({ factorId: 'factor-123', qr: 'data:image/png;base64,AAA', secret: 'JBSWY3DP' });
  });

  it('returns an error when enrollment fails', async () => {
    setServerClient({
      auth: { mfa: { enroll: jest.fn().mockResolvedValue({ data: null, error: { message: 'Enroll failed' } }) } },
    });

    expect(await enrollMfaAction()).toEqual({ error: 'Enroll failed' });
  });
});

// ===========================================================================
// verifyMfaAction
// ===========================================================================

describe('verifyMfaAction', () => {
  it('returns an error and does not redirect when the challenge fails', async () => {
    setServerClient({
      auth: { mfa: { challenge: jest.fn().mockResolvedValue({ data: null, error: { message: 'Challenge failed' } }) } },
    });

    const res = await verifyMfaAction('factor-1', '123456', '/admin');

    expect(res).toEqual({ error: 'Challenge failed' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('returns an error and does not redirect when the code is invalid', async () => {
    setServerClient({
      auth: {
        mfa: {
          challenge: jest.fn().mockResolvedValue({ data: { id: 'ch-1' }, error: null }),
          verify: jest.fn().mockResolvedValue({ error: { message: 'Invalid TOTP code' } }),
        },
      },
    });

    const res = await verifyMfaAction('factor-1', '000000', '/admin');

    expect(res).toEqual({ error: 'Invalid TOTP code' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('verifies with the trimmed code and redirects on success', async () => {
    const verify = jest.fn().mockResolvedValue({ error: null });
    setServerClient({
      auth: {
        mfa: {
          challenge: jest.fn().mockResolvedValue({ data: { id: 'ch-1' }, error: null }),
          verify,
        },
      },
    });

    await verifyMfaAction('factor-1', '  123456  ', '/admin/players');

    expect(verify).toHaveBeenCalledWith({ factorId: 'factor-1', challengeId: 'ch-1', code: '123456' });
    expect(redirect).toHaveBeenCalledWith('/admin/players');
  });

  it('falls back to /admin when next is empty', async () => {
    setServerClient({
      auth: {
        mfa: {
          challenge: jest.fn().mockResolvedValue({ data: { id: 'ch-1' }, error: null }),
          verify: jest.fn().mockResolvedValue({ error: null }),
        },
      },
    });

    await verifyMfaAction('factor-1', '123456', '');

    expect(redirect).toHaveBeenCalledWith('/admin');
  });
});

// ===========================================================================
// sendRecoveryLinkAction — must resist email enumeration
// ===========================================================================

describe('sendRecoveryLinkAction', () => {
  const ORIGINAL = process.env.ADMIN_EMAILS;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL;
  });

  it('generates a magic link when the email is an allowlisted admin', async () => {
    process.env.ADMIN_EMAILS = 'admin@libi.test';

    const res = await sendRecoveryLinkAction('admin@libi.test');

    expect(res).toEqual({ ok: true });
    expect(supabaseAdmin.auth.admin.generateLink).toHaveBeenCalledTimes(1);
  });

  it('matches the allowlist case-insensitively', async () => {
    process.env.ADMIN_EMAILS = 'admin@libi.test';

    await sendRecoveryLinkAction('ADMIN@LIBI.TEST');

    expect(supabaseAdmin.auth.admin.generateLink).toHaveBeenCalledTimes(1);
  });

  it('returns ok WITHOUT generating a link for a non-admin email (anti-enumeration)', async () => {
    process.env.ADMIN_EMAILS = 'admin@libi.test';

    const res = await sendRecoveryLinkAction('attacker@evil.test');

    expect(res).toEqual({ ok: true });
    expect(supabaseAdmin.auth.admin.generateLink).not.toHaveBeenCalled();
  });

  it('never generates a link when the allowlist is empty', async () => {
    process.env.ADMIN_EMAILS = '';

    const res = await sendRecoveryLinkAction('admin@libi.test');

    expect(res).toEqual({ ok: true });
    expect(supabaseAdmin.auth.admin.generateLink).not.toHaveBeenCalled();
  });
});
