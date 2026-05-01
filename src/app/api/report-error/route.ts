import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = 'libileague@gmail.com';

export async function POST(req: NextRequest) {
  try {
    const { pageUrl, description } = await req.json();

    if (!description?.trim()) {
      return NextResponse.json({ error: 'נא לתאר את השגיאה' }, { status: 400 });
    }

    await resend.emails.send({
      from: 'ליגת ליבי <onboarding@resend.dev>',
      to: TO_EMAIL,
      subject: `🚨 דיווח על שגיאה באתר`,
      html: `
        <div dir="rtl" style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f1923; color: #e8edf5; border-radius: 12px;">
          <h2 style="color: #f97316; margin-bottom: 8px;">🚨 דיווח על שגיאה</h2>
          <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
          <p><strong>דף:</strong> <a href="${pageUrl}" style="color: #60a5fa;">${pageUrl}</a></p>
          <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
          <p><strong>תיאור השגיאה:</strong></p>
          <div style="background: #1a2a3a; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${description}</div>
          <hr style="border: 1px solid #1e3a5a; margin: 16px 0;" />
          <p style="font-size: 12px; color: #5a7a9a;">נשלח מכפתור דיווח על שגיאה באתר ליגת ליבי</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json({ error: 'שגיאה כללית' }, { status: 500 });
  }
}
