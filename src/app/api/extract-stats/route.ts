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
CRITICAL RULES — READ CAREFULLY:
1. For each player row visible on the sheet, look at the handwritten name.
2. If that name clearly matches a name from the roster provided above (same person, similar spelling or matching jersey number) → use the EXACT official roster name.
3. If the name does NOT match anyone on the roster, or you are not sure → write "?" for that player. Do NOT guess. Do NOT invent a name. Do NOT write what you think you see.
4. NEVER write a name that is not on the roster. The only valid names are the ones listed above. Anything else must be "?".
5. For numeric stats: write the exact number visible on the sheet, or 0 if unreadable. Never invent numbers.
6. Include ONLY rows that are actually visible and filled in on the sheet.

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
