// The admin guard is unit-tested separately (require-admin.test.ts); here we
// bypass it so each suite tests the handler logic itself.
jest.mock('@/lib/require-admin', () => ({
  requireAdmin: jest.fn().mockResolvedValue(null),
  assertAdmin: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { GET } from '@/app/api/admin/dedup-players/route';
import { queryResult } from '../helpers/supabase-mock';

const fromMock = supabaseAdmin.from as jest.Mock;

describe('dedup-players GET', () => {
  it('returns 500 when the players query yields no data', async () => {
    fromMock.mockReturnValue(queryResult({ data: null }));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'query failed' });
  });

  it('reports no duplicates and skips the delete when every row is unique', async () => {
    const rows = [
      { id: '1', name: 'יוסי', team_id: 'A' },
      { id: '2', name: 'דוד', team_id: 'A' },
      { id: '3', name: 'יוסי', team_id: 'B' }, // same name, different team — not a dupe
    ];
    fromMock.mockReturnValue(queryResult({ data: rows }));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'No duplicates found', deleted: 0 });
    // Only the SELECT ran; no DELETE.
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('deletes later duplicates (same name + team) and keeps the first id', async () => {
    const rows = [
      { id: '1', name: 'יוסי', team_id: 'A' }, // keep (first)
      { id: '2', name: 'יוסי', team_id: 'A' }, // delete (dupe)
      { id: '3', name: 'יוסי', team_id: 'A' }, // delete (dupe)
      { id: '4', name: 'דוד', team_id: 'A' },  // keep (unique)
    ];
    fromMock
      .mockReturnValueOnce(queryResult({ data: rows })) // SELECT
      .mockReturnValueOnce(queryResult({ error: null })); // DELETE

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Done', deleted: 2 });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('returns 500 with the error message when the delete fails', async () => {
    const rows = [
      { id: '1', name: 'יוסי', team_id: 'A' },
      { id: '2', name: 'יוסי', team_id: 'A' },
    ];
    fromMock
      .mockReturnValueOnce(queryResult({ data: rows }))
      .mockReturnValueOnce(queryResult({ error: { message: 'delete blocked' } }));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'delete blocked' });
  });
});
