import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';
import {
  parseSummarySheet,
  parseSummaryTeamQuarters,
  parseGameStatsSheet,
  normalizeTeamName,
} from '@/lib/excel-sync-parsers';
import { normalizeName } from '@/lib/match-player';

// Upload a per-game playoff box score (Excel). Mirrors the regular-season
// /api/admin/game-stats/import, but the game is identified by (series_number,
// game_number), rows are written to playoff_game_stats, and — by design — the
// players' cumulative SEASON totals are NOT touched (cup/playoff are separate
// competitions from the regular-season leaderboard).

type RosterPlayer = { id: string; team_id: string; name: string; jersey_number: number | null };

function matchPlayer(name: string, jersey: number | null, roster: RosterPlayer[]): RosterPlayer | null {
  const target = normalizeName(name);
  if (!target) return null;
  const exact = roster.find((r) => normalizeName(r.name) === target);
  if (exact) return exact;
  if (jersey !== null) {
    const byJersey = roster.filter((r) => r.jersey_number === jersey);
    if (byJersey.length === 1) return byJersey[0];
  }
  const sub = roster.find((r) => {
    const n = normalizeName(r.name);
    return n.length > 1 && (n.includes(target) || target.includes(n));
  });
  return sub ?? null;
}

/** Resolve an Excel/series team-name string to a DB team id (exact then fuzzy). */
function resolveTeamId(name: string, teams: { id: string; name: string }[]): string | null {
  const target = normalizeTeamName(name);
  if (!target) return null;
  const exact = teams.find((t) => normalizeTeamName(t.name) === target);
  if (exact) return exact.id;
  const sub = teams.find((t) => {
    const n = normalizeTeamName(t.name);
    return n.length > 1 && (n.includes(target) || target.includes(n));
  });
  return sub?.id ?? null;
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const seriesNumber = Number(formData.get('seriesNumber'));
    const gameNumber = Number(formData.get('gameNumber'));
    if (!file || !seriesNumber || !gameNumber) {
      return NextResponse.json({ error: 'קובץ, מספר סדרה ומספר משחק חובה' }, { status: 400 });
    }

    const season = await getCurrentSeason();

    // ── Resolve the series and its two teams ────────────────────────────────
    const { data: series, error: sErr } = await supabaseAdmin
      .from('playoff_series')
      .select('team_a, team_b')
      .eq('season', season)
      .eq('series_number', seriesNumber)
      .maybeSingle();
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!series?.team_a || !series?.team_b) {
      return NextResponse.json({ error: 'הקבוצות בסדרה טרם נקבעו' }, { status: 400 });
    }

    const { data: teamsData } = await supabaseAdmin.from('teams').select('id, name');
    const teams = (teamsData ?? []) as { id: string; name: string }[];
    const teamAId = resolveTeamId(series.team_a, teams);
    const teamBId = resolveTeamId(series.team_b, teams);
    const teamIds = [teamAId, teamBId].filter(Boolean) as string[];
    if (teamIds.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו קבוצות תואמות לסדרה' }, { status: 400 });
    }

    const { data: rosterRows, error: rErr } = await supabaseAdmin
      .from('players')
      .select('id, team_id, name, jersey_number')
      .in('team_id', teamIds);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    const roster = (rosterRows ?? []).filter((r) => r.team_id) as RosterPlayer[];

    // ── Parse the workbook (prefer the official "סיכום" sheet) ───────────────
    const XLSX = await import('xlsx');
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    if (wb.SheetNames.length === 0) return NextResponse.json({ error: 'הקובץ ריק' }, { status: 400 });

    let parsed = [] as ReturnType<typeof parseSummarySheet>;
    let summaryRows: unknown[][] | null = null;
    const summaryName = wb.SheetNames.find((n) => n.replace(/\s/g, '').includes('סיכום'));
    if (summaryName && wb.Sheets[summaryName]) {
      summaryRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[summaryName], { header: 1 });
      parsed = parseSummarySheet(summaryRows);
    }
    if (parsed.length === 0) {
      summaryRows = null;
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (ws) parsed = parseGameStatsSheet(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }));
    }
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: 'לא נמצאו שורות סטטיסטיקה. העלה את טופס השיפוט (גליון "סיכום") או תבנית עם כותרות: שם, נקודות, שלשות, עבירות.' },
        { status: 400 },
      );
    }

    // ── Match each parsed line to a player on one of the series' two teams ───
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
    if (matched.length === 0) {
      return NextResponse.json(
        { error: 'לא זוהה אף שחקן מהקובץ. בדוק שהשמות תואמים לסגלי הקבוצות בסדרה — לא בוצע שינוי.', unmatched },
        { status: 422 },
      );
    }

    // ── Replace this game's playoff box score (does NOT touch season totals) ─
    const { error: delErr } = await supabaseAdmin
      .from('playoff_game_stats')
      .delete()
      .eq('season', season)
      .eq('series_number', seriesNumber)
      .eq('game_number', gameNumber);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const insertRows = matched.map((m) => ({
      season,
      series_number:  seriesNumber,
      game_number:    gameNumber,
      player_id:      m.player.id,
      team_id:        m.player.team_id,
      points:         m.points,
      three_pointers: m.three_pointers,
      fouls:          m.fouls,
    }));
    const { error: insErr } = await supabaseAdmin
      .from('playoff_game_stats')
      .upsert(insertRows, { onConflict: 'season,series_number,game_number,player_id' });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // ── Quarter line score (official "סיכום" sheet only) ────────────────────
    // Orient the summary's two team sections to this game's home/away (game 2
    // swaps home/away, mirroring /playoff). Best-effort; only updates an
    // existing playoff_games row.
    let quartersSaved = false;
    if (summaryRows) {
      try {
        const sections = parseSummaryTeamQuarters(summaryRows);
        if (sections.length > 0) {
          const homeName = gameNumber === 2 ? series.team_b : series.team_a;
          const awayName = gameNumber === 2 ? series.team_a : series.team_b;
          const homeNorm = normalizeTeamName(homeName);
          const awayNorm = normalizeTeamName(awayName);
          const matches = (secName: string, side: string) => {
            const t = normalizeTeamName(secName);
            return !!side && t.length > 0 && (t === side || t.includes(side) || side.includes(t));
          };
          let homeSec = sections.find((s) => matches(s.teamName, homeNorm));
          let awaySec = sections.find((s) => s !== homeSec && matches(s.teamName, awayNorm));
          if (!homeSec) homeSec = sections.find((s) => s !== awaySec && s.isHome) ?? sections.find((s) => s !== awaySec);
          if (!awaySec) awaySec = sections.find((s) => s !== homeSec && !s.isHome) ?? sections.find((s) => s !== homeSec);

          if (homeSec && awaySec && homeSec !== awaySec) {
            let len = Math.max(4, homeSec.quarters.length, awaySec.quarters.length);
            const pad = (q: number[]) => Array.from({ length: len }, (_, i) => Math.max(0, Math.floor(q[i] ?? 0)));
            const h = pad(homeSec.quarters);
            const a = pad(awaySec.quarters);
            while (len > 4 && h[len - 1] === 0 && a[len - 1] === 0) { h.pop(); a.pop(); len--; }
            const { error: qErr } = await supabaseAdmin
              .from('playoff_games')
              .update({ home_quarters: h, away_quarters: a })
              .eq('season', season)
              .eq('series_number', seriesNumber)
              .eq('game_number', gameNumber);
            if (qErr) console.error('[playoff-stats/import] quarter update failed:', qErr);
            else quartersSaved = true;
          }
        }
      } catch (e) {
        console.error('[playoff-stats/import] quarter import failed:', e);
      }
    }

    revalidatePath('/admin');
    revalidatePath('/playoff');
    revalidatePath(`/playoff/series/${seriesNumber}`);
    revalidatePath('/playoff/stats');

    return NextResponse.json({
      success: true,
      matched: matched.length,
      unmatched,
      message: `✅ נשמרו ${matched.length} שחקנים${unmatched.length ? ` · ${unmatched.length} לא זוהו` : ''}${quartersSaved ? ' · ניקוד רבעים עודכן' : ''}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'שגיאה בעיבוד הקובץ';
    console.error('playoff-stats/import error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
