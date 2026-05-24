/**
 * Tests for /api/admin/sync-excel-file — the route handler that accepts a raw
 * .xlsx upload, parses it (via the functions covered in excel-sync-parsers.test)
 * and writes standings / results / games / cup / sync-log rows.
 *
 * The pure parsing is already covered elsewhere; here we exercise the handler's
 * orchestration: file validation, "no data" guard, and the happy-path write
 * sequence. We keep the teams table empty so the heavy games auto-upsert branch
 * is skipped (it is wrapped in try/catch and non-fatal anyway).
 */

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('@/lib/current-season', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue('2024-2025'),
}));

import * as XLSX from 'xlsx';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult } from '../helpers/supabase-mock';
import { POST } from '@/app/api/admin/sync-excel-file/route';

const fromMock = supabaseAdmin.from as jest.Mock;

function mockFileReq(file: File | null): NextRequest {
  const fd = { get: () => file } as unknown as FormData;
  return { formData: () => Promise.resolve(fd) } as unknown as NextRequest;
}

function xlsxFile(sheets: Record<string, unknown[][]>, name = 'data.xlsx'): File {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: every DB call resolves to empty data with no error. Routes that
  // need specific responses override per test.
  fromMock.mockReturnValue(queryResult({ data: [], error: null }));
});

describe('sync-excel-file POST', () => {
  it('returns 400 when no file is uploaded', async () => {
    const res = await POST(mockFileReq(null));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No file uploaded' });
  });

  it('returns 400 when the workbook contains no recognisable league data', async () => {
    const file = xlsxFile({ 'טבלאות': [['header', 'only'], ['unknown club', 1, 2]] });
    const res = await POST(mockFileReq(file));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No data found in Excel file' });
  });

  it('syncs a standings sheet and reports the team count', async () => {
    // 'חולון' is a known North team → parseStandings yields one North row.
    const file = xlsxFile({
      'טבלאות ליגה': [[1, 'חולון', 14, 10, 4, 360, 300, 60, 0, 0, 24]],
    });

    const res = await POST(mockFileReq(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('צפון');
  });

  it('syncs both standings and results and counts results', async () => {
    const file = xlsxFile({
      'טבלאות': [[1, 'חולון', 14, 10, 4, 360, 300, 60, 0, 0, 24]],
      'תוצאות': [
        ['תאריך', 'מחזור', 'מחוז', 'בית', 'נק', 'נק', 'חוץ'],
        ['1.5.25', 1, 'צפון', 'חולון', 90, 80, 'בני נתניה'],
      ],
    });

    const res = await POST(mockFileReq(file));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('תוצאות משחקים');
  });

  it('returns 500 when the standings delete fails', async () => {
    const file = xlsxFile({ 'טבלאות': [[1, 'חולון', 14, 10, 4, 360, 300, 60, 0, 0, 24]] });

    // round_dates upsert (skipped: no results), then Promise.all snapshot (2),
    // then standings DELETE — make the DELETE fail.
    fromMock
      .mockReturnValueOnce(queryResult({ data: [], error: null }))  // snapshot standings
      .mockReturnValueOnce(queryResult({ data: [], error: null }))  // snapshot results
      .mockReturnValueOnce(queryResult({ error: { message: 'delete blew up' } })); // standings delete

    const res = await POST(mockFileReq(file));
    expect(res.status).toBe(500);
    // thrown value is a plain object, so the catch emits the generic message
    expect(await res.json()).toMatchObject({ error: 'Sync failed' });
  });
});
