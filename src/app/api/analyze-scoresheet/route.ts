import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType = 'image/jpeg' } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mediaType,
        },
      },
      `Analyze this basketball scoresheet image for readability. Return ONLY valid JSON:
{
  "confidence_score": <0-10, where 10 = perfectly clear>,
  "status": <"pass" if >= 6, "fail" if < 6>,
  "issues": <array of problem strings, empty if none>,
  "recommendation": <advice string if fail, empty string if pass>
}
Check for: blur, bad angle, poor lighting, illegible handwriting, incomplete data, wrong document type.`,
    ]);

    const text = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze-scoresheet]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
