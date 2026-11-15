// The admin guard is unit-tested separately (require-admin.test.ts).
jest.mock('@/lib/require-admin', () => ({
  requireAdmin: jest.fn().mockResolvedValue(null),
  assertAdmin: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('@/lib/current-season', () => ({ getCurrentSeason: jest.fn().mockResolvedValue('2026-2027') }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import * as XLSX from 'xlsx';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult } from '../helpers/supabase-mock';
import { POST } from '@/app/api/admin/cup-stats/import/route';
import { GET as templateGET } from '@/app/api/admin/cup-stats/template/route';

const fromMock = supabaseAdmin.from as jest.Mock;

function formReq(fields: Record<string, string | File | null>): NextRequest {
  const fd = { get: (k: string) => fields[k] ?? null } as unknown as FormData;
  return { formData: () => Promise.resolve(fd) } as unknown as NextRequest;
}

function xlsx(sheets: Record<string, unknown[][]>): File {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], 'stats.xlsx');
}

const HEADER = ['שם השחקן', 'מספר', 'נקודות', 'שלשות', 'עבירות'];
const SUMMARY_HEADER = [
  "מס' שחקן", 'שם השחקן', 'רבע 1', 'רבע 2', 'רבע 3', 'רבע 4', 'הארכה',
  "1 נק'", "2 נק'", "3 נק'", 'סה"כ נק\'', 'עבירות', "טכ'", 'ב"ס',
];

const teams = [{ id: 'H', name: 'גלי בת-ים' }, { id: 'A', name: 'ראשון גפן לציון' }];
const roster = [
  { id: 'p1', team_id: 'H', name: 'יוסי כהן', jersey_number: 7 },
  { id: 'p2', team_id: 'A', name: 'דני לוי', jersey_number: 9 },
];

type Recorded = { deleted: boolean; upserted: Record<string, unknown>[]; gameUpdate: Record<string, unknown> | null };

function mockDb(game: Record<string, unknown> | null) {
  const rec: Recorded = { deleted: false, upserted: [], gameUpdate: null };
  fromMock.mockImplementation((table: string) => {
    if (table === 'teams') return queryResult({ data: teams, error: null });
    if (table === 'players') return queryResult({ data: roster, error: null });
    if (table === 'cup_game_stats') {
      const b = queryResult({ data: [], error: null });
      b.delete = () => { rec.deleted = true; return b; };
      b.upsert = (rows: Record<string, unknown>[]) => { rec.upserted = rows; return b; };
      return b;
    }
    if (table === 'cup_games') {
      const b = queryResult({ data: game, error: null });
      b.update = (patch: Record<string, unknown>) => {
        rec.gameUpdate = patch;
        return queryResult({ data: { ...game, ...patch }, error: null });
      };
      return b;
    }
    return queryResult({ data: null, error: null });
  });
  return rec;
}

const baseGame = {
  id: 'c1', home_team: 'גלי בת-ים', away_team: 'ראשון גפן לציון',
  home_score: null, away_score: null, played: false, season: '2025-2026',
};

beforeEach(() => jest.clearAllMocks());

describe('cup-stats/import POST', () => {
  it('requires a file and a game', async () => {
    expect((await POST(formReq({ file: null, cupGameId: 'c1' }))).status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("replaces the game's stats under the game's season and fills a missing score", async () => {
    const rec = mockDb(baseGame);
    const file = xlsx({ 'סטטיסטיקה': [HEADER, ['יוסי כהן', 7, 70, 4, 2], ['דני לוי', 9, 72, 1, 3]] });
    const res = await POST(formReq({ file, cupGameId: 'c1' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(rec.deleted).toBe(true);
    expect(rec.upserted.map((r) => [r.player_id, r.team_id, r.points, r.season])).toEqual([
      ['p1', 'H', 70, '2025-2026'],
      ['p2', 'A', 72, '2025-2026'],
    ]);
    expect(rec.gameUpdate).toEqual({ home_score: 70, away_score: 72, played: true });
    expect(body.message).toContain('תוצאה עודכנה: 70–72');
    expect(body.stats).toHaveLength(2);
    expect(body.game).toMatchObject({ home_score: 70, away_score: 72 });
  });

  it('never changes an entered score, and says when the points disagree', async () => {
    const rec = mockDb({ ...baseGame, home_score: 70, away_score: 72, played: true });
    const file = xlsx({ 'סטטיסטיקה': [HEADER, ['יוסי כהן', 7, 60, 0, 0], ['דני לוי', 9, 72, 0, 0]] });
    const body = await (await POST(formReq({ file, cupGameId: 'c1' }))).json();
    expect(rec.gameUpdate).toBeNull();
    expect(body.message).toContain('לא תואם לתוצאה הרשמית 70–72');
  });

  it('fills the quarters from the official scoresheet', async () => {
    const rec = mockDb({ ...baseGame, home_score: 70, away_score: 72, played: true });
    const file = xlsx({
      'סיכום': [
        ["קבוצה א' (מארחת): גלי בת-ים"], SUMMARY_HEADER,
        [7, 'יוסי כהן', 20, 20, 15, 15, 0, 0, 0, 0, 70, 2, 0, 0],
        ['', 'סה"כ קבוצה', 20, 20, 15, 15, 0, 0, 0, 0, 70, 2, 0, 0],
        [],
        ["קבוצה ב' (מתארחת): ראשון גפן לציון"], SUMMARY_HEADER,
        [9, 'דני לוי', 18, 18, 18, 18, 0, 0, 0, 0, 72, 3, 0, 0],
        ['', 'סה"כ קבוצה', 18, 18, 18, 18, 0, 0, 0, 0, 72, 3, 0, 0],
      ],
    });
    const body = await (await POST(formReq({ file, cupGameId: 'c1' }))).json();
    expect(rec.gameUpdate).toEqual({ home_quarters: [20, 20, 15, 15], away_quarters: [18, 18, 18, 18] });
    expect(body.message).toContain('ניקוד רבעים עודכן');
    expect(body.message).toContain('תואם לתוצאה הרשמית');
  });

  it('changes nothing when no player in the file matches', async () => {
    const rec = mockDb(baseGame);
    const file = xlsx({ 'סטטיסטיקה': [HEADER, ['זר לגמרי', 99, 10, 0, 0]] });
    const res = await POST(formReq({ file, cupGameId: 'c1' }));
    expect(res.status).toBe(422);
    expect((await res.json()).unmatched).toEqual(['זר לגמרי']);
    expect(rec.deleted).toBe(false);
  });

  it('returns 404 for an unknown game', async () => {
    mockDb(null);
    const file = xlsx({ 'סטטיסטיקה': [HEADER, ['יוסי כהן', 7, 10, 0, 0]] });
    expect((await POST(formReq({ file, cupGameId: 'nope' }))).status).toBe(404);
  });
});

describe('cup-stats/template GET', () => {
  it("returns a workbook with both teams' rosters", async () => {
    mockDb(baseGame);
    const res = await templateGET(new NextRequest('https://libi.test/api/admin/cup-stats/template?cupGameId=c1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('cup-game-stats-c1.xlsx');
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['סטטיסטיקה'], { header: 1 });
    const names = rows.map((r) => r[0]);
    expect(names).toEqual(expect.arrayContaining(['— בית: גלי בת-ים —', 'יוסי כהן', '— חוץ: ראשון גפן לציון —', 'דני לוי']));
  });

  it('requires a game id', async () => {
    const res = await templateGET(new NextRequest('https://libi.test/api/admin/cup-stats/template'));
    expect(res.status).toBe(400);
  });
});
