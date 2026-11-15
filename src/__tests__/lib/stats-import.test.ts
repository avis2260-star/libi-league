import {
  readStatsWorkbook, matchRosterPlayer, matchStatLines, orientSummaryQuarters,
  buildStatsTemplateRows, TEMPLATE_HEADER, type RosterPlayer,
} from '@/lib/stats-import';

const SUMMARY_HEADER = [
  "מס' שחקן", 'שם השחקן', 'רבע 1', 'רבע 2', 'רבע 3', 'רבע 4', 'הארכה',
  "1 נק'", "2 נק'", "3 נק'", 'סה"כ נק\'', 'עבירות', "טכ'", 'ב"ס',
];
// Host (מארחת) = ידרסל חדרה, guest (מתארחת) = בני נתניה.
const SUMMARY: unknown[][] = [
  ["קבוצה א' (מארחת): ידרסל חדרה      |   טיים-אאוט: 0"],
  SUMMARY_HEADER,
  [8, 'יוחאי דדון', 5, 4, 0, 6, 0, 1, 4, 2, 17, 3, 0, 0],
  ['', 'סה"כ קבוצה', 18, 12, 20, 19, 0, 5, 20, 3, 69, 14, 0, 0],
  [],
  ["קבוצה ב' (מתארחת): בני נתניה      |   טיים-אאוט: 0"],
  SUMMARY_HEADER,
  [7, 'דני כהן', 0, 0, 0, 0, 0, 2, 6, 0, 8, 1, 0, 0],
  ['', 'סה"כ קבוצה', 14, 15, 16, 14, 0, 3, 22, 1, 59, 12, 0, 0],
];

const roster: RosterPlayer[] = [
  { id: 'p1', team_id: 'H', name: 'יוחאי דדון', jersey_number: 8 },
  { id: 'p2', team_id: 'A', name: 'דני כהן', jersey_number: 7 },
  { id: 'p3', team_id: 'A', name: 'משה לוי', jersey_number: 12 },
];

describe('readStatsWorkbook', () => {
  it('prefers the scoresheet’s סיכום sheet and keeps its rows for the quarters', () => {
    const sheets: Record<string, unknown[][]> = { 'טופס': [['x']], 'סיכום': SUMMARY };
    const { lines, summaryRows } = readStatsWorkbook(Object.keys(sheets), (n) => sheets[n] ?? null);
    expect(lines.map((l) => [l.name, l.points])).toEqual([['יוחאי דדון', 17], ['דני כהן', 8]]);
    expect(summaryRows).toBe(SUMMARY);
  });

  it('reads the template from the first sheet otherwise', () => {
    const sheets: Record<string, unknown[][]> = {
      'סטטיסטיקה': [TEMPLATE_HEADER, ['— בית: א —'], ['יוחאי דדון', 8, 17, 2, 3]],
    };
    const { lines, summaryRows } = readStatsWorkbook(Object.keys(sheets), (n) => sheets[n] ?? null);
    expect(lines).toMatchObject([{ name: 'יוחאי דדון', points: 17, three_pointers: 2, fouls: 3 }]);
    expect(summaryRows).toBeNull();
  });
});

describe('matching lines to the rosters', () => {
  it('matches by name, then a unique jersey, then part of the name', () => {
    expect(matchRosterPlayer('יוחאי דדון', null, roster)?.id).toBe('p1');
    expect(matchRosterPlayer('שם אחר', 12, roster)?.id).toBe('p3');
    expect(matchRosterPlayer('לוי', null, roster)?.id).toBe('p3');
    expect(matchRosterPlayer('לא קיים', 99, roster)).toBeNull();
  });

  it('uses each player once and lists what it could not match', () => {
    const line = (name: string, jersey: number | null) => ({
      name, jersey, points: 1, three_pointers: 0, fouls: 0,
      quarter_points: null, two_pointers: null, free_throws: null,
    });
    const { matched, unmatched } = matchStatLines(
      [line('דני כהן', 7), line('דני כהן', 7), line('זר', null)],
      roster,
    );
    expect(matched.map((m) => m.player.id)).toEqual(['p2']);
    expect(unmatched).toEqual(['דני כהן', 'זר']);
  });
});

describe('orientSummaryQuarters', () => {
  it('orients the quarter line to the game’s home and away by name', () => {
    // The cup game lists the guest as home — the names decide, not the form label.
    expect(orientSummaryQuarters(SUMMARY, 'בני נתניה', 'ידרסל חדרה')).toEqual({
      home: [14, 15, 16, 14],
      away: [18, 12, 20, 19],
    });
  });

  it('falls back to the form’s host/guest label when the names differ', () => {
    expect(orientSummaryQuarters(SUMMARY, 'קבוצה X', 'קבוצה Y')).toEqual({
      home: [18, 12, 20, 19],
      away: [14, 15, 16, 14],
    });
  });

  it('returns null without two team sections', () => {
    expect(orientSummaryQuarters(SUMMARY.slice(0, 4), 'א', 'ב')).toBeNull();
  });
});

describe('buildStatsTemplateRows', () => {
  it('lists both rosters with saved stats, and reads back as the same lines', () => {
    const rows = buildStatsTemplateRows(
      { label: 'בית: ידרסל חדרה', players: [{ id: 'p1', name: 'יוחאי דדון', jersey_number: 8 }] },
      { label: 'חוץ: בני נתניה', players: [] },
      new Map([['p1', { points: 17, three_pointers: 2, fouls: 3 }]]),
    );
    expect(rows[0]).toEqual(TEMPLATE_HEADER);
    expect(rows).toContainEqual(['יוחאי דדון', 8, 17, 2, 3]);
    expect(rows).toContainEqual(['(אין שחקנים פעילים)', '', '', '', '']);
    const { lines } = readStatsWorkbook(['s'], () => rows);
    expect(lines).toMatchObject([{ name: 'יוחאי דדון', points: 17 }]);
  });
});
