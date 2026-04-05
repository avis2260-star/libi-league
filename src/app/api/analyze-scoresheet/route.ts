import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType = 'image/jpeg' } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;

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
  "status": <"pass" if >= 6, "fail" if < 6>,
  "issues": <array of problem strings, empty if none>,
  "recommendation": <advice string if fail, empty string if pass>
}
Check for: blur, bad angle, poor lighting, illegible handwriting, incomplete data, wrong document type.` },
          ],
        }],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data));

    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze-scoresheet]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
