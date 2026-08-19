'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redirect } from 'next/navigation';
import { Resend } from 'resend';

// Sender for the recovery email. Override RECOVERY_FROM_EMAIL once a domain is
// verified in Resend; the default shared sender only delivers to the address
// that owns the Resend account.
const RECOVERY_FROM_EMAIL =
  process.env.RECOVERY_FROM_EMAIL ?? 'ליגת ליבי <onboarding@resend.dev>';

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
    // Errors are swallowed (logged only) so a failed send never reveals, via
    // timing or a thrown error, whether the address is an admin.
    try {
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

      // generateLink() only MINTS the magic link — it does not send any email.
      // We take the returned action_link and deliver it ourselves via Resend.
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: target,
        options: { redirectTo: `${origin}/admin/mfa-recovery` },
      });

      const link = data?.properties?.action_link;
      if (error || !link) {
        console.error('Recovery link generation failed:', error);
        return { ok: true };
      }

      // Dev/local fallback: print the link to the server logs so you can always
      // recover — even with no email provider configured. Gated to non-production
      // ONLY: this magic link grants an admin session, so it must never land in
      // production logs where anyone with log access could replay it.
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[mfa-recovery] recovery link for ${target}: ${link}`);
      }

      if (!process.env.RESEND_API_KEY) {
        console.error(
          'RESEND_API_KEY is not set — recovery link was generated but not emailed.',
        );
        return { ok: true };
      }

      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: sendError } = await resend.emails.send({
        from: RECOVERY_FROM_EMAIL,
        to: target,
        subject: '🔑 קישור לאיפוס אימות דו-שלבי — ניהול ליגת ליבי',
        html: `
          <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f1923; color: #e8edf5; border-radius: 12px;">
            <h2 style="color: #f97316; margin-bottom: 8px;">🔑 איפוס אפליקציית האימות</h2>
            <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
            <p>ביקשת לאפס את אפליקציית האימות (2FA) של ממשק הניהול. לחצו על הכפתור כדי להיכנס ולהסיר את האימות הנוכחי, ואז תוכלו להגדיר אפליקציית אימות חדשה.</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="${link}" style="display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600;">כניסה ואיפוס האימות</a>
            </p>
            <p style="font-size: 13px; color: #9ab;">הקישור תקף לזמן מוגבל וניתן לשימוש חד-פעמי. אם לא ביקשת זאת — התעלמו מהודעה זו.</p>
            <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
            <p style="font-size: 12px; color: #5a7a9a;">נשלח ממערכת הניהול של ליגת ליבי</p>
          </div>
        `,
      });

      if (sendError) {
        console.error('Recovery email send failed:', sendError);
      }
    } catch (err) {
      console.error('Recovery link error:', err);
    }
  }

  return { ok: true };
}
