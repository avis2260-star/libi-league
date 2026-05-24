import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';

export const maxDuration = 60;

/**
 * Generates a Hebrew professional-basketball commentary on how a specific
 * team is coming into a cup match-up. Pulls the team's actual standings
 * row, full game-by-game results, and cup path for the requested season,
 * builds a structured context string, and prompts Gemini for one paragraph
 * of professional-grade prose.
 *
 * Body: { teamName: string, opponentName?: string, roundName?: string,
 *         season?: string }
 *
 * Response: { text: string } on success, { error: string } on failure.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      teamName?: string;
      opponentName?: string;
      roundName?: string;
      season?: string;
    };

    const teamName = body.teamName?.trim();
    if (!teamName) {
      return NextResponse.json({ error: 'teamName is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });
    }

    const season = (body.season?.trim()) || (await getCurrentSeason());

    // ── Pull the actual data we'll feed the LLM ──────────────────────────
    const [
      { data: standingsData },
      { data: leagueGames },
      { data: cupGames },
    ] = await Promise.all([
      supabaseAdmin
        .from('standings')
        .select('name, division, rank, wins, losses, games, pf, pa, diff, pts, techni, penalty')
        .eq('season', season),
      supabaseAdmin
        .from('game_results')
        .select('round, date, home_team, away_team, home_score, away_score, techni')
        .eq('season', season)
        .order('round', { ascending: true }),
      supabaseAdmin
        .from('cup_games')
        .select('round, round_order, game_number, home_team, away_team, home_score, away_score, played, date')
        .eq('season', season)
        .order('round_order', { ascending: true })
        .order('game_number', { ascending: true }),
    ]);

    type StandingRow = { name: string; division: string; rank: number; wins: number; losses: number; games: number; pf: number; pa: number; diff: number; pts: number; techni?: number; penalty?: number };
    type LeagueRow   = { round: number; date: string | null; home_team: string; away_team: string; home_score: number | null; away_score: number | null; techni: boolean | null };
    type CupRow      = { round: string; round_order: number; game_number: number; home_team: string; away_team: string; home_score: number | null; away_score: number | null; played: boolean; date: string | null };

    // Fuzzy match: strip quotes / punctuation, fall back to substring contains.
    function normalize(s: string) {
      return s.replace(/["“”״''`׳]/g, '').replace(/\s+/g, ' ').trim();
    }
    const targetNorm = normalize(teamName);
    function matches(name: string | null | undefined) {
      if (!name) return false;
      const n = normalize(name);
      return n === targetNorm || n.includes(targetNorm) || targetNorm.includes(n);
    }

    const standing = ((standingsData ?? []) as StandingRow[]).find(s => matches(s.name)) ?? null;

    const teamLeagueGames = ((leagueGames ?? []) as LeagueRow[]).filter(g =>
      matches(g.home_team) || matches(g.away_team)
    );

    const teamCupGames = ((cupGames ?? []) as CupRow[]).filter(g =>
      matches(g.home_team) || matches(g.away_team)
    );

    // ── Build human-readable context for the prompt ──────────────────────

    const standingLine = standing
      ? `מקום ${standing.rank} בבית ${standing.division === 'North' ? 'הצפון' : standing.division === 'South' ? 'הדרום' : standing.division} ` +
        `· ${standing.wins} ניצחונות / ${standing.losses} הפסדים מתוך ${standing.games} משחקים ` +
        `· ${standing.pts} נקודות ` +
        `· סלים בעד: ${standing.pf} · סלים נגד: ${standing.pa} · הפרש סלים: ${standing.diff >= 0 ? '+' : ''}${standing.diff}` +
        (standing.techni ? ` · ${standing.techni} עונשים טכניים` : '') +
        (standing.penalty ? ` · ${standing.penalty} הורדות נקודה` : '')
      : 'לא נמצאו נתוני טבלת ליגה לקבוצה זו.';

    function leagueRowLine(g: LeagueRow): string {
      const isHome = matches(g.home_team);
      const usScore  = isHome ? g.home_score : g.away_score;
      const themScore = isHome ? g.away_score : g.home_score;
      const opponent = isHome ? g.away_team : g.home_team;
      const venue = isHome ? 'בבית' : 'בחוץ';
      if (g.techni) {
        return `· מחזור ${g.round} (${g.date ?? '?'}) ${venue} מול ${opponent} — תוצאה טכנית ${g.home_score ?? 0}:${g.away_score ?? 0}`;
      }
      if (usScore == null || themScore == null) {
        return `· מחזור ${g.round} (${g.date ?? '?'}) ${venue} מול ${opponent} — טרם שוחק`;
      }
      const verdict = usScore > themScore ? 'ניצחון' : usScore < themScore ? 'הפסד' : 'תיקו';
      return `· מחזור ${g.round} (${g.date ?? '?'}) ${venue} מול ${opponent} — ${verdict} ${usScore}:${themScore}`;
    }

    function cupRowLine(g: CupRow): string {
      const isHome = matches(g.home_team);
      const opponent = isHome ? g.away_team : g.home_team;
      const venue = isHome ? 'בבית' : 'בחוץ';
      if (!g.played) {
        return `· ${g.round} ${venue} מול ${opponent} — צפוי (${g.date ?? '?'})`;
      }
      const us  = isHome ? (g.home_score ?? 0) : (g.away_score ?? 0);
      const them = isHome ? (g.away_score ?? 0) : (g.home_score ?? 0);
      const verdict = us > them ? 'ניצחון' : us < them ? 'הפסד' : 'תיקו';
      return `· ${g.round} ${venue} מול ${opponent} — ${verdict} ${us}:${them} (${g.date ?? '?'})`;
    }

    const leagueLines = teamLeagueGames.map(leagueRowLine).join('\n');
    const cupLines    = teamCupGames.map(cupRowLine).join('\n');

    const opponentContext = body.opponentName?.trim()
      ? `המשחק הקרוב: ${teamName} מול ${body.opponentName}${body.roundName ? ` · שלב ${body.roundName}` : ''}.`
      : '';

    const prompt = `אתה פרשן כדורסל מקצועי הכותב טור הכנה למשחק גמר/חצי גמר גביע בעברית. כתוב פסקה אחת רהוטה (3-5 משפטים, סך הכל 70-120 מילים) על איך הקבוצה הזו מגיעה למשחק. השתמש בנתונים האמיתיים הבאים בלבד — אל תמציא מספרים, אל תמציא שמות שחקנים, אל תמציא תוצאות.

קבוצה: ${teamName}
עונה: ${season}
${opponentContext}

== טבלת ליגה ==
${standingLine}

== כל משחקי הליגה השנה (לפי סדר) ==
${leagueLines || '(אין נתונים)'}

== מסלול הגביע ==
${cupLines || '(אין נתונים)'}

הנחיות לכתיבה:
- טון של פרשן ספורט מקצועי (חי, מעניין, אך לא מוגזם).
- התייחס לתוצאות קונקרטיות (פערים, יריבים בולטים, רצף ניצחונות/הפסדים).
- אם יש תוצאה משמעותית במיוחד (פער ענק, הפתעה, ניצחון על קבוצה מובילה) — תזכיר אותה.
- אל תכלול כותרת, אל תוסיף "לסיכום", אל תכתוב הקדמה. רק הפסקה.
- ענה בעברית בלבד, ללא תרגום.
- ענה רק את הטקסט של הפסקה — ללא מרכאות מסביב, ללא JSON, ללא בלוקים.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0.7,
        },
      }),
    });

    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      const msg = data?.error?.message ?? JSON.stringify(data);
      return NextResponse.json({ error: `Gemini: ${msg}` }, { status: 500 });
    }

    const parts: { thought?: boolean; text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find(p => !p.thought && p.text) ?? parts[0];
    const text: string = (textPart?.text ?? '').trim();
    if (!text) {
      return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 500 });
    }

    return NextResponse.json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה';
    console.error('[match-previews/generate]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
