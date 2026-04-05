import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType = 'image/jpeg', homeName, awayName } = await req.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mediaType,
        },
      },
      `You are a strict data transcription assistant for a basketball scoresheet.
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
    ]);

    const text = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[extract-stats]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
