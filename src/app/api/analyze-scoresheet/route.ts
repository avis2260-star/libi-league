import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/mfa';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

// This endpoint is public (the /submit flow uses it before a game rep has any
// session), which makes it a proxy to our Gemini quota — so it is rate-limited
// per IP and caps the payload it will forward.
const RATE_LIMIT = 20;              // calls per minute per IP
const MAX_BASE64_CHARS = 8_000_000; // ~6 MB of image data
// Any image/* subtype is allowed — the submit flow forwards the picked file's
// type verbatim, so a strict subtype list would reject photos that work today.
// Unsupported image formats still fail at Gemini, same as before.
const MEDIA_TYPE_RE = /^image\/[\w.+-]{1,30}$/;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || 'unknown';
    if (!rateLimit(`analyze:${ip}`, RATE_LIMIT, 60_000)) {
      return NextResponse.json({ error: 'יותר מדי בקשות — נסו שוב בעוד דקה' }, { status: 429 });
    }

    const { imageBase64, mediaType = 'image/jpeg' } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (imageBase64.length > MAX_BASE64_CHARS) {
      return NextResponse.json({ error: 'התמונה גדולה מדי' }, { status: 413 });
    }
    if (!MEDIA_TYPE_RE.test(mediaType)) {
      return NextResponse.json({ error: 'סוג קובץ לא נתמך' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data: imageBase64 } },
            { text: `Analyze this basketball scoresheet image for readability. Return ONLY valid JSON:
{
  "confidence_score": <0-10, where 10 = perfectly clear>,
  "status": <"pass" if >= 7, "fail" if < 7>,
  "issues": <array of problem strings in HEBREW, empty if none>,
  "recommendation": <advice string in HEBREW if fail, empty string if pass>
}
Check for ALL of the following and write findings in Hebrew:
- תמונה מטושטשת (blur)
- זווית צילום לקויה (bad angle)
- תאורה לקויה (poor lighting)
- כתב יד לא קריא (illegible handwriting)
- נתונים חסרים (incomplete data)
- סוג מסמך שגוי (wrong document type)
- עצם חוסם חלקים מהטופס כגון: יד, טלפון, עט, עכבר, כוס, או כל עצם זר המכסה שדות נתונים (foreign object obstructing the form)
If any fields or rows are hidden or obscured by a physical object, that is a critical issue — mark status as "fail".
Write all issues and recommendation text in Hebrew only.` },
          ],
        }],
        generationConfig: {
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));

    const parts: { thought?: boolean; text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find(p => !p.thought && p.text) ?? parts[0];
    const text: string = textPart?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze-scoresheet]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
