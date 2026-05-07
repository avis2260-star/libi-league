'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redirect } from 'next/navigation';

export async function enrollMfaAction(): Promise<
  { factorId: string; qr: string; secret: string } | { error: string }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `admin-${Date.now()}`,
  });
  if (error || !data) return { error: error?.message ?? 'Enroll failed' };
  return {
    factorId: data.id,
    qr: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyMfaAction(
  factorId: string,
  code: string,
  next: string,
): Promise<{ error: string } | never> {
  const supabase = await createSupabaseServerClient();
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (chErr || !challenge) {
    return { error: chErr?.message ?? 'Challenge failed' };
  }
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (vErr) return { error: vErr.message };

  redirect(next || '/admin');
}

export async function sendRecoveryLinkAction(
  email: string,
): Promise<{ ok: true }> {
  // Always return ok to prevent email enumeration.
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const target = email.trim().toLowerCase();

  if (adminEmails.length > 0 && adminEmails.includes(target)) {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: target,
      options: { redirectTo: `${origin}/admin/mfa-recovery` },
    });
  }

  return { ok: true };
}
