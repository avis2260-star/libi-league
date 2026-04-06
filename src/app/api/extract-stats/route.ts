import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType = 'image/jpeg', homeName, awayName } = await req.json();

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
            { text: `You are a strict data transcription assistant for a basketball scoresheet.
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
}` },
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
    console.error('[extract-stats]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
