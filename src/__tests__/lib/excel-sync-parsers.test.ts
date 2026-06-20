import * as XLSX from 'xlsx';
import {
  normalizeTeamName,
  resolveTeamId,
  toIsoDate,
  looselyInList,
  parseStandings,
  parseRoundDates,
  parseResults,
  parseCupGames,
  parseGameStatsSheet,
  parseSummarySheet,
  parseSummaryTeamQuarters,
  NORTH_NAMES,
  SOUTH_NAMES,
} from '@/lib/excel-sync-parsers';

// ---------------------------------------------------------------------------
// Fixture helpers — build a real .xlsx workbook in memory and read it back
// through the exact same pipeline the route handler uses
// (XLSX.read → sheet_to_json({ header: 1 })). This exercises the full
// "uploaded file → parsed rows" path, not just the pure parser logic.
// ---------------------------------------------------------------------------

function buildWorkbookBuffer(sheets: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function readSheetRows(buffer: Buffer, sheetName: string): unknown[][] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1 });
}

// ===========================================================================
// toIsoDate
// ===========================================================================

describe('toIsoDate', () => {
  it('converts single-digit day/month with 2-digit year', () => {
    expect(toIsoDate('1.5.25')).toBe('2025-05-01');
  });

  it('converts double-digit day/month with 2-digit year', () => {
    expect(toIsoDate('15.12.25')).toBe('2025-12-15');
  });

  it('accepts a 4-digit year as-is', () => {
    expect(toIsoDate('5.3.2026')).toBe('2026-03-05');
  });

  it('accepts the slash separator', () => {
    expect(toIsoDate('1/5/25')).toBe('2025-05-01');
  });

  it('pads single-digit day and month to two digits', () => {
    expect(toIsoDate('3.7.26')).toBe('2026-07-03');
  });

  it('returns null for an empty string', () => {
    expect(toIsoDate('')).toBeNull();
  });

  it('returns null for non-date text', () => {
    expect(toIsoDate('not a date')).toBeNull();
  });

  it('returns null when the year segment is missing', () => {
    expect(toIsoDate('5.3')).toBeNull();
  });

  it('returns null for an ISO date (wrong format for this parser)', () => {
    expect(toIsoDate('2025-05-01')).toBeNull();
  });
});

// ===========================================================================
// normalizeTeamName
// ===========================================================================

describe('normalizeTeamName', () => {
  it('strips straight double-quotes', () => {
    expect(normalizeTeamName('ראשון "גפן" לציון')).toBe('ראשון גפן לציון');
  });

  it('strips Hebrew double-geresh (״)', () => {
    expect(normalizeTeamName('ליב״י')).toBe('ליבי');
  });

  it('strips straight apostrophes', () => {
    expect(normalizeTeamName("החבר'ה הטובים")).toBe('החברה הטובים');
  });

  it('converts hyphens to spaces', () => {
    expect(normalizeTeamName('כ.ע. בת-ים')).toBe('כ.ע. בת ים');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeTeamName('חולון    תל   אביב')).toBe('חולון תל אביב');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeTeamName('  חולון  ')).toBe('חולון');
  });

  it('lowercases Latin characters', () => {
    expect(normalizeTeamName('Holon FC')).toBe('holon fc');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeTeamName('   ')).toBe('');
  });
});

// ===========================================================================
// resolveTeamId
// ===========================================================================

describe('resolveTeamId', () => {
  const teamMap = new Map<string, string>([
    [normalizeTeamName('אריות קריית גת'), 'id-arayot'],
    [normalizeTeamName("החבר'ה הטובים גדרה"), 'id-hachevre'],
    [normalizeTeamName('חולון'), 'id-holon'],
  ]);

  it('resolves a direct normalized match', () => {
    expect(resolveTeamId('חולון', teamMap)).toBe('id-holon');
  });

  it('resolves a name that only differs by quotes/spacing', () => {
    expect(resolveTeamId('  חולון  ', teamMap)).toBe('id-holon');
  });

  it('resolves via an alias (shortened form → canonical)', () => {
    // 'אריות ק גת' is an alias for 'אריות קריית גת'
    expect(resolveTeamId('אריות ק גת', teamMap)).toBe('id-arayot');
  });

  it('resolves the apostrophe-variant alias for The Good Guys Gedera', () => {
    // 'החברה הטובים גדרה' (no apostrophe) aliases to "החבר'ה הטובים גדרה"
    expect(resolveTeamId('החברה הטובים גדרה', teamMap)).toBe('id-hachevre');
  });

  it('returns null when no direct or alias match exists', () => {
    expect(resolveTeamId('קבוצה לא קיימת', teamMap)).toBeNull();
  });

  it('returns null when the alias target is not in the team map', () => {
    const sparse = new Map<string, string>([[normalizeTeamName('חולון'), 'id-holon']]);
    expect(resolveTeamId('אריות ק גת', sparse)).toBeNull();
  });
});

// ===========================================================================
// looselyInList
// ===========================================================================

describe('looselyInList', () => {
  it('matches an exact normalized name', () => {
    expect(looselyInList(NORTH_NAMES, 'חולון')).toBe(true);
  });

  it('matches when the cell is a substring of a list entry', () => {
    // 'אדיס אשדוד' ⊂ 'שועלי אדיס אשדוד'
    expect(looselyInList(SOUTH_NAMES, 'אדיס אשדוד')).toBe(true);
  });

  it('matches when a list entry is a substring of the cell', () => {
    expect(looselyInList(NORTH_NAMES, 'מועדון חולון לכדורסל')).toBe(true);
  });

  it('matches across quote/hyphen normalization', () => {
    // list has 'כ.ע. בת-ים'; cell uses a space instead of the hyphen
    expect(looselyInList(NORTH_NAMES, 'כ.ע. בת ים')).toBe(true);
  });

  it('returns false for a non-member team', () => {
    expect(looselyInList(NORTH_NAMES, 'שועלי אדיס אשדוד')).toBe(false);
  });

  it('returns false for an empty cell', () => {
    expect(looselyInList(NORTH_NAMES, '')).toBe(false);
  });

  it('returns false for an empty list', () => {
    expect(looselyInList([], 'חולון')).toBe(false);
  });
});

// ===========================================================================
// parseStandings (unit — inline rows)
// ===========================================================================

describe('parseStandings', () => {
  it('parses a North-division row with rank from the preceding cell', () => {
    const rows: unknown[][] = [
      [1, 'ידרסל חדרה', 14, 11, 3, 400, 280, 120, 0, 0, 23],
    ];
    const { north, south } = parseStandings(rows);
    expect(south).toHaveLength(0);
    expect(north).toEqual([
      {
        rank: 1, name: 'ידרסל חדרה', games: 14, wins: 11, losses: 3,
        pf: 400, pa: 280, diff: 120, techni: 0, penalty: 0, pts: 23,
      },
    ]);
  });

  it('parses a South-division row', () => {
    const rows: unknown[][] = [
      [1, 'שועלי אדיס אשדוד', 14, 12, 2, 420, 290, 130, 0, 0, 25],
    ];
    const { north, south } = parseStandings(rows);
    expect(north).toHaveLength(0);
    expect(south[0]).toMatchObject({ rank: 1, name: 'שועלי אדיס אשדוד', wins: 12, pts: 25 });
  });

  it('separates North and South teams across mixed rows', () => {
    const rows: unknown[][] = [
      [1, 'חולון', 14, 10, 4, 360, 300, 60, 0, 0, 24],
      [1, 'קריית מלאכי', 14, 8, 6, 340, 330, 10, 0, 0, 22],
    ];
    const { north, south } = parseStandings(rows);
    expect(north.map((r) => r.name)).toEqual(['חולון']);
    expect(south.map((r) => r.name)).toEqual(['קריית מלאכי']);
  });

  it('sorts each division by rank ascending', () => {
    const rows: unknown[][] = [
      [3, 'חולון', 14, 8, 6, 0, 0, 0, 0, 0, 20],
      [1, 'בני נתניה', 14, 12, 2, 0, 0, 0, 0, 0, 26],
      [2, 'בני מוצקין', 14, 10, 4, 0, 0, 0, 0, 0, 24],
    ];
    const { north } = parseStandings(rows);
    expect(north.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(north.map((r) => r.name)).toEqual(['בני נתניה', 'בני מוצקין', 'חולון']);
  });

  it('falls back to sequential rank when no numeric rank cell precedes the name', () => {
    const rows: unknown[][] = [
      ['', 'חולון', 14, 10, 4, 0, 0, 0, 0, 0, 24],
      ['', 'בני נתניה', 14, 12, 2, 0, 0, 0, 0, 0, 26],
    ];
    const { north } = parseStandings(rows);
    // ranks assigned by insertion order: 1, 2
    expect(north.map((r) => r.rank).sort()).toEqual([1, 2]);
  });

  it('recognizes a renamed team via substring tolerance', () => {
    // Canonical SOUTH name is 'שועלי אדיס אשדוד'; the file shortened it.
    const rows: unknown[][] = [
      [1, 'אדיס אשדוד', 14, 9, 5, 0, 0, 0, 0, 0, 23],
    ];
    const { south } = parseStandings(rows);
    expect(south).toHaveLength(1);
    expect(south[0].name).toBe('אדיס אשדוד');
  });

  it('returns empty divisions when no row contains a known team', () => {
    const rows: unknown[][] = [
      ['header', 'col', 'col', 'col'],
      ['totally unknown club', 5, 5, 5],
    ];
    const { north, south } = parseStandings(rows);
    expect(north).toHaveLength(0);
    expect(south).toHaveLength(0);
  });

  it('coerces non-numeric stat cells to 0', () => {
    const rows: unknown[][] = [
      [1, 'חולון', 'x', null, undefined, '', 'NaN', 0, 0, 0, 18],
    ];
    const { north } = parseStandings(rows);
    expect(north[0]).toMatchObject({ games: 0, wins: 0, losses: 0, pf: 0 });
  });
});

// ===========================================================================
// parseRoundDates (unit — inline rows)
// ===========================================================================

describe('parseRoundDates', () => {
  it('maps each round number to its preceding date', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 1],
      ['8.5.25', 2],
    ];
    expect(parseRoundDates(rows)).toEqual({ 1: '1.5.25', 2: '8.5.25' });
  });

  it('inherits the most recent date across rows without a date', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 1],
      [null, 1], // same round, no new date — already mapped, ignored
    ];
    expect(parseRoundDates(rows)).toEqual({ 1: '1.5.25' });
  });

  it('keeps the FIRST date seen for a given round number', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 3],
      ['9.9.99', 3], // round 3 already mapped → not overwritten
    ];
    expect(parseRoundDates(rows)).toEqual({ 3: '1.5.25' });
  });

  it('skips פגרה (break) rows', () => {
    const rows: unknown[][] = [
      ['header'],
      ['פגרה', 1],
    ];
    expect(parseRoundDates(rows)).toEqual({});
  });

  it('skips גביע (cup) rows', () => {
    const rows: unknown[][] = [
      ['header'],
      ['גביע', 2],
    ];
    expect(parseRoundDates(rows)).toEqual({});
  });

  it('ignores the first row (treated as a header)', () => {
    const rows: unknown[][] = [
      ['1.5.25', 1], // row 0 — skipped
      ['8.5.25', 2],
    ];
    expect(parseRoundDates(rows)).toEqual({ 2: '8.5.25' });
  });
});

// ===========================================================================
// parseResults (unit — inline rows)
// ===========================================================================

describe('parseResults', () => {
  it('parses a fully-populated result row', () => {
    const rows: unknown[][] = [
      ['header row is skipped'],
      ['1.5.25', 1, 'צפון', 'ידרסל חדרה', 80, 70, 'חולון', null, null, null, ''],
    ];
    expect(parseResults(rows)).toEqual([
      {
        round: 1, date: '1.5.25', division: 'North',
        home_team: 'ידרסל חדרה', away_team: 'חולון',
        home_score: 80, away_score: 70,
        techni: false, techni_note: '',
      },
    ]);
  });

  it('inherits date / round / division state across rows', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 1, 'צפון', '', '', '', ''],                       // state only
      [null, null, null, 'ידרסל חדרה', 80, 70, 'חולון'],          // uses inherited state
    ];
    const out = parseResults(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      round: 1, date: '1.5.25', division: 'North',
      home_team: 'ידרסל חדרה', away_team: 'חולון',
    });
  });

  it('switches division when a דרום header row appears', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 1, 'דרום', 'שועלי אדיס אשדוד', 90, 60, 'קריית מלאכי'],
    ];
    expect(parseResults(rows)[0].division).toBe('South');
  });

  it('flags a technical result when the note starts with טכני', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 2, 'דרום', 'אופק רחובות', 20, 0, 'חולון', null, null, null, 'טכני - אי הופעה'],
    ];
    const out = parseResults(rows);
    expect(out[0].techni).toBe(true);
    expect(out[0].techni_note).toBe('טכני - אי הופעה');
  });

  it('skips rows shorter than 7 columns', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 1, 'צפון', 'ידרסל חדרה', 80, 70], // length 6
    ];
    expect(parseResults(rows)).toEqual([]);
  });

  it('skips rows with a missing home or away team', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 1, 'צפון', '', 80, 70, 'חולון'],      // no home team
      ['1.5.25', 1, 'צפון', 'ידרסל חדרה', 80, 70, ''], // no away team
    ];
    expect(parseResults(rows)).toEqual([]);
  });

  it('skips rows with non-numeric scores', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 1, 'צפון', 'ידרסל חדרה', 'abc', 'def', 'חולון'],
    ];
    expect(parseResults(rows)).toEqual([]);
  });

  it('skips games before any round number has been set', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', null, 'צפון', 'ידרסל חדרה', 80, 70, 'חולון'], // currentRound still 0
    ];
    expect(parseResults(rows)).toEqual([]);
  });

  it('skips פגרה and גביע rows', () => {
    const rows: unknown[][] = [
      ['header'],
      ['פגרה', 1, 'צפון', 'ידרסל חדרה', 80, 70, 'חולון'],
      ['גביע', 1, 'צפון', 'בני נתניה', 50, 40, 'חולון'],
    ];
    expect(parseResults(rows)).toEqual([]);
  });

  it('parses string-encoded scores via parseInt', () => {
    const rows: unknown[][] = [
      ['header'],
      ['1.5.25', 1, 'צפון', 'ידרסל חדרה', '80', '70', 'חולון'],
    ];
    const out = parseResults(rows);
    expect(out[0]).toMatchObject({ home_score: 80, away_score: 70 });
  });
});

// ===========================================================================
// parseCupGames (unit — inline rows)
// ===========================================================================

describe('parseCupGames', () => {
  it('returns an empty array when no round headers are present', () => {
    const rows: unknown[][] = [
      ['just', 'some', 'data'],
      ['no', 'cup', 'headers'],
    ];
    expect(parseCupGames(rows)).toEqual([]);
  });

  it('parses a בית/חוץ pair under a שמינית גמר header (date from same row)', () => {
    const rows: unknown[][] = [
      ['1.12.25', 'שמינית גמר'],
      [null, 'בית', 'קבוצה א', 80],
      [null, 'חוץ', 'קבוצה ב', 70],
    ];
    const games = parseCupGames(rows);
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      round: 'שמינית גמר', round_order: 1, game_number: 1,
      home_team: 'קבוצה א', away_team: 'קבוצה ב',
      home_score: 80, away_score: 70,
      date: '1.12.25', played: true,
    });
  });

  it('reads the date from the row ABOVE the header (priority 3)', () => {
    const rows: unknown[][] = [
      [null, '15.12.25'],   // date one row above, same column as header
      [null, 'רבע גמר'],
      [null, 'בית', 'קבוצה א', 60],
      [null, 'חוץ', 'קבוצה ב', 55],
    ];
    const games = parseCupGames(rows);
    expect(games[0].round).toBe('רבע גמר');
    expect(games[0].date).toBe('15.12.25');
  });

  it('reads a date embedded directly in the header cell (priority 1)', () => {
    const rows: unknown[][] = [
      [null, 'שלב ד - גמר גביע 29.5.26'],
      [null, 'בית', 'קבוצה א', 88],
      [null, 'חוץ', 'קבוצה ב', 84],
    ];
    const games = parseCupGames(rows);
    expect(games[0].round).toBe('גמר');
    expect(games[0].date).toBe('29.5.26');
  });

  it('treats a "גמר" cell as the final only when no earlier-round keyword is present', () => {
    // 'שמינית גמר' contains 'גמר' but must be classified as order 1, not the final
    const rows: unknown[][] = [
      [null, 'שמינית גמר'],
      [null, 'בית', 'קבוצה א', 70],
      [null, 'חוץ', 'קבוצה ב', 65],
    ];
    const games = parseCupGames(rows);
    expect(games[0].round).toBe('שמינית גמר');
    expect(games[0].round_order).toBe(1);
  });

  it('marks a game as not played when scores are missing', () => {
    const rows: unknown[][] = [
      ['10.1.26', 'חצי גמר'],
      [null, 'בית', 'קבוצה א'],
      [null, 'חוץ', 'קבוצה ב'],
    ];
    const games = parseCupGames(rows);
    expect(games[0]).toMatchObject({ home_score: null, away_score: null, played: false });
  });

  it('uses the step-3 fallback for a final with teams on one row (no בית/חוץ)', () => {
    // No בית/חוץ markers anywhere → step 2 finds nothing → step 3 scans rows.
    // Both scores sit BETWEEN the two team names; step 3 stops scanning once it
    // has found two team strings, so any number after the 2nd name is ignored.
    const rows: unknown[][] = [
      [null, null, null, null, 'גמר'],
      [null, null, null, null, 'אלופים א', 85, 80, 'אלופים ב'],
    ];
    const games = parseCupGames(rows);
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      round: 'גמר', round_order: 4, game_number: 1,
      home_team: 'אלופים א', away_team: 'אלופים ב',
      home_score: 85, away_score: 80, played: true,
    });
  });

  it('sorts games by round order then game number', () => {
    // Two well-separated columns: רבע גמר (later round) on the left at col 1,
    // שמינית גמר (earlier round) far to the right at col 13. Team names avoid
    // the בית/חוץ/שלב/גביע keywords (those cells are skipped by the parser).
    const rows: unknown[][] = [
      ['5.1.26', 'רבע גמר', null, null, null, null, null, null, null, null, null, null, '1.12.25', 'שמינית גמר'],
      [null, 'בית', 'נבחרת א', 60, null, null, null, null, null, null, null, null, null, 'בית', 'נבחרת ג', 50],
      [null, 'חוץ', 'נבחרת ב', 55, null, null, null, null, null, null, null, null, null, 'חוץ', 'נבחרת ד', 45],
    ];
    const games = parseCupGames(rows);
    // שמינית (order 1) must come before רבע (order 2) regardless of column position
    expect(games.map((g) => g.round_order)).toEqual([1, 2]);
  });
});

// ===========================================================================
// Integration — round-trip through a real .xlsx workbook buffer
// ===========================================================================

describe('integration: standings sheet round-trip through .xlsx', () => {
  it('parses standings extracted from a generated workbook', () => {
    const buffer = buildWorkbookBuffer({
      'טבלאות': [
        [1, 'ידרסל חדרה', 14, 11, 3, 400, 280, 120, 0, 0, 23],
        [2, 'חולון', 14, 9, 5, 350, 300, 50, 0, 0, 19],
        [1, 'שועלי אדיס אשדוד', 14, 12, 2, 420, 290, 130, 0, 0, 25],
      ],
    });

    const rows = readSheetRows(buffer, 'טבלאות');
    const { north, south } = parseStandings(rows);

    expect(north.map((r) => r.name)).toEqual(['ידרסל חדרה', 'חולון']);
    expect(south.map((r) => r.name)).toEqual(['שועלי אדיס אשדוד']);
    expect(north[0]).toMatchObject({ rank: 1, wins: 11, pts: 23 });
    expect(south[0]).toMatchObject({ rank: 1, wins: 12, pts: 25 });
  });
});

describe('integration: results sheet round-trip through .xlsx', () => {
  it('parses game results extracted from a generated workbook', () => {
    const buffer = buildWorkbookBuffer({
      'תוצאות': [
        ['תאריך', 'מחזור', 'מחוז', 'בית', 'נק', 'נק', 'חוץ', '', '', '', 'הערות'],
        ['1.5.25', 1, 'צפון', 'ידרסל חדרה', 80, 70, 'חולון', '', '', '', ''],
        ['8.5.25', 2, 'דרום', 'אופק רחובות', 20, 0, 'קריית מלאכי', '', '', '', 'טכני - אי הופעה'],
      ],
    });

    const rows = readSheetRows(buffer, 'תוצאות');
    const results = parseResults(rows);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      round: 1, division: 'North', home_team: 'ידרסל חדרה', away_team: 'חולון',
      home_score: 80, away_score: 70, techni: false,
    });
    expect(results[1]).toMatchObject({
      round: 2, division: 'South', techni: true, techni_note: 'טכני - אי הופעה',
    });
  });

  it('extracts round dates from the same results sheet', () => {
    const buffer = buildWorkbookBuffer({
      'תוצאות': [
        ['תאריך', 'מחזור'],
        ['1.5.25', 1],
        ['8.5.25', 2],
        ['15.5.25', 3],
      ],
    });
    const rows = readSheetRows(buffer, 'תוצאות');
    expect(parseRoundDates(rows)).toEqual({ 1: '1.5.25', 2: '8.5.25', 3: '15.5.25' });
  });
});

describe('integration: cup sheet round-trip through .xlsx', () => {
  it('parses a בית/חוץ cup game extracted from a generated workbook', () => {
    const buffer = buildWorkbookBuffer({
      'גביע': [
        ['1.12.25', 'שמינית גמר'],
        ['', 'בית', 'קבוצה א', 80],
        ['', 'חוץ', 'קבוצה ב', 70],
      ],
    });

    const rows = readSheetRows(buffer, 'גביע');
    const games = parseCupGames(rows);

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      round: 'שמינית גמר', home_team: 'קבוצה א', away_team: 'קבוצה ב',
      home_score: 80, away_score: 70, played: true,
    });
  });
});

describe('integration: a workbook with standings + results + cup sheets', () => {
  it('parses all three sheets from one buffer', () => {
    const buffer = buildWorkbookBuffer({
      'טבלאות ליגה': [
        [1, 'בני נתניה', 14, 13, 1, 0, 0, 0, 0, 0, 27],
      ],
      'תוצאות משחקים': [
        ['תאריך', 'מחזור', 'מחוז', 'בית', 'נק', 'נק', 'חוץ'],
        ['1.5.25', 1, 'צפון', 'בני נתניה', 99, 50, 'חולון'],
      ],
      'גביע המדינה': [
        ['20.1.26', 'גמר'],
        ['', 'בית', 'בני נתניה', 88],
        ['', 'חוץ', 'חולון', 80],
      ],
    });

    // The route picks sheets by name substring: 'טבלאות', 'תוצאות', 'גביע'.
    const standingsSheet = XLSX.read(buffer, { type: 'buffer' }).SheetNames.find((n) => n.includes('טבלאות'))!;
    const resultsSheet   = XLSX.read(buffer, { type: 'buffer' }).SheetNames.find((n) => n.includes('תוצאות'))!;
    const cupSheet       = XLSX.read(buffer, { type: 'buffer' }).SheetNames.find((n) => n.includes('גביע'))!;

    const { north } = parseStandings(readSheetRows(buffer, standingsSheet));
    const results   = parseResults(readSheetRows(buffer, resultsSheet));
    const cup       = parseCupGames(readSheetRows(buffer, cupSheet));

    expect(north[0]).toMatchObject({ name: 'בני נתניה', pts: 27 });
    expect(results[0]).toMatchObject({ home_team: 'בני נתניה', home_score: 99 });
    expect(cup[0]).toMatchObject({ round: 'גמר', home_team: 'בני נתניה', away_team: 'חולון' });
  });

  it('finds no league data in an empty workbook', () => {
    const buffer = buildWorkbookBuffer({ 'טבלאות': [[]] });
    const { north, south } = parseStandings(readSheetRows(buffer, 'טבלאות'));
    expect(north).toHaveLength(0);
    expect(south).toHaveLength(0);
  });
});

// ===========================================================================
// parseGameStatsSheet — per-game player box score
// ===========================================================================

describe('parseGameStatsSheet', () => {
  it('parses a Hebrew header + player rows', () => {
    const rows = [
      ['שם השחקן', 'מספר', 'נקודות', 'שלשות', 'עבירות'],
      ['יוסי כהן', 7, 18, 2, 3],
      ['דוד לוי', 11, 9, 1, 4],
    ];
    expect(parseGameStatsSheet(rows)).toEqual([
      { name: 'יוסי כהן', jersey: 7,  points: 18, three_pointers: 2, fouls: 3 },
      { name: 'דוד לוי',  jersey: 11, points: 9,  three_pointers: 1, fouls: 4 },
    ]);
  });

  it('reads "3 נקודות" as three-pointers, not points', () => {
    const rows = [
      ['שחקן', 'נקודות', '3 נקודות', 'עבירות'],
      ['אבי', 20, 4, 2],
    ];
    expect(parseGameStatsSheet(rows)[0]).toMatchObject({
      points: 20, three_pointers: 4, fouls: 2,
    });
  });

  it('skips section-header and blank-stat rows', () => {
    const rows = [
      ['שם השחקן', 'מספר', 'נקודות', 'שלשות', 'עבירות'],
      ['— בית: הפועל —', '', '', '', ''],   // section header → skipped
      ['רון', 5, 12, 0, 1],
      ['פלוני', '', '', '', ''],            // no stats at all → skipped
      ['— חוץ: מכבי —', '', '', '', ''],
      ['גיא', 8, 7, 1, 2],
    ];
    expect(parseGameStatsSheet(rows).map((r) => r.name)).toEqual(['רון', 'גיא']);
  });

  it('defaults missing optional columns to 0 and keeps an explicit 0', () => {
    const rows = [
      ['שם', 'נקודות'],          // no jersey / three / fouls columns
      ['דני', 0],                 // played, scored 0 → still recorded
    ];
    expect(parseGameStatsSheet(rows)).toEqual([
      { name: 'דני', jersey: null, points: 0, three_pointers: 0, fouls: 0 },
    ]);
  });

  it('finds the header even with a title row above it', () => {
    const rows = [
      ['גליון סטטיסטיקה - מחזור 5', '', ''],
      ['שם', 'נקודות', 'עבירות'],
      ['משה', 14, 3],
    ];
    expect(parseGameStatsSheet(rows)).toEqual([
      { name: 'משה', jersey: null, points: 14, three_pointers: 0, fouls: 3 },
    ]);
  });

  it('returns [] when there is no points column', () => {
    const rows = [
      ['שם', 'מספר'],
      ['רון', 5],
    ];
    expect(parseGameStatsSheet(rows)).toEqual([]);
  });

  it('returns [] for empty input', () => {
    expect(parseGameStatsSheet([])).toEqual([]);
  });

  it('round-trips through a real .xlsx workbook', () => {
    const buffer = buildWorkbookBuffer({
      'סטטיסטיקה': [
        ['שם השחקן', 'מספר', 'נקודות', 'שלשות', 'עבירות'],
        ['— בית: הפועל —', '', '', '', ''],
        ['יוסי כהן', 7, 18, 2, 3],
      ],
    });
    const parsed = parseGameStatsSheet(readSheetRows(buffer, 'סטטיסטיקה'));
    expect(parsed).toEqual([
      { name: 'יוסי כהן', jersey: 7, points: 18, three_pointers: 2, fouls: 3 },
    ]);
  });
});

// ===========================================================================
// parseSummarySheet — official "סיכום" referee scoresheet
// ===========================================================================

describe('parseSummarySheet', () => {
  // The exact column layout of the real "סיכום" sheet (14 columns).
  const HEADER = [
    "מס' שחקן", 'שם השחקן', 'רבע 1', 'רבע 2', 'רבע 3', 'רבע 4', 'הארכה',
    "1 נק'", "2 נק'", "3 נק'", 'סה"כ נק\'', 'עבירות', "טכ'", 'ב"ס',
  ];

  it('parses both team sections and reads the TOTAL points + 3PT columns', () => {
    const rows = [
      ['סיכום משחק — ליגת לב"י'],
      ['מחוז: צפון      תאריך: —      ידרסל חדרה (בית)  נגד  בני נתניה (חוץ)'],
      ['תוצאה סופית: ...'],
      ["קבוצה א' (מארחת): ידרסל חדרה      |   טיים-אאוט: 0   |   עבירות קבוצתיות: 0"],
      HEADER,
      [8,  'יוחאי דדון', 2, 0, 4, 5, 0, 1, 4, 2, 17, 3, 0, 0],
      [33, 'בניהו ספיר', 0, 3, 0, 0, 0, 0, 0, 1,  3, 2, 0, 0],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', ''], // empty player slot
      ['', 'סה"כ קבוצה', 2, 3, 4, 5, 0, 1, 4, 3, 20, 5, 0, 0],  // team total → ends section
      [],
      ["קבוצה ב' (מתארחת): בני נתניה      |   טיים-אאוט: 0   |   עבירות קבוצתיות: 0"],
      HEADER,
      [7, 'דני כהן', 0, 0, 0, 0, 0, 2, 6, 0, 8, 1, 0, 0],
      ['', 'סה"כ קבוצה', 0, 0, 0, 0, 0, 2, 6, 0, 8, 1, 0, 0],
    ];
    expect(parseSummarySheet(rows)).toEqual([
      // points = "סה\"כ נק'" (17), NOT 1 נק'(1)/2 נק'(4); three = "3 נק'"(2), NOT "רבע 3"(4)
      { name: 'יוחאי דדון', jersey: 8,  points: 17, three_pointers: 2, fouls: 3 },
      { name: 'בניהו ספיר', jersey: 33, points: 3,  three_pointers: 1, fouls: 2 },
      { name: 'דני כהן',    jersey: 7,  points: 8,  three_pointers: 0, fouls: 1 },
    ]);
  });

  it('returns [] for a blank form (headers present, no players filled)', () => {
    const rows = [
      ["קבוצה א' (מארחת): ידרסל חדרה"],
      HEADER,
      ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', 'סה"כ קבוצה', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    expect(parseSummarySheet(rows)).toEqual([]);
  });

  it('returns [] for empty input', () => {
    expect(parseSummarySheet([])).toEqual([]);
  });

  it('round-trips through a real .xlsx "סיכום" sheet', () => {
    const buffer = buildWorkbookBuffer({
      'טופס משחק': [['(game form)']],
      'סיכום': [
        ["קבוצה א' (מארחת): ידרסל חדרה"],
        HEADER,
        [8, 'יוחאי דדון', 2, 0, 4, 5, 0, 1, 4, 2, 17, 3, 0, 0],
        ['', 'סה"כ קבוצה', 2, 0, 4, 5, 0, 1, 4, 2, 17, 3, 0, 0],
      ],
    });
    expect(parseSummarySheet(readSheetRows(buffer, 'סיכום'))).toEqual([
      { name: 'יוחאי דדון', jersey: 8, points: 17, three_pointers: 2, fouls: 3 },
    ]);
  });
});

// ===========================================================================
// parseSummaryTeamQuarters — per-team quarter line score from "סיכום"
// ===========================================================================

describe('parseSummaryTeamQuarters', () => {
  const HEADER = [
    "מס' שחקן", 'שם השחקן', 'רבע 1', 'רבע 2', 'רבע 3', 'רבע 4', 'הארכה',
    "1 נק'", "2 נק'", "3 נק'", 'סה"כ נק\'', 'עבירות', "טכ'", 'ב"ס',
  ];

  it("reads each team's per-quarter points + host/guest label from the total row", () => {
    const rows = [
      ["קבוצה א' (מארחת): ידרסל חדרה      |   טיים-אאוט: 0"],
      HEADER,
      [8, 'יוחאי דדון', 5, 4, 0, 6, 0, 1, 4, 2, 17, 3, 0, 0], // player row → ignored here
      ['', 'סה"כ קבוצה', 18, 12, 20, 19, 0, 5, 20, 3, 69, 14, 0, 0],
      [],
      ["קבוצה ב' (מתארחת): בני נתניה      |   טיים-אאוט: 0"],
      HEADER,
      [7, 'דני כהן', 0, 0, 0, 0, 0, 2, 6, 0, 8, 1, 0, 0],
      ['', 'סה"כ קבוצה', 14, 15, 16, 14, 0, 3, 22, 1, 59, 12, 0, 0],
    ];
    expect(parseSummaryTeamQuarters(rows)).toEqual([
      { teamName: 'ידרסל חדרה', isHome: true,  quarters: [18, 12, 20, 19, 0] },
      { teamName: 'בני נתניה',  isHome: false, quarters: [14, 15, 16, 14, 0] },
    ]);
  });

  it('captures an overtime value when present', () => {
    const rows = [
      ["קבוצה א' (מארחת): א"],
      HEADER,
      ['', 'סה"כ קבוצה', 20, 20, 20, 18, 7, 0, 0, 0, 85, 10, 0, 0],
    ];
    expect(parseSummaryTeamQuarters(rows)[0].quarters).toEqual([20, 20, 20, 18, 7]);
  });

  it('returns [] for empty input', () => {
    expect(parseSummaryTeamQuarters([])).toEqual([]);
  });
});
