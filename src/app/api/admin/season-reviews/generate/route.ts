import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';

export const maxDuration = 60;

/**
 * POST /api/admin/season-reviews/generate
 *
 * Generates a comprehensive Hebrew season-review article using Gemini.
 * The data pulled — and the tone of the prompt — depend on `reviewType`:
 *
 *   pre_season  → last season's final table + top scorers + hall-of-fame champions.
 *                 Suitable for "opening of season" previews written before kick-off.
 *   mid_season  → current season standings so far + results + scorers snapshot.
 *                 Suitable for a mid-season break article.
 *   end_season  → full season data: final table, all results, top scorers, cup.
 *                 Suitable for a season wrap-up piece.
 *   custom      → all available data for the target season + optional extra notes.
 *
 * Body: {
 *   reviewType: 'pre_season' | 'mid_season' | 'end_season' | 'custom',
 *   season?: string,       // season to WRITE ABOUT (defaults to current)
 *   customNotes?: string,  // extra context / instructions for the AI
 * }
 *
 * Response: { title: string, text: string }
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json() as {
      reviewType?: string;
      season?: string;
      customNotes?: string;
      focus?: {
        competition?: 'league' | 'cup' | 'playoff';
        round?: string;
        home_team?: string;
        away_team?: string;
        home_score?: number | null;
        away_score?: number | null;
        date?: string | null;
        cupGameId?: string;
        seriesNumber?: number;
        gameNumber?: number;
      } | null;
    };

    const reviewType = body.reviewType ?? 'custom';
    const targetSeason = body.season?.trim() || await getCurrentSeason();
    const customNotes  = body.customNotes?.trim() ?? '';
    // A focused single-game/event review only applies to the free ("custom") type.
    const focus = reviewType === 'custom' && body.focus?.home_team && body.focus?.away_team
      ? body.focus
      : null;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });
    }

    // For pre_season we pull the PREVIOUS season's final data.
    const dataSeason = reviewType === 'pre_season'
      ? derivePreviousSeason(targetSeason)
      : targetSeason;

    // ── Fetch data ──────────────────────────────────────────────────────────
    const [
      { data: standingsRaw },
      { data: gameResultsRaw },
      { data: cupGamesRaw },
      { data: gameStatsRaw },
      { data: playersRaw },
      { data: teamsRaw },
      { data: hofSeasonsRaw },
    ] = await Promise.all([
      supabaseAdmin
        .from('standings')
        .select('name, division, rank, wins, losses, games, pf, pa, diff, pts, techni, penalty')
        .eq('season', dataSeason)
        .order('rank', { ascending: true }),

      supabaseAdmin
        .from('game_results')
        .select('round, date, home_team, away_team, home_score, away_score, techni')
        .eq('season', dataSeason)
        .order('round', { ascending: true }),

      supabaseAdmin
        .from('cup_games')
        .select('round, round_order, game_number, home_team, away_team, home_score, away_score, played, date')
        .eq('season', dataSeason)
        .order('round_order', { ascending: true })
        .order('game_number', { ascending: true }),

      supabaseAdmin
        .from('game_stats')
        .select('player_id, team_id, points, three_pointers')
        .eq('season', dataSeason),

      supabaseAdmin
        .from('players')
        .select('id, name'),

      supabaseAdmin
        .from('teams')
        .select('id, name'),

      // Last 4 seasons of hall-of-fame for historical context.
      supabaseAdmin
        .from('league_history_seasons')
        .select('year, champion_name, runner_up_name, cup_holder_name, mvp_name, mvp_stats')
        .order('year', { ascending: false })
        .limit(4),
    ]);

    // ── Build helper maps ───────────────────────────────────────────────────
    const playerNameById = new Map<string, string>(
      (playersRaw ?? []).map((p) => [p.id as string, p.name as string])
    );
    const teamNameById = new Map<string, string>(
      (teamsRaw ?? []).map((t) => [t.id as string, t.name as string])
    );

    // ── Focused game box score (per-player stats for the single game) ────────
    // When the editor picked a specific cup/playoff game, pull its box score so
    // the article can LEAD with that game's stats, not the season aggregates.
    let focusBoxScore = '';
    if (focus) {
      type StatRow = { player_id: string; team_id: string | null; points: number | null; three_pointers: number | null; fouls: number | null };
      let rows: StatRow[] = [];
      if (focus.competition === 'cup' && focus.cupGameId) {
        const { data } = await supabaseAdmin
          .from('cup_game_stats')
          .select('player_id, team_id, points, three_pointers, fouls')
          .eq('cup_game_id', focus.cupGameId);
        rows = (data ?? []) as StatRow[];
      } else if (focus.competition === 'playoff' && focus.seriesNumber != null && focus.gameNumber != null) {
        const { data } = await supabaseAdmin
          .from('playoff_game_stats')
          .select('player_id, team_id, points, three_pointers, fouls')
          .eq('season', targetSeason)
          .eq('series_number', focus.seriesNumber)
          .eq('game_number', focus.gameNumber);
        rows = (data ?? []) as StatRow[];
      }
      if (rows.length > 0) {
        // Group by team, list players sorted by points desc.
        const byTeam = new Map<string, { name: string; players: { name: string; pts: number; threes: number; fouls: number }[] }>();
        for (const r of rows) {
          const teamName = r.team_id ? (teamNameById.get(r.team_id) ?? '—') : '—';
          const slot = byTeam.get(teamName) ?? { name: teamName, players: [] };
          slot.players.push({
            name:   playerNameById.get(r.player_id) ?? '—',
            pts:    r.points ?? 0,
            threes: r.three_pointers ?? 0,
            fouls:  r.fouls ?? 0,
          });
          byTeam.set(teamName, slot);
        }
        const blocks: string[] = [];
        for (const { name, players } of byTeam.values()) {
          const total = players.reduce((s, p) => s + p.pts, 0);
          const line = players
            .sort((a, b) => b.pts - a.pts)
            .map(p => `${p.name} ${p.pts} נק'${p.threes ? ` (${p.threes} שלשות)` : ''}${p.fouls ? ` · ${p.fouls} עבירות` : ''}`)
            .join(', ');
          blocks.push(`${name} (${total} נק'): ${line}`);
        }
        focusBoxScore = blocks.join('\n');
      }
    }

    // ── Aggregate top scorers ───────────────────────────────────────────────
    type ScorerAgg = { name: string; teamName: string; points: number; games: number; threes: number };
    const scorerMap = new Map<string, ScorerAgg>();
    for (const s of (gameStatsRaw ?? []) as { player_id: string; team_id: string; points: number; three_pointers: number }[]) {
      const prev = scorerMap.get(s.player_id);
      const name     = playerNameById.get(s.player_id) ?? '—';
      const teamName = teamNameById.get(s.team_id)     ?? '—';
      if (prev) {
        prev.points += s.points ?? 0;
        prev.games  += 1;
        prev.threes += s.three_pointers ?? 0;
      } else {
        scorerMap.set(s.player_id, { name, teamName, points: s.points ?? 0, games: 1, threes: s.three_pointers ?? 0 });
      }
    }
    const topScorers = [...scorerMap.values()]
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    // ── Build context string ────────────────────────────────────────────────
    const standingLines = (standingsRaw ?? []).map((s: {
      name: string; division: string; rank: number; wins: number; losses: number;
      games: number; pf: number; pa: number; diff: number; pts: number;
      techni?: number; penalty?: number
    }) =>
      `${s.rank}. ${s.name} (${s.division === 'North' ? 'צפון' : s.division === 'South' ? 'דרום' : s.division}) ` +
      `· ${s.wins}נ/${s.losses}ה מתוך ${s.games} · ${s.pts}נק' · סלים ${s.pf}:${s.pa} (${s.diff >= 0 ? '+' : ''}${s.diff})`
    ).join('\n');

    const scorerLines = topScorers.map((sc, i) =>
      `${i + 1}. ${sc.name} (${sc.teamName}) · ${sc.points} נק' ב-${sc.games} משחקים` +
      (sc.threes > 0 ? ` · ${sc.threes} שלושות` : '')
    ).join('\n');

    const gameResultLines = ((gameResultsRaw ?? []) as {
      round: number; date: string | null; home_team: string; away_team: string;
      home_score: number | null; away_score: number | null; techni: boolean | null;
    }[])
      .filter(g => g.home_score != null && g.away_score != null)
      .map(g =>
        `מחזור ${g.round} (${g.date ?? '?'}): ${g.home_team} ${g.home_score}–${g.away_score} ${g.away_team}` +
        (g.techni ? ' [טכני]' : '')
      ).join('\n');

    const cupLines = ((cupGamesRaw ?? []) as {
      round: string; home_team: string; away_team: string;
      home_score: number | null; away_score: number | null; played: boolean; date: string | null;
    }[]).map(g =>
      g.played
        ? `${g.round}: ${g.home_team} ${g.home_score ?? 0}–${g.away_score ?? 0} ${g.away_team}`
        : `${g.round}: ${g.home_team} מול ${g.away_team} (טרם שוחק${g.date ? ', ' + g.date : ''})`
    ).join('\n');

    const hofLines = (hofSeasonsRaw ?? []).map((h: {
      year: string; champion_name: string | null; runner_up_name: string | null;
      cup_holder_name: string | null; mvp_name: string | null; mvp_stats: string | null;
    }) =>
      `${h.year}: אלוף ${h.champion_name ?? '?'}, סגן ${h.runner_up_name ?? '?'}` +
      (h.cup_holder_name ? `, גביע ${h.cup_holder_name}` : '') +
      (h.mvp_name ? `, MVP ${h.mvp_name}${h.mvp_stats ? ' (' + h.mvp_stats + ')' : ''}` : '')
    ).join('\n');

    // ── Build the prompt ────────────────────────────────────────────────────
    const typeLabels: Record<string, string> = {
      pre_season: 'סקירת פתיחת עונה',
      mid_season: 'סקירת מחצית עונה',
      end_season: 'סיכום עונה',
      custom:     'סקירה חופשית',
    };
    const typeLabel = typeLabels[reviewType] ?? 'סקירה';

    const compLabel = (c?: string) => c === 'cup' ? 'גביע' : c === 'playoff' ? 'פלייאוף' : 'ליגה';
    const focusFacts = focus
      ? `${compLabel(focus.competition)} · ${focus.round}: ${focus.home_team} ${focus.home_score ?? '?'}–${focus.away_score ?? '?'} ${focus.away_team}${focus.date ? ` · ${focus.date}` : ''}`
      : '';

    const defaultTitle = focus
      ? `${focus.home_team} מול ${focus.away_team} — ${compLabel(focus.competition)}`
      : `${typeLabel} — עונת ${targetSeason}`;

    const toneInstructions: Record<string, string> = {
      pre_season:
        `זוהי סקירת פתיחת עונה לפני שהעונה ${targetSeason} התחילה. ` +
        `הנתונים הם מהעונה האחרונה (${dataSeason}). ` +
        `תן הצצה לאחור על העונה שהסתיימה, נתח מה למדנו, ותציג ציפיות ותחזיות לעונה הקרובה — מי הקבוצות לצפות להן, מה השתנה, ומה עתיד ליצור מתח.`,
      mid_season:
        `זוהי סקירת מחצית עונה ${targetSeason}. ` +
        `הליגה נמצאת בפסק. נתח את מה שקרה עד כה: מי הפתיעו, מי אכזבו, מה אומרת הטבלה, ומה צפוי בהמשך.`,
      end_season:
        `זוהי סקירת סיום העונה ${targetSeason}. ` +
        `חגוג את האלוף, נתח את עונת השיא והכישלון, הדגש את הנתונים הבולטים ואת מובילי הניקוד, וסיים עם מבט קדימה.`,
      custom:
        `זוהי סקירה עיתונאית על עונת ${targetSeason}.` +
        (customNotes ? ` הנחיות ספציפיות מהעורך: ${customNotes}` : ' כתוב סקירה מקיפה ומאוזנת.'),
    };
    // When the editor picked a specific game/event, the whole article is about
    // that single game — override the tone with a tightly-scoped instruction.
    const toneInstruction = focus
      ? `כתוב כתבת ניתוח עיתונאית הממוקדת אך ורק במשחק בודד אחד: ${focusFacts}. ` +
        (focusBoxScore
          ? `הוֹבֵל את הכתבה על בסיס גיליון הקלעים של המשחק (ראה "גיליון הקלעים" למטה) — פתח והדגש את הקלעים המובילים, התרומות המכריעות והשלשות, וצטט מספרים מהמשחק עצמו. רק לאחר מכן, ובמידת הצורך, הוסף הקשר קצר מנתוני העונה. `
          : `התבסס על תוצאת המשחק והקשר שתי הקבוצות בעונה. `) +
        `כל הכתבה חייבת לעסוק במשחק הספציפי הזה בלבד — התוצאה ומשמעותה, התרומות המרכזיות, וההשלכות לשתי הקבוצות. ` +
        `אל תכתוב סיכום עונה כללי ואל תסטה למשחקים אחרים אלא כרקע קצר בלבד. השתמש אך ורק במספרים האמיתיים מהנתונים למטה.` +
        (customNotes ? ` הנחיות נוספות מהעורך: ${customNotes}` : '')
      : (toneInstructions[reviewType] ?? toneInstructions.custom);

    const focusSection = focus
      ? `\n== המשחק לסקירה (התמקד בזה בלבד) ==\n${focusFacts}\n` +
        (focusBoxScore
          ? `\n== גיליון הקלעים של המשחק (הבסיס המרכזי לכתבה) ==\n${focusBoxScore}\n`
          : '')
      : '';

    const focusStructure = focusBoxScore
      ? `מבנה הכתבה (חובה):
1. **כותרת פנימית** (שורה אחת, ממוקדת במשחק הספציפי — ללא "כותרת:" לפניה, רק הטקסט)
2. **פסקת פתיחה** — מי נגד מי, באיזה שלב/מחזור, והתוצאה
3. **גיבורי המשחק** — בולטים עם \`-\` לקלעים המובילים מגיליון הקלעים: שם, קבוצה, נקודות (ושלשות אם רלוונטי)
4. **גוף הכתבה** — 2–3 פסקאות על מהלך המשחק כפי שמשתקף מהסטטיסטיקה, ההכרעה, וההקשר העונתי הקצר של שתי הקבוצות
5. **פסקת סיום** — מה המשחק אומר להמשך הדרך של שתי הקבוצות`
      : `מבנה הכתבה (חובה):
1. **כותרת פנימית** (שורה אחת, ממוקדת במשחק הספציפי — ללא "כותרת:" לפניה, רק הטקסט)
2. **פסקת פתיחה** — הצגת המשחק: מי נגד מי, באיזה שלב/מחזור, והתוצאה
3. **גוף הכתבה** — 2–3 פסקאות על המשחק עצמו: מה אמרה התוצאה, ההקשר העונתי של שתי הקבוצות (מקום בטבלה, מאזן), והמשמעות
4. **פסקת סיום** — מה המשחק הזה אומר להמשך הדרך של שתי הקבוצות`;

    const structure = focus
      ? focusStructure
      : `מבנה הכתבה (חובה):
1. **כותרת פנימית** (שורה אחת, עוצמתית ומשפיעה — ללא "כותרת:" לפניה, רק הטקסט)
2. **פסקת מבוא** — הצגת הנושא, ההקשר, ולמה זה חשוב
3. **חלק ראשי** — 2–3 פסקאות עם ניתוח מעמיק, מספרים קונקרטיים, ציטוט מספרי ניקוד ותוצאות רלוונטיות
4. **מובילי הניקוד** — בולטים עם \`-\` לכל שחקן: שם, קבוצה, נקודות
5. **פסקת סיום** — מסקנה, מה זה אומר לליגה/לעונה הבאה`;

    const prompt = `אתה עיתונאי ספורט ותיק המתמחה בכדורסל ישראלי. ` +
      `אתה כותב ${focus ? 'כתבת ניתוח על משחק בודד' : typeLabel} עבור ליגת כדורסל קהילתית — בסגנון מקצועי, חי, ומעמיק. ` +
      `השתמש בנתונים האמיתיים הבאים בלבד — אל תמציא שמות, מספרים או תוצאות.

${toneInstruction}
${focusSection}

== טבלת הליגה (עונת ${dataSeason}) ==
${standingLines || '(אין נתוני טבלה)'}

== מובילי ניקוד (עונת ${dataSeason}) ==
${scorerLines || '(אין נתוני ניקוד)'}

== תוצאות משחקים (עונת ${dataSeason}) ==
${gameResultLines || '(אין תוצאות)'}

== מסלול הגביע (עונת ${dataSeason}) ==
${cupLines || '(אין נתוני גביע)'}

== רקע היסטורי (עונות אחרונות) ==
${hofLines || '(אין נתוני היסטוריה)'}
${customNotes && reviewType !== 'custom' ? `\n== הנחיות ספציפיות מהעורך ==\n${customNotes}` : ''}

${structure}

הנחיות סגנון:
- עברית עיתונאית תקנית, טון ניתוחי — לא פרסומת
- **bold** למספרים ותוצאות מרכזיות
- אל תוסיף "בשורה התחתונה", "לסיכום", "לאחר בדיקה" — סיים אורגנית
- אורך: 300–500 מילים
- ענה רק בעברית, החזר את הכתבה בלבד (ללא הקדמה, ללא "הנה הכתבה שלך")`;

    // ── Call Gemini ─────────────────────────────────────────────────────────
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.75 },
      }),
    });

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      const msg = geminiData?.error?.message ?? JSON.stringify(geminiData);
      return NextResponse.json({ error: `Gemini: ${msg}` }, { status: 500 });
    }

    const parts: { thought?: boolean; text?: string }[] =
      geminiData?.candidates?.[0]?.content?.parts ?? [];
    const rawText = (parts.find(p => !p.thought && p.text) ?? parts[0])?.text?.trim() ?? '';
    if (!rawText) {
      return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 500 });
    }

    // Extract first line as title, rest as body.
    const lines = rawText.split('\n');
    const titleLine = lines[0].replace(/^\*\*|\*\*$/g, '').trim();
    const bodyText  = lines.slice(1).join('\n').trim();

    return NextResponse.json({
      title: titleLine || defaultTitle,
      text:  bodyText  || rawText,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה';
    console.error('[season-reviews/generate]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** "2025-2026" → "2024-2025" */
function derivePreviousSeason(season: string): string {
  const [s, e] = season.split('-').map(Number);
  if (!s || !e) return season;
  return `${s - 1}-${e - 1}`;
}
