jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    storage: { from: jest.fn(), createBucket: jest.fn() },
  },
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult } from '../helpers/supabase-mock';
import {
  EXCEL_UPLOADS_BUCKET,
  safeObjectName,
  storeUploadedExcel,
  listSyncLogs,
} from '@/lib/excel-uploads';

const storage = supabaseAdmin.storage as unknown as { from: jest.Mock; createBucket: jest.Mock };
const fromMock = supabaseAdmin.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('safeObjectName', () => {
  it('keeps ASCII names and the extension', () => {
    expect(safeObjectName('Libi League 2026.xlsx')).toBe('Libi_League_2026.xlsx');
  });
  it('replaces a Hebrew-only name with a placeholder', () => {
    expect(safeObjectName('לוח משחקים.xlsx')).toBe('upload.xlsx');
  });
  it('keeps the ASCII parts of a mixed name', () => {
    expect(safeObjectName('לוח 2026-2027.xls')).toBe('2026-2027.xls');
  });
  it('falls back to .xlsx for a missing or unexpected extension', () => {
    expect(safeObjectName('schedule')).toBe('schedule.xlsx');
    expect(safeObjectName('schedule.exe')).toBe('schedule.xlsx');
  });
});

describe('storeUploadedExcel', () => {
  const buf = new ArrayBuffer(8);

  it('uploads to the private bucket under the season and returns the path', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    storage.from.mockReturnValue({ upload });

    const path = await storeUploadedExcel(buf, 'Schedule.xlsx', '2026-2027');
    expect(storage.from).toHaveBeenCalledWith(EXCEL_UPLOADS_BUCKET);
    expect(path).toMatch(/^2026-2027\/\d+-Schedule\.xlsx$/);
    expect(upload).toHaveBeenCalledWith(path, buf, expect.objectContaining({ upsert: false }));
  });

  it('creates the private bucket when it is missing, then retries', async () => {
    const upload = jest
      .fn()
      .mockResolvedValueOnce({ error: { message: 'Bucket not found' } })
      .mockResolvedValueOnce({ error: null });
    storage.from.mockReturnValue({ upload });
    storage.createBucket.mockResolvedValue({ error: null });

    const path = await storeUploadedExcel(buf, 'a.xlsx', '2026-2027');
    expect(storage.createBucket).toHaveBeenCalledWith(EXCEL_UPLOADS_BUCKET, { public: false });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(path).not.toBeNull();
  });

  it('returns null instead of throwing when storage fails', async () => {
    storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: { message: 'quota exceeded' } }),
    });
    await expect(storeUploadedExcel(buf, 'a.xlsx', '2026-2027')).resolves.toBeNull();
  });
});

describe('listSyncLogs', () => {
  it('includes file_path when the column exists', async () => {
    fromMock.mockReturnValueOnce(queryResult({ data: [{ id: 'l1', file_path: 'p' }], error: null }));
    await expect(listSyncLogs('2026-2027')).resolves.toEqual([{ id: 'l1', file_path: 'p' }]);
  });

  it('falls back to the old columns before the migration is run', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: null, error: { message: 'column sync_logs.file_path does not exist' } }))
      .mockReturnValueOnce(queryResult({ data: [{ id: 'l1' }], error: null }));
    await expect(listSyncLogs('2026-2027')).resolves.toEqual([{ id: 'l1' }]);
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('throws when even the fallback query fails', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: { message: 'no table' } }));
    await expect(listSyncLogs('2026-2027')).rejects.toEqual({ message: 'no table' });
  });
});
