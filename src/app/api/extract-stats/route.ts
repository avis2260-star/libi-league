import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType = 'image/jpeg', homeName, awayName } = await req.json();

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
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
            text: `You are a strict data transcription assistant for a basketball scoresheet.
Home team: "${homeName}"
Away team: "${awayName}"

CRITICAL RULES:
- Transcribe player names EXACTLY as handwritten — do NOT correct spelling, do NOT guess full names, do NOT invent names.
- If a name is partially legible write what you see (e.g. "J. Smth", "Micael").
- If a name is completely unreadable use "?" for that player.
- For numeric stats: use the number you see, or 0 if unreadable. Never invent numbers.
- Include ONLY players that are actually visible on the sheet. Do NOT add players you cannot see.

Return ONLY valid JSON:
{
  "home_score": <final home score as integer>,
  "away_score": <final away score as integer>,
  "home_players": [{"name": string, "jersey": number|null, "points": number, "three_pointers": number, "fouls": number}],
  "away_players": [{"name": string, "jersey": number|null, "points": number, "three_pointers": number, "fouls": number}]
}`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    console.error('[extract-stats]', err);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
