import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';
import { parseGameStatsSheet } from '@/lib/excel-sync-parsers';
import { normalizeName } from '@/lib/match-player';

// Upload a per-game player box score as an Excel file. The sheet is parsed,
// each line is matched to a player on one of the game's two teams, and the
// game_stats rows are REPLACED for that game. Player season totals are then
// recalculated from game_stats — the same source the public site reads (player
// profiles, scorers leaderboard, box scores), so the upload shows up there.

type RosterPlayer = { id: string; team_id: string; name: string; jersey_number: number | null };

/**
 * Match one parsed line to a player drawn from the game's two rosters only.
 * Deliberately tighter than match-player.ts's OCR matcher (no global fallback):
 * exact-normalized name → unique jersey → unique-ish substring.
 */
function matchPlayer(name: string, jersey: number | null, roster: RosterPlayer[]): RosterPlayer | null {
  const target = normalizeName(name);
  if (!target) return null;

  // 1. Exact normalized name.
  const exact = roster.find((r) => normalizeName(r.name) === target);
  if (exact) return exact;

  // 2. Jersey number — only when it identifies exactly one player in the pool.
  if (jersey !== null) {
    const byJersey = roster.filter((r) => r.jersey_number === jersey);
    if (byJersey.length === 1) return byJersey[0];
  }

  // 3. Substring (handles first-name-only or last-name-only on the sheet).
  const sub = roster.find((r) => {
    const n = normalizeName(r.name);
    return n.length > 1 && (n.includes(target) || target.includes(n));
  });
  return sub ?? null;
}

/**
 * Recalculate a player's cached season totals from game_stats (current season).
 * Mirrors recalcPlayerTotals() in src/app/admin/actions.ts — kept local so this
 * route has no dependency on the server-action module.
 */
async function recalcPlayerTotals(season: string, playerIds: string[]): Promise<void> {
  for (const playerId of playerIds) {
    const { data: rows, error } = await supabaseAdmin
      .from('game_stats')
      .select('points, three_pointers, fouls')
      .eq('season', season)
      .eq('player_id', playerId);
    if (error) {
      console.error('[game-stats/import] recalc select failed:', error);
      continue;
    }
    const totals = {
      points:         (rows ?? []).reduce((n, r) => n + (r.points         ?? 0), 0),
      three_pointers: (rows ?? []).reduce((n, r) => n + (r.three_pointers ?? 0), 0),
      fouls:          (rows ?? []).reduce((n, r) => n + (r.fouls          ?? 0), 0),
    };
    const { error: updErr } = await supabaseAdmin.from('players').update(totals).eq('id', playerId);
    if (updErr) console.error('[game-stats/import] recalc update failed:', playerId, updErr);
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const gameId = formData.get('gameId') as string | null;
    if (!file || !gameId) {
      return NextResponse.json({ error: 'קובץ ומזהה משחק חובה' }, { status: 400 });
    }

    // ── Parse the workbook (first sheet) ────────────────────────────────────
    const XLSX = await import('xlsx');
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return NextResponse.json({ error: 'הקובץ ריק' }, { status: 400 });

    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    const parsed = parseGameStatsSheet(rows);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: 'לא נמצאו שורות סטטיסטיקה. ודא שיש כותרות: שם, נקודות, שלשות, עבירות.' },
        { status: 400 },
      );
    }

    // ── Resolve the game and its two team rosters ───────────────────────────
    const { data: game, error: gErr } = await supabaseAdmin
      .from('games')
      .select('id, home_team_id, away_team_id')
      .eq('id', gameId)
      .maybeSingle();
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
    if (!game) return NextResponse.json({ error: 'משחק לא נמצא' }, { status: 404 });

    const teamIds = [game.home_team_id, game.away_team_id].filter(Boolean) as string[];
    if (teamIds.length === 0) {
      return NextResponse.json({ error: 'למשחק אין קבוצות משויכות' }, { status: 400 });
    }

    const { data: rosterRows, error: rErr } = await supabaseAdmin
      .from('players')
      .select('id, team_id, name, jersey_number')
      .in('team_id', teamIds);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    const roster = (rosterRows ?? []).filter((r) => r.team_id) as RosterPlayer[];

    // ── Match each parsed line to a player (each player used at most once) ───
    const matched: { player: RosterPlayer; points: number; three_pointers: number; fouls: number }[] = [];
    const unmatched: string[] = [];
    const usedIds = new Set<string>();
    for (const r of parsed) {
      const pool = roster.filter((p) => !usedIds.has(p.id));
      const player = matchPlayer(r.name, r.jersey, pool);
      if (!player) { unmatched.push(r.name); continue; }
      usedIds.add(player.id);
      matched.push({ player, points: r.points, three_pointers: r.three_pointers, fouls: r.fouls });
    }

    // Guard: never wipe existing stats when nothing matched (e.g. wrong file).
    if (matched.length === 0) {
      return NextResponse.json(
        { error: 'לא זוהה אף שחקן מהקובץ. בדוק שהשמות תואמים לסגלי הקבוצות — לא בוצע שינוי.', unmatched },
        { status: 422 },
      );
    }

    // ── Replace this game's box score, then recalc affected players ─────────
    const season = await getCurrentSeason();

    // Players already on this game keep getting recalculated even if dropped
    // from the new file, so their season totals fall correctly.
    const { data: prevRows } = await supabaseAdmin
      .from('game_stats')
      .select('player_id')
      .eq('season', season)
      .eq('game_id', gameId);
    const affected = new Set<string>((prevRows ?? []).map((r) => r.player_id));

    const { error: delErr } = await supabaseAdmin
      .from('game_stats')
      .delete()
      .eq('season', season)
      .eq('game_id', gameId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const insertRows = matched.map((m) => ({
      game_id:        gameId,
      player_id:      m.player.id,
      team_id:        m.player.team_id,
      points:         m.points,
      three_pointers: m.three_pointers,
      fouls:          m.fouls,
      season,
    }));
    const { error: insErr } = await supabaseAdmin
      .from('game_stats')
      .upsert(insertRows, { onConflict: 'game_id,player_id' });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    for (const m of matched) affected.add(m.player.id);
    await recalcPlayerTotals(season, [...affected]);

    // Refresh every public surface that reads game_stats / player totals.
    revalidatePath('/admin');
    revalidatePath('/players');
    revalidatePath('/scorers');
    revalidatePath('/results');
    revalidatePath('/');

    return NextResponse.json({
      success: true,
      matched: matched.length,
      unmatched,
      message: `✅ נשמרו ${matched.length} שחקנים${unmatched.length ? ` · ${unmatched.length} לא זוהו` : ''}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה בעיבוד הקובץ';
    console.error('game-stats/import error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
