/**
 * Pure parsing functions for the libi.xlsx admin sync file.
 *
 * All functions here are side-effect-free: they accept raw spreadsheet data
 * (unknown[][]) and return typed records.  No Supabase, no HTTP — so they
 * can be unit-tested and fuzz-tested without any infrastructure.
 *
 * The route handler (src/app/api/admin/sync-excel-file/route.ts) imports
 * from this module and calls the parsers after extracting sheet rows with
 * XLSX.utils.sheet_to_json(..., { header: 1 }).
 */

// ---------------------------------------------------------------------------
// Team-name helpers
// ---------------------------------------------------------------------------

/** Strip quotes/gereshim, normalise hyphens and whitespace, lowercase. */
export function normalizeTeamName(s: string): string {
  return s
    .replace(/["""„‟״'`]/g, '') // strip all quote/apostrophe variants
    .replace(/['']/g, '')        // smart apostrophes
    .replace(/-/g, ' ')          // hyphens to spaces
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Aliases — Excel results may use a shortened form vs the teams table.
 * Keys are already in normalizeTeamName() form so lookups are O(1).
 */
export const TEAM_ALIASES: Record<string, string> = {
  'אריות ק גת':           'אריות קריית גת',
  'אס ק גת':              'אריות קריית גת',
  'אט ק גת':              'אריות קריית גת',
  'הה גדרה':              "החבר'ה הטובים גדרה",
  'החברה הטובים':         "החבר'ה הטובים גדרה",
  'החברה הטובים גדרה':    "החבר'ה הטובים גדרה",
};

/**
 * Resolve a raw Excel team-name string to its database UUID.
 * Tries:  1. Direct normalised lookup  2. TEAM_ALIASES lookup
 */
export function resolveTeamId(
  name: string,
  teamMap: Map<string, string>,
): string | null {
  const norm = normalizeTeamName(name);
  if (teamMap.has(norm)) return teamMap.get(norm)!;
  const aliased = TEAM_ALIASES[norm];
  if (aliased && teamMap.has(normalizeTeamName(aliased))) {
    return teamMap.get(normalizeTeamName(aliased))!;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Convert an Excel date string in "DD.M.YY", "DD.MM.YY", "DD.MM.YYYY" or
 * "DD/MM/YY" format to an ISO "YYYY-MM-DD" string.
 * Returns null for anything that doesn't match.
 */
export function toIsoDate(excelDate: string): string | null {
  const m = excelDate.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (!m) return null;
  const day   = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  let year    = m[3];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Division membership
// ---------------------------------------------------------------------------

/** Canonical team roster for the North division. */
export const NORTH_NAMES: string[] = [
  'ידרסל חדרה', 'חולון', 'בני נתניה', 'גוטלמן השרון',
  'בני מוצקין', 'כ.ע. בת-ים', 'גלי בת-ים',
];

/** Canonical team roster for the South division. */
export const SOUTH_NAMES: string[] = [
  'ראשון "גפן" לציון', 'אחים קריית משה', 'קריית מלאכי',
  'אוריה ירושלים', 'אופק רחובות', 'אריות קריית גת',
  'שועלי אדיס אשדוד', "החבר'ה הטובים גדרה",
];

/**
 * Substring-tolerant membership check.
 * Returns true if `cell` matches any entry in `list` after normalisation,
 * allowing one string to be a substring of the other.  Used for standings
 * division detection when the Excel file uses a shortened team name.
 */
export function looselyInList(list: string[], cell: string): boolean {
  const target = normalizeTeamName(cell);
  if (!target) return false;
  for (const name of list) {
    const n = normalizeTeamName(name);
    if (n === target || n.includes(target) || target.includes(n)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export type StandingRow = {
  rank: number; name: string; games: number; wins: number; losses: number;
  pf: number; pa: number; diff: number; techni: number; penalty: number; pts: number;
};

export type GameResultRow = {
  round: number; date: string; division: string;
  home_team: string; away_team: string;
  home_score: number; away_score: number;
  techni: boolean; techni_note: string;
};

export type CupGameRow = {
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

// ---------------------------------------------------------------------------
// parseStandings
// ---------------------------------------------------------------------------

/**
 * Extract North and South standings from the raw rows of the "טבלאות" sheet.
 *
 * Each row is scanned cell-by-cell.  The first cell that matches a known
 * team name (via looselyInList) anchors the row:
 *   • cell before it  → rank
 *   • cells after it  → numeric stats (games, wins, losses, pf, pa, diff,
 *                        techni, penalty, pts)
 */
export function parseStandings(
  rows: unknown[][],
): { north: StandingRow[]; south: StandingRow[] } {
  const north: StandingRow[] = [];
  const south: StandingRow[] = [];

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cell = String(row[i] ?? '').trim();
      const inNorth = looselyInList(NORTH_NAMES, cell);
      const inSouth = looselyInList(SOUTH_NAMES, cell);
      if (!inNorth && !inSouth) continue;

      const nums = (row.slice(i + 1) as unknown[]).map(
        (v) => (typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0),
      );
      const rankCell = row[i - 1];
      const rank =
        typeof rankCell === 'number'
          ? rankCell
          : (inNorth ? north.length : south.length) + 1;

      const standing: StandingRow = {
        rank,
        name:    cell,
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

// ---------------------------------------------------------------------------
// parseRoundDates
// ---------------------------------------------------------------------------

/**
 * Build a round-number → date-string map from the "תוצאות" sheet.
 *
 * Used to extract schedule dates for rounds that may not have results yet
 * (the map is persisted to league_settings so the schedule page can show
 * upcoming round dates).
 *
 * Skips rows that mention פגרה (break) or גביע (cup).
 * Each round number is only mapped once (first occurrence wins).
 */
export function parseRoundDates(rows: unknown[][]): Record<number, string> {
  const map: Record<number, string> = {};
  let currentDate = '';
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = String(row[0] ?? '').trim();
    const col1  = row[1];
    if (col0.includes('פגרה') || col0.includes('גביע')) continue;
    if (col0 && /\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(col0)) currentDate = col0;
    if (typeof col1 === 'number' && col1 > 0 && currentDate && !map[col1]) {
      map[col1] = currentDate;
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// parseResults
// ---------------------------------------------------------------------------

/**
 * Parse completed game results from the "תוצאות" sheet.
 *
 * Column layout (0-indexed):
 *   0  – date (DD.MM.YY / DD.MM.YYYY) — state, inherited by subsequent rows
 *   1  – round number — state
 *   2  – division label ("צפון" | "דרום") — state
 *   3  – home team name
 *   4  – home score
 *   5  – away score
 *   6  – away team name
 *   10 – techni / penalty note
 *
 * Rows that mention פגרה or גביע are skipped.
 * Rows with missing team names, non-numeric scores, or round=0 are skipped.
 */
export function parseResults(rows: unknown[][]): GameResultRow[] {
  const results: GameResultRow[] = [];
  let currentDate = '';
  let currentRound = 0;
  let currentDivision: 'North' | 'South' = 'South';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 7) continue;

    const col0  = String(row[0]  ?? '').trim();
    const col1  = row[1];
    const col2  = String(row[2]  ?? '').trim();
    const col3  = String(row[3]  ?? '').trim();
    const col4  = row[4];
    const col5  = row[5];
    const col6  = String(row[6]  ?? '').trim();
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
      round:       currentRound,
      date:        currentDate,
      division:    currentDivision,
      home_team:   col3,
      away_team:   col6,
      home_score:  homeScore,
      away_score:  awayScore,
      techni:      col10.startsWith('טכני'),
      techni_note: col10,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// parseCupGames
// ---------------------------------------------------------------------------

/**
 * Parse cup-tournament games from the "גביע" / "טורניר" sheet.
 *
 * The sheet uses a horizontal bracket layout with:
 *   • Round headers containing "שמינית", "רבע", "חצי", or "גמר"
 *   • Date strings (DD.MM.YY) near each header
 *   • Game rows with "בית" (home) and "חוץ" (away) labels followed by
 *     the team name and score in the adjacent cells (RTL column order)
 *
 * Three fallback strategies are used to locate dates and games.  See inline
 * comments for details.
 */
export function parseCupGames(rows: unknown[][]): CupGameRow[] {
  const games: CupGameRow[] = [];

  const ROUND_PATTERNS = [
    { keyword: 'שמינית', name: 'שמינית גמר', order: 1 },
    { keyword: 'רבע',    name: 'רבע גמר',    order: 2 },
    { keyword: 'חצי',    name: 'חצי גמר',    order: 3 },
    // Final: must contain 'גמר' but NOT any earlier-round keyword
    { keyword: 'גמר',    name: 'גמר',         order: 4 },
  ];

  // ── Step 1: Locate round-header cells ──────────────────────────────────
  const roundHeaders: {
    row: number; col: number; name: string; order: number; date: string;
  }[] = [];

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!row || !Array.isArray(row)) continue;
    for (let col = 0; col < row.length; col++) {
      const cell = String(row[col] ?? '').trim();
      if (!cell) continue;

      for (const p of ROUND_PATTERNS) {
        let matches = false;
        if (p.order === 4) {
          matches =
            cell.includes('גמר') &&
            !cell.includes('שמינית') &&
            !cell.includes('רבע') &&
            !cell.includes('חצי');
        } else {
          matches = cell.includes(p.keyword);
        }
        if (!matches) continue;

        // Dedup: skip if same round already recorded within 10 columns
        const dupe = roundHeaders.some(
          (h) => h.order === p.order && Math.abs(h.col - col) < 10,
        );
        if (dupe) continue;

        const DATE_RE    = /\d{1,2}[./]\d{1,2}[./]\d{2,4}/;
        const DATE_EXACT = /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/;
        let date = '';

        // Priority 1: date embedded in the header cell
        const cellDateMatch = DATE_RE.exec(cell);
        if (cellDateMatch) date = cellDateMatch[0];

        // Priority 2: standalone date cell in the SAME ROW, nearest to header
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

        // Priority 3: row ABOVE, nearest cell within ±8 columns
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

  // ── Step 2: Scan for בית/חוץ row-pairs ─────────────────────────────────
  const gamesPerRound: Record<string, number> = {};

  for (let i = 0; i < rows.length - 1; i++) {
    const row     = rows[i];
    const nextRow = rows[i + 1];
    if (!row || !Array.isArray(row) || !nextRow || !Array.isArray(nextRow)) continue;

    for (let col = 0; col < row.length; col++) {
      if (String(row[col]     ?? '').trim() !== 'בית') continue;
      if (String(nextRow[col] ?? '').trim() !== 'חוץ') continue;

      let homeName  = ''; let homeScore: number | null = null;
      let awayName  = ''; let awayScore: number | null = null;

      for (let d = 1; d <= 8; d++) {
        const rv  = row[col + d];
        if (typeof rv === 'number' && homeScore === null) homeScore = rv;
        if (typeof rv === 'string' && rv.trim().length > 1 && !homeName) homeName = rv.trim();

        const nrv = nextRow[col + d];
        if (typeof nrv === 'number' && awayScore === null) awayScore = nrv;
        if (typeof nrv === 'string' && nrv.trim().length > 1 && !awayName) awayName = nrv.trim();
      }

      if (!homeName || !awayName) continue;
      if (['בית', 'חוץ', 'שלב', 'גביע'].some((k) => homeName.includes(k) || awayName.includes(k))) continue;

      // Nearest round header wins
      let best    = roundHeaders[0];
      let minDist = Math.abs(roundHeaders[0].col - col);
      for (const rh of roundHeaders) {
        const dist = Math.abs(rh.col - col);
        if (dist < minDist) { minDist = dist; best = rh; }
      }

      gamesPerRound[best.name] = (gamesPerRound[best.name] ?? 0) + 1;
      games.push({
        round:       best.name,
        round_order: best.order,
        game_number: gamesPerRound[best.name],
        home_team:   homeName,
        away_team:   awayName,
        home_score:  homeScore,
        away_score:  awayScore,
        date:        best.date,
        played:      homeScore !== null && awayScore !== null,
      });
    }
  }

  // ── Step 3: Fallback for rounds with no בית/חוץ games found ────────────
  // The final bracket typically has teams on the same row without בית/חוץ
  // labels (different layout in the real spreadsheet).
  const STEP3_CELL_SKIP = new Set([
    'בית', 'חוץ', 'גמר', 'שלב', 'גביע', 'שמינית', 'רבע', 'חצי',
    '-', '–', '—', 'vs', 'VS', '',
  ]);

  for (const rh of roundHeaders) {
    if (gamesPerRound[rh.name]) continue;

    const scanFrom = Math.max(0, rh.col - 3);

    for (let ri = 0; ri < rows.length; ri++) {
      if (ri === rh.row) continue;

      const row = rows[ri];
      if (!row || !Array.isArray(row)) continue;

      const teams: string[]     = [];
      let   homeScore: number | null = null;
      let   awayScore: number | null = null;

      for (let c = scanFrom; c < row.length; c++) {
        const raw = row[c];
        const v   = String(raw ?? '').trim();
        if (!v) continue;

        if (typeof raw === 'number') {
          if (raw > 9) {
            if      (homeScore === null) homeScore = raw;
            else if (awayScore === null) awayScore = raw;
          }
          continue;
        }

        if (STEP3_CELL_SKIP.has(v)) continue;
        if (['שמינית', 'רבע', 'חצי', 'שלב', 'גביע'].some((k) => v.includes(k))) continue;
        if (/\d{1,2}\.\d{1,2}/.test(v) || /^\d+$/.test(v)) continue;
        if (v.length > 2) teams.push(v);

        if (teams.length === 2) break;
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
