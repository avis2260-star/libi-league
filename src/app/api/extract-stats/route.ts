import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/mfa';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

// Public endpoint (part of the /submit flow) that proxies to Gemini — rate
// limited per IP and payload-capped, same as analyze-scoresheet.
const RATE_LIMIT = 20;              // calls per minute per IP
const MAX_BASE64_CHARS = 8_000_000; // ~6 MB of image data
// Any image/* subtype — see analyze-scoresheet for rationale.
const MEDIA_TYPE_RE = /^image\/[\w.+-]{1,30}$/;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || 'unknown';
    if (!rateLimit(`extract:${ip}`, RATE_LIMIT, 60_000)) {
      return NextResponse.json({ error: 'יותר מדי בקשות — נסו שוב בעוד דקה' }, { status: 429 });
    }

    const { imageBase64, mediaType = 'image/jpeg', homeName, awayName, homePlayers, awayPlayers } = await req.json();
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
7. QUARTER BREAKDOWN: If the sheet clearly shows a per-period score table (rows labeled Q1/Q2/Q3/Q4 or רבע 1/2/3/4, with values for both teams), set "quarters_visible": true and fill "home_quarters" and "away_quarters" with exactly 4 integers each (in order Q1, Q2, Q3, Q4). If overtime period(s) are also visible, append them after the 4 quarters (so length becomes 5, 6, ...). If the sheet has no quarter breakdown, OR only one team's quarters are visible, OR you are not confident — set "quarters_visible": false and return empty arrays for both. Never invent quarter numbers.

Return ONLY valid JSON, no explanation:
{
  "home_score": <final home score as integer>,
  "away_score": <final away score as integer>,
  "quarters_visible": <boolean>,
  "home_quarters": <array of integers, length 0 or >=4>,
  "away_quarters": <array of integers, length 0 or >=4>,
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
