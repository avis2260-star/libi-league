import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';
import { getSeasonSchedule } from '@/lib/season-schedule';
import { normalizeTeamName } from '@/lib/excel-sync-parsers';
import { buildScheduleWorkbook, type GameResult } from '@/lib/schedule-export';

type JoinedTeam = { name: string } | { name: string }[] | null;

function teamName(t: JoinedTeam): string {
  if (Array.isArray(t)) return t[0]?.name ?? '';
  return t?.name ?? '';
}

const keyOf = (home: string, away: string, date: string) =>
  `${normalizeTeamName(home)}|${normalizeTeamName(away)}|${date}`;

// GET ?season=YYYY-YYYY (defaults to the current season) — the season's
// schedule as an .xlsx: round dates for both divisions, every fixture, and one
// sheet per division. Built from the same schedule the public לוח משחקים shows.
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const requested = req.nextUrl.searchParams.get('season')?.trim() ?? '';
    const season = /^\d{4}-\d{4}$/.test(requested) ? requested : await getCurrentSeason();

    const schedule = await getSeasonSchedule(season);
    if (schedule.length === 0) {
      return NextResponse.json({ error: `אין לוח משחקים לעונת ${season}` }, { status: 404 });
    }

    // Scores of games already played, matched by teams + date (best-effort —
    // the export is still useful as a pure schedule without them).
    const results = new Map<string, GameResult>();
    try {
      const { data } = await supabaseAdmin
        .from('games')
        .select(
          'game_date, status, home_score, away_score,' +
            ' home_team:teams!games_home_team_id_fkey(name),' +
            ' away_team:teams!games_away_team_id_fkey(name)',
        )
        .eq('season', season);
      type Row = GameResult & { game_date: string; home_team: JoinedTeam; away_team: JoinedTeam };
      for (const g of (data ?? []) as unknown as Row[]) {
        results.set(keyOf(teamName(g.home_team), teamName(g.away_team), g.game_date), g);
      }
    } catch { /* no results column — export the schedule alone */ }

    const buf = buildScheduleWorkbook(schedule, (e) => results.get(keyOf(e.homeTeam, e.awayTeam, e.date)));

    const hebrewName = encodeURIComponent(`לוח משחקים ${season}.xlsx`);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="libi-schedule-${season}.xlsx"; filename*=UTF-8''${hebrewName}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'הייצוא נכשל';
    console.error('export-schedule error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
