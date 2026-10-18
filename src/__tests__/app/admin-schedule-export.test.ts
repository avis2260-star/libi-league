// The admin guard is unit-tested separately (require-admin.test.ts); here we
// bypass it so each suite tests the handler logic itself.
jest.mock('@/lib/require-admin', () => ({
  requireAdmin: jest.fn().mockResolvedValue(null),
  assertAdmin: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Tests for the two Excel-history admin routes:
 *   - /api/admin/export-schedule — the season's schedule as an .xlsx
 *   - /api/admin/sync-logs/file  — signed download link for a stored upload
 */

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

jest.mock('@/lib/current-season', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue('2026-2027'),
}));

jest.mock('@/lib/season-schedule', () => ({
  getSeasonSchedule: jest.fn(),
}));

import * as XLSX from 'xlsx';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSeasonSchedule } from '@/lib/season-schedule';
import { queryResult } from '../helpers/supabase-mock';
import { GET as exportSchedule } from '@/app/api/admin/export-schedule/route';
import { GET as downloadFile } from '@/app/api/admin/sync-logs/file/route';
import type { ScheduleEntry } from '@/lib/libi-schedule';

const fromMock = supabaseAdmin.from as jest.Mock;
const storageFrom = (supabaseAdmin.storage as unknown as { from: jest.Mock }).from;
const scheduleMock = getSeasonSchedule as jest.Mock;

const req = (path: string) => new NextRequest(`https://libi.test${path}`);

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockReturnValue(queryResult({ data: [], error: null }));
});

// ─── export-schedule ────────────────────────────────────────────────────────

describe('export-schedule GET', () => {
  const schedule: ScheduleEntry[] = [
    { round: 2, date: '2026-10-31', homeTeam: 'גלי בת-ים', awayTeam: 'חולון', division: 'North' },
    { round: 1, date: '2026-10-24', homeTeam: 'אופק רחובות', awayTeam: 'קריית מלאכי', division: 'South', location: 'TBD' },
    { round: 1, date: '2026-10-24', homeTeam: 'חולון', awayTeam: 'בני נתניה', division: 'North', time: '20:30:00', location: 'אולם חולון' },
  ];

  async function readWorkbook(res: Response) {
    return XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' });
  }
  const rows = (wb: XLSX.WorkBook, name: string) =>
    XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' });

  it('returns a workbook with round dates for both divisions plus per-division sheets', async () => {
    scheduleMock.mockResolvedValue(schedule);
    fromMock.mockReturnValue(
      queryResult({
        data: [
          {
            game_date: '2026-10-24', status: 'Finished', home_score: 78, away_score: 65,
            home_team: { name: 'חולון' }, away_team: [{ name: 'בני נתניה' }],
          },
        ],
        error: null,
      }),
    );

    const res = await exportSchedule(req('/api/admin/export-schedule?season=2026-2027'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
    expect(res.headers.get('content-disposition')).toContain('libi-schedule-2026-2027.xlsx');
    expect(scheduleMock).toHaveBeenCalledWith('2026-2027');

    const wb = await readWorkbook(res);
    expect(wb.SheetNames).toEqual(['תאריכי מחזורים', 'כל המשחקים', 'מחוז צפון', 'מחוז דרום']);

    expect(rows(wb, 'תאריכי מחזורים').slice(1)).toEqual([
      [1, '24.10.2026 (שבת)', '24.10.2026 (שבת)', 1, 1],
      [2, '31.10.2026 (שבת)', '', 1, 0],
    ]);

    const all = rows(wb, 'כל המשחקים');
    expect(all[0][0]).toBe('מחזור');
    // Sorted round → North before South; the played game carries its score.
    expect(all.slice(1)).toEqual([
      [1, '24.10.2026', 'שבת', '20:30', 'צפון', 'חולון', 'בני נתניה', 'אולם חולון', '78:65'],
      [1, '24.10.2026', 'שבת', '', 'דרום', 'אופק רחובות', 'קריית מלאכי', '', ''],
      [2, '31.10.2026', 'שבת', '', 'צפון', 'גלי בת-ים', 'חולון', '', ''],
    ]);
    expect(rows(wb, 'מחוז צפון')).toHaveLength(3); // header + 2 games
    expect(rows(wb, 'מחוז דרום')).toHaveLength(2); // header + 1 game
  });

  it('defaults to the current season when none (or a malformed one) is given', async () => {
    scheduleMock.mockResolvedValue(schedule);
    await exportSchedule(req('/api/admin/export-schedule?season=bad'));
    expect(scheduleMock).toHaveBeenCalledWith('2026-2027');
  });

  it('still exports the schedule when the results query fails', async () => {
    scheduleMock.mockResolvedValue(schedule);
    fromMock.mockImplementation(() => {
      throw new Error('games table unavailable');
    });
    const res = await exportSchedule(req('/api/admin/export-schedule'));
    expect(res.status).toBe(200);
  });

  it('returns 404 when the season has no schedule', async () => {
    scheduleMock.mockResolvedValue([]);
    const res = await exportSchedule(req('/api/admin/export-schedule?season=2030-2031'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain('2030-2031');
  });
});

// ─── sync-logs/file ─────────────────────────────────────────────────────────

describe('sync-logs/file GET', () => {
  it('returns 400 without an id', async () => {
    const res = await downloadFile(req('/api/admin/sync-logs/file'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the log does not exist', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: null }));
    const res = await downloadFile(req('/api/admin/sync-logs/file?id=missing'));
    expect(res.status).toBe(404);
  });

  it('returns 404 with an explanation when that upload was never stored', async () => {
    fromMock.mockReturnValue(queryResult({ data: { filename: 'old.xlsx', file_path: null }, error: null }));
    const res = await downloadFile(req('/api/admin/sync-logs/file?id=l1'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain('לא נשמר');
  });

  it('returns a short-lived signed link named after the original file', async () => {
    fromMock.mockReturnValue(
      queryResult({ data: { filename: 'לוח 2026.xlsx', file_path: '2026-2027/1-upload.xlsx' }, error: null }),
    );
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.test/signed' },
      error: null,
    });
    storageFrom.mockReturnValue({ createSignedUrl });

    const res = await downloadFile(req('/api/admin/sync-logs/file?id=l1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://storage.test/signed', filename: 'לוח 2026.xlsx' });
    expect(storageFrom).toHaveBeenCalledWith('excel-uploads');
    expect(createSignedUrl).toHaveBeenCalledWith('2026-2027/1-upload.xlsx', 60, { download: 'לוח 2026.xlsx' });
  });

  it('points at the migration when the file_path column is missing', async () => {
    fromMock.mockReturnValue(
      queryResult({ data: null, error: { message: 'column sync_logs.file_path does not exist' } }),
    );
    const res = await downloadFile(req('/api/admin/sync-logs/file?id=l1'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('20261018_sync_logs_file.sql');
  });
});
