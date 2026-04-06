import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType = 'image/jpeg', homeName, awayName, homePlayers, awayPlayers } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const homeRoster = homePlayers?.length
      ? `Known players for ${homeName}: ${(homePlayers as { name: string; jersey_number?: number | null }[]).map(p => `"${p.name}"${p.jersey_number != null ? ` (#${p.jersey_number})` : ''}`).join(', ')}`
      : '';
    const awayRoster = awayPlayers?.length
      ? `Known players for ${awayName}: ${(awayPlayers as { name: string; jersey_number?: number | null }[]).map(p => `"${p.name}"${p.jersey_number != null ? ` (#${p.jersey_number})` : ''}`).join(', ')}`
      : '';

    const rosterHint = [homeRoster, awayRoster].filter(Boolean).join('\n');

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
${rosterHint ? `\n${rosterHint}\n` : ''}
CRITICAL RULES:
- Look at each name written on the sheet character by character.
- If a roster is provided above, match what you see to the closest roster name ONLY if it is clearly the same person (same jersey number or very similar spelling). Otherwise write exactly what you see.
- Do NOT invent names. Do NOT guess. Do NOT fill in names that are not visible on the sheet.
- If a name is partially legible, write exactly what you can see (e.g. "מיכ..." or "J. S.").
- If a name is completely unreadable, use "?" for that player.
- For numeric stats: use the exact number visible, or 0 if unreadable. Never invent numbers.
- Include ONLY rows that are actually visible and filled in on the sheet.

Return ONLY valid JSON, no explanation:
{
  "home_score": <final home score as integer>,
  "away_score": <final away score as integer>,
  "home_players": [{"name": string, "jersey": number|null, "points": number, "three_pointers": number, "fouls": number}],
  "away_players": [{"name": string, "jersey": number|null, "points": number, "three_pointers": number, "fouls": number}]
}` },
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
    console.error('[extract-stats]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
