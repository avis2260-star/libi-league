import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';
import {
  readStatsWorkbook,
  matchStatLines,
  orientSummaryQuarters,
  type RosterPlayer,
} from '@/lib/stats-import';
import { cupTeamIds } from '../team-ids';

// Upload a cup game's box score as Excel — the official referee scoresheet
// (its "סיכום" sheet) or the template from ./template. Each line is matched to
// a player of the game's two teams and the game's cup_game_stats are REPLACED.
// Like the playoff import, players' regular-season totals are not touched (the
// cup is a separate competition).
//
// The scoresheet's quarter line fills the game's quarters. The final score is
// filled from the players' points only when the game has no official score
// yet — an entered score is never overwritten; the reply says whether the
// points agree with it.

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const cupGameId = formData.get('cupGameId') as string | null;
    if (!file || !cupGameId) {
      return NextResponse.json({ error: 'קובץ ומזהה משחק חובה' }, { status: 400 });
    }

    // ── Parse the workbook ──────────────────────────────────────────────────
    const XLSX = await import('xlsx');
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    if (wb.SheetNames.length === 0) return NextResponse.json({ error: 'הקובץ ריק' }, { status: 400 });
    const { lines, summaryRows } = readStatsWorkbook(wb.SheetNames, (name) =>
      wb.Sheets[name] ? XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1 }) : null,
    );
    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'לא נמצאו שורות סטטיסטיקה. העלה את טופס השיפוט (גליון "סיכום") או תבנית עם כותרות: שם, נקודות, שלשות, עבירות.' },
        { status: 400 },
      );
    }

    // ── The cup game and its two teams' rosters ─────────────────────────────
    const [{ data: game, error: gErr }, { data: teams }] = await Promise.all([
      supabaseAdmin
        .from('cup_games')
        .select('id, home_team, away_team, home_score, away_score, played, season')
        .eq('id', cupGameId)
        .maybeSingle(),
      supabaseAdmin.from('teams').select('id, name'),
    ]);
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
    if (!game) return NextResponse.json({ error: 'משחק לא נמצא' }, { status: 404 });

    const { homeId, awayId } = cupTeamIds((teams ?? []) as { id: string; name: string }[], game.home_team, game.away_team);
    const teamIds = [homeId, awayId].filter((x): x is string => !!x);
    if (teamIds.length === 0) {
      return NextResponse.json({ error: 'קבוצות המשחק לא זוהו בטבלת הקבוצות — לא בוצע שינוי.' }, { status: 400 });
    }
    const { data: rosterRows, error: rErr } = await supabaseAdmin
      .from('players')
      .select('id, team_id, name, jersey_number')
      .in('team_id', teamIds);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    const roster = (rosterRows ?? []).filter((r) => r.team_id) as RosterPlayer[];

    const { matched, unmatched } = matchStatLines(lines, roster);
    // Never wipe the game's stats for a file that matches nobody (wrong file).
    if (matched.length === 0) {
      return NextResponse.json(
        { error: 'לא זוהה אף שחקן מהקובץ. בדוק שהשמות תואמים לסגלי הקבוצות — לא בוצע שינוי.', unmatched },
        { status: 422 },
      );
    }

    // ── Replace the game's box score ────────────────────────────────────────
    const season = (game.season as string | null) ?? (await getCurrentSeason());
    const { error: delErr } = await supabaseAdmin.from('cup_game_stats').delete().eq('cup_game_id', cupGameId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const rows = matched.map(({ player, line }) => ({
      cup_game_id:    cupGameId,
      player_id:      player.id,
      team_id:        player.team_id,
      season,
      points:         line.points,
      three_pointers: line.three_pointers,
      fouls:          line.fouls,
      quarter_points: line.quarter_points,
      two_pointers:   line.two_pointers,
      free_throws:    line.free_throws,
    }));
    const { error: insErr } = await supabaseAdmin
      .from('cup_game_stats')
      .upsert(rows, { onConflict: 'cup_game_id,player_id' });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // ── Quarters (scoresheet) + score (only when none was entered) ──────────
    const gameUpdate: Record<string, unknown> = {};
    const quarters = summaryRows ? orientSummaryQuarters(summaryRows, game.home_team, game.away_team) : null;
    if (quarters) {
      gameUpdate.home_quarters = quarters.home;
      gameUpdate.away_quarters = quarters.away;
    }

    let homePts = 0, awayPts = 0, homeCount = 0, awayCount = 0;
    for (const { player, line } of matched) {
      if (player.team_id === homeId) { homePts += line.points; homeCount++; }
      else if (player.team_id === awayId) { awayPts += line.points; awayCount++; }
    }
    const hasOfficial = game.home_score != null && game.away_score != null;
    let scoreNote = '';
    if (!hasOfficial && homeCount > 0 && awayCount > 0) {
      gameUpdate.home_score = homePts;
      gameUpdate.away_score = awayPts;
      gameUpdate.played = true;
    } else if (hasOfficial && homeCount > 0 && awayCount > 0) {
      scoreNote = homePts === game.home_score && awayPts === game.away_score
        ? ' · סכום הנקודות תואם לתוצאה הרשמית'
        : ` · שים לב: סכום הנקודות ${homePts}–${awayPts} לא תואם לתוצאה הרשמית ${game.home_score}–${game.away_score} (התוצאה לא שונתה)`;
    }

    let updatedGame: Record<string, unknown> | null = null;
    if (Object.keys(gameUpdate).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('cup_games')
        .update(gameUpdate)
        .eq('id', cupGameId)
        .select('*')
        .maybeSingle();
      if (error) console.error('[cup-stats/import] game update failed:', error);
      else updatedGame = data;
    }
    if (updatedGame && 'home_score' in gameUpdate) scoreNote = ` · תוצאה עודכנה: ${homePts}–${awayPts}`;

    revalidatePath('/admin');
    revalidatePath('/cup');
    revalidatePath('/cup/stats');
    revalidatePath(`/cup/game/${cupGameId}`);
    revalidatePath('/');

    return NextResponse.json({
      success: true,
      matched: matched.length,
      unmatched,
      // What the admin's stats panel shows, so it can repaint without a reload.
      stats: rows.map((r) => ({
        cup_game_id: r.cup_game_id, player_id: r.player_id,
        points: r.points, three_pointers: r.three_pointers, fouls: r.fouls,
      })),
      game: updatedGame,
      message: `✅ נשמרו ${matched.length} שחקנים${unmatched.length ? ` · ${unmatched.length} לא זוהו` : ''}${quarters && updatedGame ? ' · ניקוד רבעים עודכן' : ''}${scoreNote}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה בעיבוד הקובץ';
    console.error('cup-stats/import error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
