import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { escapeHtml } from '@/lib/escape-html';
import { getClientIp } from '@/lib/mfa';
import { rateLimit } from '@/lib/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = 'libileague@gmail.com';

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60_000;
const MAX_DESCRIPTION = 5_000;
const MAX_PAGE_URL = 500;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || 'unknown';
    if (!rateLimit(`report:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'יותר מדי דיווחים — נסו שוב בעוד מספר דקות' },
        { status: 429 },
      );
    }

    const { pageUrl, description } = await req.json();

    if (!description?.trim()) {
      return NextResponse.json({ error: 'נא לתאר את השגיאה' }, { status: 400 });
    }
    if (description.length > MAX_DESCRIPTION || (typeof pageUrl === 'string' && pageUrl.length > MAX_PAGE_URL)) {
      return NextResponse.json({ error: 'הדיווח ארוך מדי' }, { status: 400 });
    }

    // 1. Save to Supabase — reuses contact_submissions so it shows in the admin Messages tab.
    //    name = marker prefix so it's easy to spot, email = page URL, message = description.
    const { error: dbError } = await supabaseAdmin
      .from('contact_submissions')
      .insert({
        name: `🚨 דיווח שגיאה`,
        email: pageUrl ?? 'unknown',
        message: description.trim(),
      });

    if (dbError) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'שגיאת שמירה' }, { status: 500 });
    }

    // 2. Try to send email — non-fatal if it fails (report is already saved to DB).
    //    User-supplied fields are HTML-escaped, and the page URL is only rendered
    //    as a link when it looks like a same-site path or http(s) URL.
    const safeDescription = escapeHtml(description.trim());
    const rawUrl = typeof pageUrl === 'string' ? pageUrl.trim() : '';
    const safeUrl = escapeHtml(rawUrl);
    const linkable = /^(https?:\/\/|\/)/i.test(rawUrl);
    try {
      await resend.emails.send({
        from: 'ליגת ליבי <onboarding@resend.dev>',
        to: TO_EMAIL,
        subject: `🚨 דיווח על שגיאה באתר`,
        html: `
          <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f1923; color: #e8edf5; border-radius: 12px;">
            <h2 style="color: #f97316; margin-bottom: 8px;">🚨 דיווח על שגיאה</h2>
            <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
            <p><strong>דף:</strong> ${linkable ? `<a href="${safeUrl}" style="color: #60a5fa;">${safeUrl}</a>` : safeUrl || '—'}</p>
            <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
            <p><strong>תיאור השגיאה:</strong></p>
            <div style="background: #1a2a3a; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${safeDescription}</div>
            <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
            <p style="font-size: 12px; color: #5a7a9a;">נשלח מכפתור דיווח על שגיאה באתר ליגת ליבי</p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Email failure is non-fatal — report is already persisted in Supabase.
      console.warn('Email send failed (report saved to DB):', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json({ error: 'שגיאה כללית' }, { status: 500 });
  }
}
