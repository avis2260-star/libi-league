import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';
import {
  normalizeTeamName,
  resolveTeamId,
  toIsoDate,
  parseStandings,
  parseRoundDates,
  parseResults,
  parseCupGames,
  type StandingRow,
  type GameResultRow,
  type CupGameRow,
} from '@/lib/excel-sync-parsers';

export async function POST(req: NextRequest) {
  try {
    // Read multipart file
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = await file.arrayBuffer();

    // Parse Excel server-side
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'array' });

    // Parse standings
    const standingsSheet = wb.SheetNames.find((n) => n.includes('טבלאות')) ?? wb.SheetNames[0];
    const standingsRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[standingsSheet], { header: 1 });
    const { north, south } = parseStandings(standingsRows);

    // Parse results
    const resultsSheet = wb.SheetNames.find((n) => n.includes('תוצאות'));
    let results: GameResultRow[] = [];
    let roundDatesMap: Record<number, string> = {};
    if (resultsSheet) {
      const resultsRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[resultsSheet], { header: 1 });
      results = parseResults(resultsRows);
      // Extract ALL round dates (including future rounds with no scores yet)
      roundDatesMap = parseRoundDates(resultsRows);
    }
    try {
      if (Object.keys(roundDatesMap).length > 0) {
        await supabaseAdmin.from('league_settings').upsert(
          { key: 'round_dates', value: JSON.stringify(roundDatesMap) },
          { onConflict: 'key' },
        );
      }
    } catch { /* silently skip if table differs */ }

    // Parse cup games (safely — never break main sync)
    let cupGames: CupGameRow[] = [];
    try {
      const cupSheet = wb.SheetNames.find((n) => n.includes('גביע') || n.includes('טורניר'));
      if (cupSheet) {
        const cupRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[cupSheet], { header: 1 });
        cupGames = parseCupGames(cupRows ?? []);
      }
    } catch { /* cup sheet parsing failed — skip silently */ }

    if (north.length === 0 && south.length === 0 && results.length === 0) {
      return NextResponse.json({ error: 'No data found in Excel file' }, { status: 400 });
    }

    const season = await getCurrentSeason();

    // Snapshot existing data before replacing (current-season only — we never
    // touch prior-season rows).
    const [{ data: prevStandings }, { data: prevResults }] = await Promise.all([
      supabaseAdmin.from('standings').select('*').eq('season', season),
      supabaseAdmin.from('game_results').select('*').eq('season', season),
    ]);

    // Cup snapshots for rollback — best-effort so a missing table/column never
    // breaks the sync. Captures the bracket, per-player stats and previews
    // BEFORE this sync runs.
    const snapshotCup = async (table: string): Promise<unknown[]> => {
      try {
        const { data } = await supabaseAdmin.from(table).select('*').eq('season', season);
        return data ?? [];
      } catch { return []; }
    };
    const prevCupGames    = await snapshotCup('cup_games');
    const prevCupStats    = await snapshotCup('cup_game_stats');
    const prevCupPreviews = await snapshotCup('match_previews');

    // ── Replace standings for the current season ──
    const standingRows = [
      ...north.map((r) => ({ ...r, division: 'North', season })),
      ...south.map((r) => ({ ...r, division: 'South', season })),
    ];

    if (standingRows.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from('standings')
        .delete()
        .eq('season', season);
      if (delErr) throw delErr;

      const { error: insErr } = await supabaseAdmin
        .from('standings')
        .insert(standingRows);
      if (insErr) throw insErr;
    }

    // ── Replace game results for the current season ──
    let resultsCount = 0;
    {
      const { error: delErr } = await supabaseAdmin
        .from('game_results')
        .delete()
        .eq('season', season);
      if (delErr) throw delErr;
    }
    if (results.length > 0) {
      const stamped = results.map((r) => ({ ...r, season }));
      const { error: insErr } = await supabaseAdmin
        .from('game_results')
        .insert(stamped);
      if (insErr) throw insErr;
      resultsCount = results.length;
    }

    // ── Auto-upsert games table from results ───────────────────────────
    // The `games` table holds the schedule (used by /submit, scoreboard,
    // upcoming games, etc.). Admins don't always pre-schedule rounds — but
    // if a result was synced for a date, the game should exist as a
    // 'Finished' record so users can submit stats for it.
    let gamesCreated = 0;
    let gamesUpdated = 0;
    let gamesDeleted = 0;
    try {
      const { data: teamsList } = await supabaseAdmin
        .from('teams')
        .select('id, name');

      if (teamsList && teamsList.length > 0 && results.length > 0) {
        // Build name → id map (normalized)
        const teamMap = new Map<string, string>();
        for (const t of teamsList) teamMap.set(normalizeTeamName(t.name), t.id);

        // Load existing games for the current season — INCLUDE game_time + location so we can
        // preserve admin-filled values when migrating a rescheduled row.
        const { data: existingGames } = await supabaseAdmin
          .from('games')
          .select('id, home_team_id, away_team_id, game_date, game_time, location, status, home_score, away_score')
          .eq('season', season);

        type ExistingGame = {
          id: string; date: string; status: string;
          home_score: number; away_score: number;
          game_time: string; location: string;
        };
        const existingByKey = new Map<string, ExistingGame>();
        // Group by team-pair so we can detect stale duplicates from a
        // rescheduled fixture (same matchup, old date, still 'Scheduled').
        const existingByPair = new Map<string, ExistingGame[]>();
        for (const g of existingGames ?? []) {
          const row: ExistingGame = {
            id: g.id, date: g.game_date, status: g.status,
            home_score: g.home_score, away_score: g.away_score,
            game_time: g.game_time ?? '00:00:00',
            location: g.location ?? 'TBD',
          };
          existingByKey.set(`${g.home_team_id}|${g.away_team_id}|${g.game_date}`, row);
          const pairKey = `${g.home_team_id}|${g.away_team_id}`;
          if (!existingByPair.has(pairKey)) existingByPair.set(pairKey, []);
          existingByPair.get(pairKey)!.push(row);
        }

        const toInsert: {
          home_team_id: string; away_team_id: string;
          game_date: string; game_time: string; location: string;
          home_score: number; away_score: number; status: string;
          season: string;
        }[] = [];
        const toUpdate: { id: string; home_score: number; away_score: number; status: string }[] = [];
        // For stale rescheduled rows we MIGRATE (update date) instead of
        // delete-then-insert so admin-filled time/location aren't lost.
        const toMigrate: {
          id: string; new_date: string;
          home_score: number; away_score: number;
        }[] = [];

        for (const r of results) {
          const homeId = resolveTeamId(r.home_team, teamMap);
          const awayId = resolveTeamId(r.away_team, teamMap);
          const isoDate = toIsoDate(r.date);
          if (!homeId || !awayId || !isoDate) continue;

          const key = `${homeId}|${awayId}|${isoDate}`;
          const existing = existingByKey.get(key);
          const pairKey = `${homeId}|${awayId}`;
          const allForPair = existingByPair.get(pairKey) ?? [];

          if (existing) {
            // Exact-date match: update scores + status if changed
            if (
              existing.status !== 'Finished' ||
              existing.home_score !== r.home_score ||
              existing.away_score !== r.away_score
            ) {
              toUpdate.push({
                id: existing.id,
                home_score: r.home_score,
                away_score: r.away_score,
                status: 'Finished',
              });
            }
            continue;
          }

          // No exact-date match. Look for a stale 'Scheduled' row on a
          // different date — that's a rescheduled fixture from when the
          // schedule sheet had a different date. Migrate it (preserve
          // admin-filled time/location) instead of inserting fresh.
          const staleScheduled = allForPair.find(
            (c) => c.date !== isoDate && c.status !== 'Finished',
          );
          if (staleScheduled) {
            toMigrate.push({
              id: staleScheduled.id,
              new_date: isoDate,
              home_score: r.home_score,
              away_score: r.away_score,
            });
            // Mark as consumed so a second result for the same pair doesn't
            // also try to migrate it.
            staleScheduled.status = 'Finished';
          } else {
            toInsert.push({
              home_team_id: homeId, away_team_id: awayId,
              game_date: isoDate, game_time: '19:00:00', location: 'TBD',
              home_score: r.home_score, away_score: r.away_score,
              status: 'Finished',
              season,
            });
          }
        }

        if (toInsert.length > 0) {
          const { error: insErr } = await supabaseAdmin.from('games').insert(toInsert);
          if (!insErr) gamesCreated = toInsert.length;
        }
        for (const u of toUpdate) {
          const { error: updErr } = await supabaseAdmin
            .from('games')
            .update({ home_score: u.home_score, away_score: u.away_score, status: u.status })
            .eq('id', u.id);
          if (!updErr) gamesUpdated++;
        }
        // Migrate rescheduled rows: update date + score + status, KEEP the
        // existing game_time and location (admin may have filled them in).
        for (const m of toMigrate) {
          const { error: migErr } = await supabaseAdmin
            .from('games')
            .update({
              game_date: m.new_date,
              home_score: m.home_score,
              away_score: m.away_score,
              status: 'Finished',
            })
            .eq('id', m.id);
          if (!migErr) gamesDeleted++; // reusing the counter for "moved" rows
        }
      }
    } catch (e) {
      console.error('auto-upsert games failed:', e);
      // Don't fail the whole sync — auto-create is a nice-to-have
    }

    // ── Cup games: NON-destructive sync ───────────────────────────────────
    // The cup bracket is managed in the admin (scores, per-player stats,
    // quarters, video, location, match previews). This used to delete every
    // cup_games row for the season and reinsert from the Excel — which wiped
    // all of that (and cascade-deleted cup_game_stats / match_previews via
    // their ON DELETE CASCADE foreign keys). Now we ONLY insert matchups that
    // don't already exist (matched by the unordered team pair — a cup is
    // single-elimination, so each pair meets at most once). Existing rows are
    // left untouched, so nothing the admin entered is ever erased.
    let cupInserted = 0;
    try {
      if (cupGames.length > 0) {
        const { data: existingCup } = await supabaseAdmin
          .from('cup_games')
          .select('home_team, away_team, round')
          .eq('season', season);

        const pairKey = (a: string, b: string) =>
          [normalizeTeamName(a), normalizeTeamName(b)].sort().join('|');
        const existingPairs = new Set(
          (existingCup ?? []).map((g) => pairKey(g.home_team as string, g.away_team as string)),
        );
        // A cup is single-elimination: exactly ONE final ('גמר'). If a final
        // already exists, never auto-insert another from the Excel sheet — a
        // duplicate/incomplete final row would hide the real cup champion on
        // the home-page hero card.
        const hasFinal = (existingCup ?? []).some((g) => g.round === 'גמר');

        const newCup = cupGames
          .filter((g) => !existingPairs.has(pairKey(g.home_team, g.away_team)))
          .filter((g) => !(g.round === 'גמר' && hasFinal))
          .map((g) => ({ ...g, season }));

        if (newCup.length > 0) {
          const { error: cupErr } = await supabaseAdmin.from('cup_games').insert(newCup);
          if (!cupErr) cupInserted = newCup.length;
        }
      }
    } catch { /* cup_games table not created yet — run SQL in Supabase */ }

    // Insert sync log (silently skip if table doesn't exist yet). The cup
    // snapshots are attached in a SEPARATE best-effort update so that, before
    // the 20260530 migration adds those columns, the base log still records.
    try {
      const { data: logRow } = await supabaseAdmin.from('sync_logs').insert({
        filename: file.name,
        north_count: north.length,
        south_count: south.length,
        results_count: resultsCount,
        snapshot_standings: prevStandings ?? [],
        snapshot_results: prevResults ?? [],
        season,
      }).select('id').single();

      if (logRow?.id) {
        try {
          await supabaseAdmin.from('sync_logs').update({
            snapshot_cup_games:    prevCupGames,
            snapshot_cup_stats:    prevCupStats,
            snapshot_cup_previews: prevCupPreviews,
          }).eq('id', logRow.id);
        } catch { /* cup snapshot columns not added yet — base log still saved */ }
      }
    } catch { /* sync_logs table not created yet — run SQL in Supabase */ }

    const parts = [];
    if (north.length > 0) parts.push(`${north.length} קבוצות צפון`);
    if (south.length > 0) parts.push(`${south.length} קבוצות דרום`);
    if (resultsCount > 0) parts.push(`${resultsCount} תוצאות משחקים`);
    if (cupInserted > 0) parts.push(`${cupInserted} משחקי גביע חדשים`);
    if (gamesCreated > 0) parts.push(`${gamesCreated} משחקים נוצרו אוטומטית`);
    if (gamesUpdated > 0) parts.push(`${gamesUpdated} משחקים עודכנו`);
    if (gamesDeleted > 0) parts.push(`${gamesDeleted} משחקים שמוקמו מחדש (שעה+מיקום נשמרו)`);

    return NextResponse.json({
      success: true,
      message: `✅ עודכנו: ${parts.join(' + ')}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    console.error('sync-excel-file error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
