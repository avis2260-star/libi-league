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

  const ROUND_KEYWORDS: Record<string, { name: string; order: number }> = {
    'שמינית': { name: 'שמינית גמר', order: 1 },
    'רבע':    { name: 'רבע גמר',    order: 2 },
    'חצי':    { name: 'חצי גמר',    order: 3 },
    'גמר':    { name: 'גמר',        order: 4 },
  };

  let currentRound = 'רבע גמר';
  let currentOrder = 2;
  let gameNumInRound = 0;

  for (const row of rows) {
    if (!row || !Array.isArray(row)) continue;
    const rowText = row.map(c => String(c ?? '').trim()).join(' ');

    // Detect round header
    let foundRound = false;
    for (const [key, val] of Object.entries(ROUND_KEYWORDS)) {
      if (rowText.includes(key)) {
        currentRound = val.name;
        currentOrder = val.order;
        gameNumInRound = 0;
        foundRound = true;
        break;
      }
    }
    if (foundRound) continue;

    // Find team names (non-empty string cells)
    const cells = row.map(c => ({ raw: c, str: String(c ?? '').trim() }));
    const stringCells = cells.filter(c => c.str && isNaN(Number(c.str)) && c.str.length > 1);
    const numCells = cells.filter(c => typeof c.raw === 'number');

    if (stringCells.length >= 2) {
      const homeTeam = stringCells[0].str;
      const awayTeam = stringCells[1].str;
      const homeScore = numCells[0]?.raw as number ?? null;
      const awayScore = numCells[1]?.raw as number ?? null;

      // Look for date
      let dateStr = '';
      for (const cell of cells) {
        if (cell.raw instanceof Date) {
          dateStr = cell.raw.toLocaleDateString('he-IL');
          break;
        }
        if (typeof cell.raw === 'number' && cell.raw > 40000 && cell.raw < 50000) {
          // Excel date serial
          const d = new Date(Math.round((cell.raw - 25569) * 86400 * 1000));
          dateStr = d.toLocaleDateString('he-IL');
          break;
        }
      }

      gameNumInRound++;
      games.push({
        round: currentRound,
        round_order: currentOrder,
        game_number: gameNumInRound,
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: homeScore,
        away_score: awayScore,
        date: dateStr,
        played: homeScore !== null && awayScore !== null,
      });
    }
  }

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
