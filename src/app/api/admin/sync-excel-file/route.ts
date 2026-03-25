import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

        // Look for a date anywhere in the same row
        let date = '';
        for (let dc = 0; dc < row.length; dc++) {
          const v = String(row[dc] ?? '').trim();
          if (/^\d{1,2}\.\d{1,2}\.(\d{2}|\d{4})$/.test(v)) { date = v; break; }
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

  // Step 3: Fallback for rounds with no בית/חוץ games found.
  // The גמר (final) often uses a single-row format:
  //   "Team A  -  Team B"  (no scores when not yet played)
  // Scan rows below the header and collect the first row that has ≥2 team strings.
  for (const rh of roundHeaders) {
    if (gamesPerRound[rh.name]) continue; // already found games for this round

    for (let ri = rh.row + 1; ri < Math.min(rows.length, rh.row + 20); ri++) {
      const row = rows[ri];
      if (!row || !Array.isArray(row)) continue;

      // Skip rows that look like headers OR regular game rows (contain בית/חוץ labels)
      const rowStr = row.map((c) => String(c ?? '').trim()).join(' ');
      if (['שלב','גביע','שמינית','רבע','חצי','בית','חוץ'].some((k) => rowStr.includes(k))) continue;
      // Skip if the row itself looks like a round header (contains גמר as a label)
      if (row.some((c) => { const s = String(c ?? '').trim(); return s === 'גמר' || s.endsWith(' גמר'); })) continue;

      // Collect meaningful strings within ±15 columns of the header column
      // Exclude known labels that are not team names
      const SKIP_WORDS = new Set(['בית','חוץ','גמר','שלב','גביע','-','–','—']);
      const teams: string[] = [];
      const colMin = Math.max(0, rh.col - 15);
      const colMax = Math.min(row.length - 1, rh.col + 15);
      for (let c = colMin; c <= colMax; c++) {
        const v = String(row[c] ?? '').trim();
        // Must be a plausible team name: length > 2, not a known label, not purely numeric, not a date
        if (v.length > 2 && !SKIP_WORDS.has(v) && !/^\d+$/.test(v) && !/\d{1,2}\.\d{1,2}/.test(v)) {
          teams.push(v);
        }
      }

      if (teams.length >= 2) {
        gamesPerRound[rh.name] = 1;
        // Check whether scores are present alongside the teams
        let homeScore: number | null = null;
        let awayScore: number | null = null;
        for (let c = colMin; c <= colMax; c++) {
          const v = row[c];
          if (typeof v === 'number') {
            if (homeScore === null) homeScore = v;
            else if (awayScore === null) awayScore = v;
          }
        }
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
    if (resultsSheet) {
      const resultsRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[resultsSheet], { header: 1 });
      results = parseResults(resultsRows);
    }

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
