import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/* ── Team-name normalization for fuzzy matching across tables ──────────── */
function normalizeTeamName(s: string): string {
  return s
    .replace(/["“”„‟״'`]/g, '')   // strip all quote/apostrophe variants
    .replace(/[‘’]/g, '')         // smart apostrophes
    .replace(/-/g, ' ')           // hyphens to spaces
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/* Aliases — Excel results may use a shortened form vs the teams table */
const TEAM_ALIASES: Record<string, string> = {
  'אריות ק גת':      'אריות קריית גת',
  'אס ק גת':         'אריות קריית גת',
  'אט ק גת':         'אריות קריית גת',
  'הה גדרה':         "החבר'ה הטובים גדרה",
  'החברה הטובים':    "החבר'ה הטובים גדרה",
  'החברה הטובים גדרה': "החבר'ה הטובים גדרה",
};

function resolveTeamId(name: string, teamMap: Map<string, string>): string | null {
  const norm = normalizeTeamName(name);
  // Direct hit
  if (teamMap.has(norm)) return teamMap.get(norm)!;
  // Alias lookup
  const aliased = TEAM_ALIASES[norm];
  if (aliased && teamMap.has(normalizeTeamName(aliased))) {
    return teamMap.get(normalizeTeamName(aliased))!;
  }
  return null;
}

/* Convert Excel date "DD.M.YY" or "DD.MM.YY" to ISO "YYYY-MM-DD" */
function toIsoDate(excelDate: string): string | null {
  const m = excelDate.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (!m) return null;
  const day   = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  let year    = m[3];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}

const NORTH_NAMES = new Set([
  'ידרסל חדרה', 'חולון', 'בני נתניה', 'גוטלמן השרון',
  'בני מוצקין', 'כ.ע. בת-ים', 'גלי בת-ים',
]);
const SOUTH_NAMES = new Set([
  'ראשון "גפן" לציון', 'אחים קריית משה', 'קריית מלאכי',
  'אוריה ירושלים', 'אופק רחובות', 'אריות קריית גת',
  'אדיס אשדוד', "החבר'ה הטובים גדרה",
]);

type StandingRow = {
  rank: number; name: string; games: number; wins: number; losses: number;
  pf: number; pa: number; diff: number; techni: number; penalty: number; pts: number;
};

type GameResultRow = {
  round: number; date: string; division: string;
  home_team: string; away_team: string;
  home_score: number; away_score: number;
  techni: boolean; techni_note: string;
};

type CupGameRow = {
  round: string;
  round_order: number;
  game_number: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  date: string;
  played: boolean;
};

function parseStandings(rows: unknown[][]): { north: StandingRow[]; south: StandingRow[] } {
  const north: StandingRow[] = [];
  const south: StandingRow[] = [];

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cell = String(row[i] ?? '').trim();
      const inNorth = NORTH_NAMES.has(cell);
      const inSouth = SOUTH_NAMES.has(cell);
      if (!inNorth && !inSouth) continue;

      const nums = (row.slice(i + 1) as unknown[])
        .map((v) => (typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0));
      const rankCell = row[i - 1];
      const rank = typeof rankCell === 'number' ? rankCell : (inNorth ? north.length : south.length) + 1;

      const standing: StandingRow = {
        rank,
        name: cell,
        games:   nums[0] ?? 0,
        wins:    nums[1] ?? 0,
        losses:  nums[2] ?? 0,
        pf:      nums[3] ?? 0,
        pa:      nums[4] ?? 0,
        diff:    nums[5] ?? 0,
        techni:  nums[6] ?? 0,
        penalty: nums[7] ?? 0,
        pts:     nums[8] ?? 0,
      };

      if (inNorth) north.push(standing);
      else south.push(standing);
    }
  }

  north.sort((a, b) => a.rank - b.rank);
  south.sort((a, b) => a.rank - b.rank);
  return { north, south };
}

function parseRoundDates(rows: unknown[][]): Record<number, string> {
  const map: Record<number, string> = {};
  let currentDate = '';
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] ?? '').trim();
    const col1 = row[1];
    if (col0.includes('פגרה') || col0.includes('גביע')) continue;
    if (col0 && /\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(col0)) currentDate = col0;
    if (typeof col1 === 'number' && col1 > 0 && currentDate && !map[col1]) {
      map[col1] = currentDate;
    }
  }
  return map;
}

function parseResults(rows: unknown[][]): GameResultRow[] {
  const results: GameResultRow[] = [];
  let currentDate = '';
  let currentRound = 0;
  let currentDivision: 'North' | 'South' = 'South';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 7) continue;

    const col0 = String(row[0] ?? '').trim();
    const col1 = row[1];
    const col2 = String(row[2] ?? '').trim();
    const col3 = String(row[3] ?? '').trim();
    const col4 = row[4];
    const col5 = row[5];
    const col6 = String(row[6] ?? '').trim();
    const col10 = String(row[10] ?? '').trim();

    if (col0.includes('פגרה') || col0.includes('גביע')) continue;
    if (col0 && /\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(col0)) currentDate = col0;
    if (typeof col1 === 'number' && col1 > 0) currentRound = col1;
    if (col2 === 'צפון') currentDivision = 'North';
    else if (col2 === 'דרום') currentDivision = 'South';

    const homeScore = typeof col4 === 'number' ? col4 : parseInt(String(col4 ?? ''));
    const awayScore = typeof col5 === 'number' ? col5 : parseInt(String(col5 ?? ''));

    if (!col3 || !col6 || isNaN(homeScore) || isNaN(awayScore) || currentRound === 0) continue;

    results.push({
      round: currentRound,
      date: currentDate,
      division: currentDivision,
      home_team: col3,
      away_team: col6,
      home_score: homeScore,
      away_score: awayScore,
      techni: col10.startsWith('טכני'),
      techni_note: col10,
    });
  }

  return results;
}

function parseCupGames(rows: unknown[][]): CupGameRow[] {
  const games: CupGameRow[] = [];

  const ROUND_PATTERNS = [
    { keyword: 'שמינית', name: 'שמינית גמר', order: 1 },
    { keyword: 'רבע',    name: 'רבע גמר',    order: 2 },
    { keyword: 'חצי',    name: 'חצי גמר',    order: 3 },
    // Final: must contain 'גמר' but NOT any earlier-round keyword
    { keyword: 'גמר',    name: 'גמר',         order: 4 },
  ];

  // Step 1: Collect all round header anchor positions (row + col).
  // For the final "גמר" we exclude cells that also contain שמינית/רבע/חצי.
  const roundHeaders: { row: number; col: number; name: string; order: number; date: string }[] = [];

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!row || !Array.isArray(row)) continue;
    for (let col = 0; col < row.length; col++) {
      const cell = String(row[col] ?? '').trim();
      if (!cell) continue;

      for (const p of ROUND_PATTERNS) {
        let matches = false;
        if (p.order === 4) {
          // Final round: 'גמר' must appear without any earlier-round keyword
          matches = cell.includes('גמר') &&
                    !cell.includes('שמינית') &&
                    !cell.includes('רבע') &&
                    !cell.includes('חצי');
        } else {
          matches = cell.includes(p.keyword);
        }

        if (!matches) continue;

        // Deduplicate: skip if we already recorded this round close by
        const dupe = roundHeaders.some(
          h => h.order === p.order && Math.abs(h.col - col) < 10,
        );
        if (dupe) continue;

        // Look for a date in: (1) header cell text, (2) same row near header col, (3) row above near header col
        const DATE_RE = /\d{1,2}[./]\d{1,2}[./]\d{2,4}/;
        const DATE_EXACT = /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/;
        let date = '';

        // Priority 1: date embedded in the header cell itself (e.g. "שלב ד - גמר גביע 29.5.26")
        const cellDateMatch = DATE_RE.exec(cell);
        if (cellDateMatch) date = cellDateMatch[0];

        // Priority 2: standalone date cell in the SAME ROW, within ±8 cols of
        // header — pick the date in the cell CLOSEST to the header column
        // (the header for round N can sit between round N-1's date and round
        // N's date, and we want round N's).
        if (!date) {
          const s = Math.max(0, col - 4), e = Math.min(row.length, col + 10);
          let bestDist = Infinity;
          for (let dc = s; dc < e; dc++) {
            const v = String(row[dc] ?? '').trim();
            if (DATE_EXACT.test(v)) {
              const dist = Math.abs(dc - col);
              if (dist < bestDist) { bestDist = dist; date = v; }
            }
          }
        }
        // Priority 3: row ABOVE, within ±8 cols of header — same nearest-cell
        // rule. Dates are usually one row above the stage header, with one
        // column per stage.
        if (!date && ri > 0) {
          const above = rows[ri - 1];
          if (above && Array.isArray(above)) {
            const s = Math.max(0, col - 4), e = Math.min(above.length, col + 10);
            let bestDist = Infinity;
            for (let dc = s; dc < e; dc++) {
              const v = String(above[dc] ?? '').trim();
              if (DATE_EXACT.test(v)) {
                const dist = Math.abs(dc - col);
                if (dist < bestDist) { bestDist = dist; date = v; }
              }
            }
          }
        }

        roundHeaders.push({ row: ri, col, name: p.name, order: p.order, date });
      }
    }
  }

  if (roundHeaders.length === 0) return games;

  // Step 2: Scan row-pairs for בית / חוץ markers.
  // Assign each game to the NEAREST round header (by column distance).
  const gamesPerRound: Record<string, number> = {};

  for (let i = 0; i < rows.length - 1; i++) {
    const row     = rows[i];
    const nextRow = rows[i + 1];
    if (!row || !Array.isArray(row) || !nextRow || !Array.isArray(nextRow)) continue;

    for (let col = 0; col < row.length; col++) {
      if (String(row[col] ?? '').trim() !== 'בית') continue;
      if (String(nextRow[col] ?? '').trim() !== 'חוץ') continue;

      let homeName = ''; let homeScore: number | null = null;
      let awayName = ''; let awayScore: number | null = null;

      // In Hebrew RTL Excel, team name and score are stored to the RIGHT of the
      // בית/חוץ label (higher column indices = displayed to the LEFT).
      // The game number sits to the LEFT of בית (lower column indices), so we
      // must NOT search left — it would be mistaken for the home score.
      for (let d = 1; d <= 8; d++) {
        const rv  = row[col + d];
        if (typeof rv === 'number' && homeScore === null) homeScore = rv;
        if (typeof rv === 'string' && rv.trim().length > 1 && !homeName) homeName = rv.trim();

        const nrv = nextRow[col + d];
        if (typeof nrv === 'number' && awayScore === null) awayScore = nrv;
        if (typeof nrv === 'string' && nrv.trim().length > 1 && !awayName) awayName = nrv.trim();
      }

      if (!homeName || !awayName) continue;
      // Skip header-like / label cells
      if (['בית','חוץ','שלב','גביע'].some(k => homeName.includes(k) || awayName.includes(k))) continue;

      // Nearest round header wins
      let best = roundHeaders[0];
      let minDist = Math.abs(roundHeaders[0].col - col);
      for (const rh of roundHeaders) {
        const dist = Math.abs(rh.col - col);
        if (dist < minDist) { minDist = dist; best = rh; }
      }

      gamesPerRound[best.name] = (gamesPerRound[best.name] ?? 0) + 1;

      games.push({
        round:        best.name,
        round_order:  best.order,
        game_number:  gamesPerRound[best.name],
        home_team:    homeName,
        away_team:    awayName,
        home_score:   homeScore,
        away_score:   awayScore,
        date:         best.date,
        played:       homeScore !== null && awayScore !== null,
      });
    }
  }

  // Step 3: Fallback for rounds with no בית/חוץ games found (e.g. גמר final).
  //
  // Root cause of previous failures: the גמר teams sit on the SAME ROWS as
  // other rounds' game data (horizontal bracket). Filtering entire rows by
  // keyword killed valid rows.  New approach:
  //   • Scan every row
  //   • Look ONLY at cells from the round-header column onwards (to the right)
  //   • Skip individual cells that are keywords — never skip entire rows
  //   • The first two valid strings found are the home/away teams
  const STEP3_CELL_SKIP = new Set([
    'בית','חוץ','גמר','שלב','גביע','שמינית','רבע','חצי',
    '-','–','—','vs','VS','',
  ]);

  for (const rh of roundHeaders) {
    if (gamesPerRound[rh.name]) continue;

    // Start scanning from slightly before the header column so we don't miss
    // a team name that is one or two cells to its left.
    const scanFrom = Math.max(0, rh.col - 3);

    for (let ri = 0; ri < rows.length; ri++) {
      if (ri === rh.row) continue; // skip the header row itself

      const row = rows[ri];
      if (!row || !Array.isArray(row)) continue;

      const teams: string[] = [];
      let homeScore: number | null = null;
      let awayScore: number | null = null;

      for (let c = scanFrom; c < row.length; c++) {
        const raw = row[c];
        const v   = String(raw ?? '').trim();
        if (!v) continue;

        if (typeof raw === 'number') {
          // Ignore tiny numbers — they are likely game-number badges (1-9)
          // that appear in the שמינית/רבע area of the same row.
          if (raw > 9) {
            if (homeScore === null) homeScore = raw;
            else if (awayScore === null) awayScore = raw;
          }
          continue;
        }

        // Skip known keyword cells
        if (STEP3_CELL_SKIP.has(v)) continue;
        if (['שמינית','רבע','חצי','שלב','גביע'].some((k) => v.includes(k))) continue;
        // Skip date-like strings and pure numbers
        if (/\d{1,2}\.\d{1,2}/.test(v) || /^\d+$/.test(v)) continue;
        // Must be a plausible team name (> 2 chars)
        if (v.length > 2) teams.push(v);

        if (teams.length === 2) break; // found both teams — stop
      }

      if (teams.length >= 2) {
        gamesPerRound[rh.name] = 1;
        games.push({
          round:       rh.name,
          round_order: rh.order,
          game_number: 1,
          home_team:   teams[0],
          away_team:   teams[1],
          home_score:  homeScore,
          away_score:  awayScore,
          date:        rh.date,
          played:      homeScore !== null && awayScore !== null,
        });
        break;
      }
    }
  }

  games.sort((a, b) => a.round_order - b.round_order || a.game_number - b.game_number);
  return games;
}

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

    // Snapshot existing data before replacing
    const [{ data: prevStandings }, { data: prevResults }] = await Promise.all([
      supabaseAdmin.from('standings').select('*'),
      supabaseAdmin.from('game_results').select('*'),
    ]);

    // ── Replace standings: delete all, then insert fresh ──
    const standingRows = [
      ...north.map((r) => ({ ...r, division: 'North' })),
      ...south.map((r) => ({ ...r, division: 'South' })),
    ];

    if (standingRows.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from('standings')
        .delete()
        .neq('name', '');           // delete every row
      if (delErr) throw delErr;

      const { error: insErr } = await supabaseAdmin
        .from('standings')
        .insert(standingRows);
      if (insErr) throw insErr;
    }

    // ── Replace game results: delete all, then insert fresh ──
    let resultsCount = 0;
    {
      const { error: delErr } = await supabaseAdmin
        .from('game_results')
        .delete()
        .neq('round', -1);          // delete every row
      if (delErr) throw delErr;
    }
    if (results.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from('game_results')
        .insert(results);
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

        // Load existing games once — INCLUDE game_time + location so we can
        // preserve admin-filled values when migrating a rescheduled row.
        const { data: existingGames } = await supabaseAdmin
          .from('games')
          .select('id, home_team_id, away_team_id, game_date, game_time, location, status, home_score, away_score');

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

    // Replace cup games (silently skip if table doesn't exist yet)
    try {
      await supabaseAdmin.from('cup_games').delete().neq('round', '');
      if (cupGames.length > 0) {
        await supabaseAdmin.from('cup_games').insert(cupGames);
      }
    } catch { /* cup_games table not created yet — run SQL in Supabase */ }

    // Insert sync log (silently skip if table doesn't exist yet)
    try {
      await supabaseAdmin.from('sync_logs').insert({
        filename: file.name,
        north_count: north.length,
        south_count: south.length,
        results_count: resultsCount,
        snapshot_standings: prevStandings ?? [],
        snapshot_results: prevResults ?? [],
      });
    } catch { /* sync_logs table not created yet — run SQL in Supabase */ }

    const parts = [];
    if (north.length > 0) parts.push(`${north.length} קבוצות צפון`);
    if (south.length > 0) parts.push(`${south.length} קבוצות דרום`);
    if (resultsCount > 0) parts.push(`${resultsCount} תוצאות משחקים`);
    if (cupGames.length > 0) parts.push(`${cupGames.length} משחקי גביע`);
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
