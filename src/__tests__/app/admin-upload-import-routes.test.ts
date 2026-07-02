// The admin guard is unit-tested separately (require-admin.test.ts); here we
// bypass it so each suite tests the handler logic itself.
jest.mock('@/lib/require-admin', () => ({
  requireAdmin: jest.fn().mockResolvedValue(null),
  assertAdmin: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Tests for the three file-ingest admin routes:
 *   - /api/admin/players/import  (.txt / .xlsx roster → players rows)
 *   - /api/admin/players/upload  (player photo → storage, returns URL)
 *   - /api/admin/teams/upload    (team logo → storage, returns URL)
 *
 * As with the other storage routes, req.formData() is the only request
 * interaction, so we stub it directly rather than build a multipart body.
 */

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

import * as XLSX from 'xlsx';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult } from '../helpers/supabase-mock';

import { POST as importPOST } from '@/app/api/admin/players/import/route';
import { POST as playerUploadPOST } from '@/app/api/admin/players/upload/route';
import { POST as teamUploadPOST } from '@/app/api/admin/teams/upload/route';

const fromMock = supabaseAdmin.from as jest.Mock;
const storageMock = supabaseAdmin.storage as unknown as { from: jest.Mock };

function mockFormReq(fields: Record<string, string | File | null>): NextRequest {
  const fd = { get: (key: string) => fields[key] ?? null } as unknown as FormData;
  return { formData: () => Promise.resolve(fd) } as unknown as NextRequest;
}

function makeStorageBuilder(uploadErr: unknown = null, publicUrl = 'https://cdn.test/photo.jpg') {
  return {
    upload: jest.fn().mockResolvedValue({ error: uploadErr }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl } }),
  };
}

/** Builds a real .xlsx buffer with player names in column A. */
function xlsxWithNames(names: string[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(names.map((n) => [n]));
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf as ArrayBuffer;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// players/import
// ===========================================================================

describe('players/import POST', () => {
  it('returns 400 when the file is missing', async () => {
    const res = await importPOST(mockFormReq({ file: null, team_id: 't1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('קבוצה') });
  });

  it('returns 400 when team_id is missing', async () => {
    const file = new File(['יוסי\nדוד'], 'roster.txt', { type: 'text/plain' });
    const res = await importPOST(mockFormReq({ file, team_id: null }));
    expect(res.status).toBe(400);
  });

  it('parses a .txt roster, one name per line, and inserts rows', async () => {
    fromMock.mockReturnValue(
      queryResult({ data: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], error: null }),
    );
    const file = new File(['יוסי\nדוד\n\n  משה  '], 'roster.txt', { type: 'text/plain' });

    const res = await importPOST(mockFormReq({ file, team_id: 't1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // 3 non-empty trimmed names → 3 inserted
    expect(body.inserted).toBe(3);
  });

  it('parses an .xlsx roster from the first column', async () => {
    fromMock.mockReturnValue(queryResult({ data: [{ id: 'p1' }, { id: 'p2' }], error: null }));
    const buf = xlsxWithNames(['רונן', 'אבי']);
    const file = new File([buf], 'roster.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const res = await importPOST(mockFormReq({ file, team_id: 't1' }));
    expect(res.status).toBe(200);
    expect((await res.json()).inserted).toBe(2);
  });

  it('returns 400 for an unsupported file extension', async () => {
    const file = new File(['data'], 'roster.pdf', { type: 'application/pdf' });
    const res = await importPOST(mockFormReq({ file, team_id: 't1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('.txt') });
  });

  it('returns 400 when the file yields no names', async () => {
    const file = new File(['\n  \n'], 'roster.txt', { type: 'text/plain' });
    const res = await importPOST(mockFormReq({ file, team_id: 't1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('לא נמצאו') });
  });

  it('returns 500 when the DB insert fails', async () => {
    // The route does `if (error) throw error` with the plain Supabase error
    // object, so the catch emits the generic "שגיאה בעיבוד הקובץ" message.
    fromMock.mockReturnValue(queryResult({ data: null, error: { message: 'insert failed' } }));
    const file = new File(['יוסי'], 'roster.txt', { type: 'text/plain' });
    const res = await importPOST(mockFormReq({ file, team_id: 't1' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'שגיאה בעיבוד הקובץ' });
  });
});

// ===========================================================================
// players/upload + teams/upload (near-identical photo upload routes)
// ===========================================================================

describe('players/upload POST', () => {
  it('returns 400 when no file is provided', async () => {
    const res = await playerUploadPOST(mockFormReq({ file: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No file provided' });
  });

  it('uploads the photo and returns its public URL', async () => {
    const sb = makeStorageBuilder(null, 'https://cdn.test/player.jpg');
    storageMock.from.mockReturnValue(sb);
    const file = new File(['img'], 'face.jpg', { type: 'image/jpeg' });

    const res = await playerUploadPOST(mockFormReq({ file }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://cdn.test/player.jpg' });
    expect(sb.upload).toHaveBeenCalled();
  });

  it('returns 500 when the storage upload fails', async () => {
    const sb = makeStorageBuilder({ message: 'storage error' });
    storageMock.from.mockReturnValue(sb);
    const file = new File(['img'], 'face.jpg', { type: 'image/jpeg' });

    const res = await playerUploadPOST(mockFormReq({ file }));
    expect(res.status).toBe(500);
  });
});

describe('teams/upload POST', () => {
  it('returns 400 when no file is provided', async () => {
    const res = await teamUploadPOST(mockFormReq({ file: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No file provided' });
  });

  it('uploads the logo under team-logos/ and returns its public URL', async () => {
    const sb = makeStorageBuilder(null, 'https://cdn.test/team-logos/logo.png');
    storageMock.from.mockReturnValue(sb);
    const file = new File(['img'], 'logo.png', { type: 'image/png' });

    const res = await teamUploadPOST(mockFormReq({ file }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://cdn.test/team-logos/logo.png' });
    // the upload path must be prefixed with team-logos/
    const uploadedPath = sb.upload.mock.calls[0][0] as string;
    expect(uploadedPath).toMatch(/^team-logos\//);
  });

  it('returns 500 when the storage upload fails', async () => {
    const sb = makeStorageBuilder({ message: 'storage error' });
    storageMock.from.mockReturnValue(sb);
    const file = new File(['img'], 'logo.png', { type: 'image/png' });

    const res = await teamUploadPOST(mockFormReq({ file }));
    expect(res.status).toBe(500);
  });
});
