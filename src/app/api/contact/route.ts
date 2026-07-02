import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { escapeHtml } from '@/lib/escape-html';
import { getClientIp } from '@/lib/mfa';
import { rateLimit } from '@/lib/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = 'libileague@gmail.com';

// Generous for humans, hostile to scripts: 5 submissions / 10 minutes per IP.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60_000;

const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MAX_MESSAGE = 5_000;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || 'unknown';
    if (!rateLimit(`contact:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'יותר מדי פניות — נסו שוב בעוד מספר דקות' },
        { status: 429 },
      );
    }

    const { name, email, message } = await req.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'כל השדות חובה' }, { status: 400 });
    }
    if (name.length > MAX_NAME || email.length > MAX_EMAIL || message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: 'ההודעה ארוכה מדי' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'כתובת אימייל לא תקינה' }, { status: 400 });
    }

    // 1. Save to Supabase
    const { error: dbError } = await supabaseAdmin
      .from('contact_submissions')
      .insert({ name: name.trim(), email: email.trim(), message: message.trim() });

    if (dbError) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'שגיאת שמירה' }, { status: 500 });
    }

    // 2. Send email via Resend. All user-supplied fields are HTML-escaped —
    //    a form submission must never inject markup into the admin's inbox.
    const safeName = escapeHtml(name.trim());
    const safeEmail = escapeHtml(email.trim());
    const safeMessage = escapeHtml(message.trim());
    await resend.emails.send({
      from: 'ליגת ליבי <onboarding@resend.dev>',
      to: TO_EMAIL,
      subject: `📬 פנייה חדשה מ-${name.trim()}`,
      html: `
        <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f1923; color: #e8edf5; border-radius: 12px;">
          <h2 style="color: #f97316; margin-bottom: 8px;">📬 פנייה חדשה מליגת ליבי</h2>
          <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
          <p><strong>שם:</strong> ${safeName}</p>
          <p><strong>אימייל:</strong> <a href="mailto:${safeEmail}" style="color: #60a5fa;">${safeEmail}</a></p>
          <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
          <p><strong>הודעה:</strong></p>
          <div style="background: #1a2a3a; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${safeMessage}</div>
          <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
          <p style="font-size: 12px; color: #5a7a9a;">נשלח מטופס יצירת קשר באתר ליגת ליבי</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Contact error:', err);
    return NextResponse.json({ error: 'שגיאה כללית' }, { status: 500 });
  }
}
