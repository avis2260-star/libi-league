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

// ---------------------------------------------------------------------------
// parseGameStatsSheet — per-game player box score (admin Excel upload)
// ---------------------------------------------------------------------------

/** One player's line parsed from an uploaded per-game stats sheet. */
export type ParsedPlayerStat = {
  name: string;
  jersey: number | null;
  points: number;
  three_pointers: number;
  fouls: number;
  // Per-player breakdown from the official "סיכום" sheet — null when the source
  // (e.g. the plain template) doesn't carry it.
  quarter_points: number[] | null; // points in רבע 1..4 (+ overtime)
  two_pointers: number | null;     // 2-pointers made (2 נק')
  free_throws: number | null;      // free throws made (1 נק')
};

type StatColumn = 'name' | 'jersey' | 'three' | 'points' | 'fouls';

/**
 * Header keywords (lower-cased substrings, Hebrew + English). Categories are
 * tested in STAT_COLUMN_ORDER, with `three` BEFORE `points` so a "3 נקודות"
 * header is read as three-pointers rather than points.
 */
const STAT_HEADER_KEYWORDS: Record<StatColumn, string[]> = {
  name:   ['שם', 'שחקן', 'name', 'player'],
  jersey: ['מספר', 'חולצה', '#', 'jersey', 'number'],
  three:  ['שלש', '3', 'three'],
  points: ['נקוד', 'נק', 'points', 'pts'],
  fouls:  ['עביר', 'פאול', 'foul'],
};

const STAT_COLUMN_ORDER: StatColumn[] = ['name', 'jersey', 'three', 'points', 'fouls'];

/** Parse one cell into a non-negative integer, or null when blank/non-numeric. */
function toStatInt(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = parseInt(s.replace(/[^\d-]/g, ''), 10);
  return Number.isNaN(n) ? null : Math.max(0, n);
}

/** Map a header row to column indices. Returns null unless name + points exist. */
function detectStatColumns(headerRow: unknown[]): Record<StatColumn, number | null> | null {
  const cols: Record<StatColumn, number | null> = {
    name: null, jersey: null, three: null, points: null, fouls: null,
  };
  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? '').trim().toLowerCase();
    if (!h) continue;
    for (const cat of STAT_COLUMN_ORDER) {
      if (cols[cat] !== null) continue;
      if (STAT_HEADER_KEYWORDS[cat].some((k) => h.includes(k))) {
        cols[cat] = c;
        break;
      }
    }
  }
  return cols.name !== null && cols.points !== null ? cols : null;
}

/**
 * Parse a per-game player box score from the raw rows of an uploaded sheet.
 *
 * The column layout is detected from a header row (the first row that yields
 * both a "name" and a "points" column), so the file can be the downloadable
 * template or the admin's own as long as it has recognisable Hebrew/English
 * headers, e.g.:  שם השחקן | מספר | נקודות | שלשות | עבירות
 *
 * Rows whose stat cells are all blank (team section headers, players with no
 * recorded line) are skipped. Team affiliation is intentionally NOT read from
 * the sheet — the import route matches each name against the game's two
 * rosters, so a single flat list of all players in the game works.
 */
export function parseGameStatsSheet(rows: unknown[][]): ParsedPlayerStat[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // Find the header row within the first handful of rows.
  let headerIdx = -1;
  let cols: Record<StatColumn, number | null> | null = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const detected = Array.isArray(rows[i]) ? detectStatColumns(rows[i]) : null;
    if (detected) { headerIdx = i; cols = detected; break; }
  }
  if (headerIdx === -1 || !cols) return [];

  const out: ParsedPlayerStat[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const name = String(row[cols.name!] ?? '').trim();
    if (!name) continue;

    const points = toStatInt(row[cols.points!]);
    const three  = cols.three !== null ? toStatInt(row[cols.three]) : null;
    const fouls  = cols.fouls !== null ? toStatInt(row[cols.fouls]) : null;

    // No numeric stat cells at all → section header or empty line. Skip.
    if (points === null && three === null && fouls === null) continue;

    const jersey = cols.jersey !== null ? toStatInt(row[cols.jersey]) : null;
    out.push({
      name,
      jersey,
      points: points ?? 0,
      three_pointers: three ?? 0,
      fouls: fouls ?? 0,
      // The plain template has no per-quarter / shot-type columns.
      quarter_points: null,
      two_pointers: null,
      free_throws: null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// parseSummarySheet — official "סיכום" referee scoresheet box score
// ---------------------------------------------------------------------------

/**
 * Parse player box scores from the "סיכום" (Summary) sheet of the official
 * Libi referee scoresheet ("טופס שיפוט כדורסל").
 *
 * The sheet stacks TWO team sections, each laid out as:
 *   • a team section header   ("קבוצה א' (מארחת): …")  — skipped
 *   • a column-header row:      מס' שחקן | שם השחקן | רבע 1..4 | הארכה |
 *                               1 נק' | 2 נק' | 3 נק' | סה"כ נק' | עבירות | טכ' | ב"ס
 *   • up to ~14 player rows
 *   • a "סה"כ קבוצה" team-total row  — ends the section
 *
 * Per player we read: name (שם), jersey (מס'), points (סה"כ נק' — the TOTAL,
 * deliberately NOT the 1/2-point split), three-pointers (3 נק') and fouls
 * (עבירות). Both sections are flattened into one list; the import route matches
 * each name against the game's two rosters, so team affiliation isn't needed.
 *
 * The source cells are formula-driven; XLSX reads their cached values, so a
 * filled, spreadsheet-saved workbook yields the computed names/points. A blank
 * form (no players recorded) yields [].
 */
type SummaryCols = {
  name: number; jersey: number | null; points: number;
  three: number | null; two: number | null; one: number | null; fouls: number | null;
  /** Indices of the per-quarter columns (רבע 1..4, then הארכה) in sheet order. */
  quarters: number[];
};

function detectSummaryColumns(row: unknown[]): SummaryCols | null {
  let name: number | null = null;
  let jersey: number | null = null;
  let points: number | null = null;
  let three: number | null = null;
  let two: number | null = null;
  let one: number | null = null;
  let fouls: number | null = null;
  const quarters: number[] = [];

  for (let c = 0; c < row.length; c++) {
    const h = String(row[c] ?? '').trim();
    if (!h) continue;
    if (name === null && h.includes('שם')) { name = c; continue; }                 // שם השחקן
    if (jersey === null && h.startsWith('מס')) { jersey = c; continue; }            // מס' שחקן
    if (points === null && h.includes('סה')) { points = c; continue; }             // סה"כ נק'  (TOTAL — before 1/2/3 נק')
    // Shot-type made counts. "רבע N" has no 'נק', so these never grab a quarter
    // column; the total column is already claimed above.
    if (three === null && ((h.includes('3') && h.includes('נק')) || h.includes('שלש'))) { three = c; continue; } // 3 נק'
    if (two === null && h.includes('2') && h.includes('נק')) { two = c; continue; }   // 2 נק'
    if (one === null && h.includes('1') && h.includes('נק')) { one = c; continue; }   // 1 נק'
    if (fouls === null && h.includes('עביר')) { fouls = c; continue; }             // עבירות
    if (/רבע/.test(h) || h.includes('הארכה')) { quarters.push(c); continue; }       // רבע 1..4 + הארכה
  }
  // A real column-header row has both a name and a total-points column.
  return name !== null && points !== null ? { name, jersey, points, three, two, one, fouls, quarters } : null;
}

/** True for the "סה"כ קבוצה" team-total row that ends a section. */
function isSummaryTotalRow(name: string): boolean {
  return /סה[\s"׳״']*כ|סך|קבוצה/.test(name);
}

/**
 * Read a team section header ("קבוצה א' (מארחת): ידרסל חדרה  |  …") into the
 * team name + whether it's the host (home) or guest (away) side. Returns null
 * for any non-section row.
 */
function parseSectionHeader(row: unknown[]): { teamName: string; isHome: boolean } | null {
  for (const cell of row) {
    const s = String(cell ?? '').trim();
    if (!s || !s.includes('קבוצה')) continue;
    if (!s.includes('מארחת') && !s.includes('מתארחת')) continue;
    const isHome = !s.includes('מתארחת');                 // מתארחת = guest/away
    const teamName = s.slice(s.indexOf(':') + 1).split('|')[0].trim();
    return { teamName, isHome };
  }
  return null;
}

export function parseSummarySheet(rows: unknown[][]): ParsedPlayerStat[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out: ParsedPlayerStat[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cols = Array.isArray(rows[i]) ? detectSummaryColumns(rows[i]) : null;
    if (!cols) continue;

    // Read player rows until the team-total row or the next section header.
    let j = i + 1;
    for (; j < rows.length; j++) {
      const row = rows[j];
      if (!Array.isArray(row)) continue;
      if (detectSummaryColumns(row)) break;               // next section header

      const name = String(row[cols.name] ?? '').trim();
      if (isSummaryTotalRow(name)) { j++; break; }         // end of this section
      if (!name) continue;                                 // empty player slot

      const points = toStatInt(row[cols.points]);
      const three  = cols.three !== null ? toStatInt(row[cols.three]) : null;
      const fouls  = cols.fouls !== null ? toStatInt(row[cols.fouls]) : null;
      if (points === null && three === null && fouls === null) continue;

      const jersey = cols.jersey !== null ? toStatInt(row[cols.jersey]) : null;
      const two = cols.two !== null ? toStatInt(row[cols.two]) : null;
      const one = cols.one !== null ? toStatInt(row[cols.one]) : null;
      // Per-quarter points (רבע 1..4 + הארכה). Null when the sheet has no quarter
      // columns; trailing empty overtime periods are trimmed.
      let quarterPoints: number[] | null = cols.quarters.length
        ? cols.quarters.map((qc) => toStatInt(row[qc]) ?? 0)
        : null;
      if (quarterPoints) {
        while (quarterPoints.length > 4 && quarterPoints[quarterPoints.length - 1] === 0) quarterPoints.pop();
        if (quarterPoints.every((q) => q === 0)) quarterPoints = null; // no per-quarter data recorded
      }
      out.push({
        name,
        jersey,
        points: points ?? 0,
        three_pointers: three ?? 0,
        fouls: fouls ?? 0,
        quarter_points: quarterPoints,
        two_pointers: two,
        free_throws: one,
      });
    }
    i = j - 1; // resume right after the rows this section consumed
  }
  return out;
}

/** Per-team quarter line score read from the "סיכום" sheet's team-total rows. */
export type SummaryTeamQuarters = { teamName: string; isHome: boolean; quarters: number[] };

/**
 * Extract each team's per-quarter points from the "סיכום" sheet. The team-total
 * row ("סה"כ קבוצה") of each section carries the team's points in רבע 1..4 (and
 * הארכה / overtime) — exactly the game line score. Returns one entry per team
 * section, in sheet order; `isHome` reflects the form's מארחת (host) / מתארחת
 * (guest) label so the caller can orient home vs away.
 */
export function parseSummaryTeamQuarters(rows: unknown[][]): SummaryTeamQuarters[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out: SummaryTeamQuarters[] = [];
  let section: { teamName: string; isHome: boolean } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const sec = parseSectionHeader(row);
    if (sec) { section = sec; continue; }

    const cols = detectSummaryColumns(row);
    if (!cols || cols.quarters.length === 0) continue;

    // Column-header row found — scan down for this section's team-total row.
    let j = i + 1;
    for (; j < rows.length; j++) {
      const r = rows[j];
      if (!Array.isArray(r)) continue;
      if (parseSectionHeader(r) || detectSummaryColumns(r)) break;
      const nm = String(r[cols.name] ?? '').trim();
      if (isSummaryTotalRow(nm)) {
        if (section) {
          out.push({
            teamName: section.teamName,
            isHome:   section.isHome,
            quarters: cols.quarters.map((qc) => toStatInt(r[qc]) ?? 0),
          });
        }
        j++;
        break;
      }
    }
    i = j - 1;
    section = null;
  }
  return out;
}
