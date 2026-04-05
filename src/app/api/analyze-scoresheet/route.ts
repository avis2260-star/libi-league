import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60; // Claude vision can take 10–20s — raise Vercel limit from default 10s

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType = 'image/jpeg' } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Analyze this basketball scoresheet image for readability. Return ONLY valid JSON:
{
  "confidence_score": <0-10, where 10 = perfectly clear>,
  "status": <"pass" if >= 6, "fail" if < 6>,
  "issues": <array of problem strings, empty if none>,
  "recommendation": <advice string if fail, empty string if pass>
}
Check for: blur, bad angle, poor lighting, illegible handwriting, incomplete data, wrong document type.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze-scoresheet]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
