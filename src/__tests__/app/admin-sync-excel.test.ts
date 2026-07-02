// The admin guard is unit-tested separately (require-admin.test.ts); here we
// bypass it so each suite tests the handler logic itself.
jest.mock('@/lib/require-admin', () => ({
  requireAdmin: jest.fn().mockResolvedValue(null),
  assertAdmin: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Tests for /api/admin/sync-excel
 *
 * The route accepts pre-parsed standings and game results (already a JSON
 * object, not raw xlsx bytes) and writes them to the DB under the current
 * season.  It delegates xlsx parsing to the /api/admin/sync-excel-file route;
 * here we only test the DB-write logic.
 */

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('@/lib/current-season', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue('2024-2025'),
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult, postJson } from '../helpers/supabase-mock';
import { POST } from '@/app/api/admin/sync-excel/route';

const fromMock = supabaseAdmin.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

const northTeam = { rank: 1, name: 'חולון', games: 10, wins: 8, losses: 2, pf: 820, pa: 720, diff: 100, techni: 0, penalty: 0, pts: 18 };
const southTeam = { rank: 1, name: 'אשדוד', games: 10, wins: 7, losses: 3, pf: 800, pa: 750, diff: 50,  techni: 0, penalty: 0, pts: 17 };
const gameRow   = { round: 1, date: '2024-11-01', division: 'North', home_team: 'חולון', away_team: 'מכבי', home_score: 90, away_score: 80, techni: false, techni_note: '' };

describe('sync-excel POST', () => {
  it('deletes old standings and results, then inserts new data', async () => {
    // Four sequential from() calls: delete standings, insert standings, delete results, insert results
    fromMock
      .mockReturnValueOnce(queryResult({ error: null }))   // delete standings
      .mockReturnValueOnce(queryResult({ error: null }))   // insert standings
      .mockReturnValueOnce(queryResult({ error: null }))   // delete results
      .mockReturnValueOnce(queryResult({ error: null }));  // insert results

    const res = await POST(postJson({ north: [northTeam], south: [southTeam], results: [gameRow] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('צפון');
    expect(body.message).toContain('דרום');
    expect(body.message).toContain('תוצאות');
  });

  it('skips the standings insert when both north and south are empty', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ error: null }))   // delete results
      .mockReturnValueOnce(queryResult({ error: null }));  // insert results

    const res = await POST(postJson({ north: [], south: [], results: [gameRow] }));
    expect(res.status).toBe(200);
    // called twice (delete results + insert results), NOT four times
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('skips the results insert when the results array is empty', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ error: null }))   // delete standings
      .mockReturnValueOnce(queryResult({ error: null }))   // insert standings
      .mockReturnValueOnce(queryResult({ error: null }));  // delete results (still runs)

    const res = await POST(postJson({ north: [northTeam], south: [], results: [] }));
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledTimes(3);
  });

  it('returns 500 when the standings delete fails', async () => {
    // The route does `if (delErr) throw delErr` where delErr is a plain Supabase
    // error object (not an Error instance), so the catch returns 'Sync failed'.
    fromMock.mockReturnValue(queryResult({ error: { message: 'db constraint' } }));

    const res = await POST(postJson({ north: [northTeam], south: [], results: [] }));
    expect(res.status).toBe(500);
    // Generic message because thrown value is not an Error instance
    expect(await res.json()).toMatchObject({ error: 'Sync failed' });
  });

  it('returns 500 when the results insert fails', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ error: null }))   // delete standings
      .mockReturnValueOnce(queryResult({ error: null }))   // insert standings
      .mockReturnValueOnce(queryResult({ error: null }))   // delete results
      .mockReturnValueOnce(queryResult({ error: { message: 'insert failed' } })); // insert results

    const res = await POST(postJson({ north: [northTeam], south: [], results: [gameRow] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Sync failed' });
  });

  it('builds the success message correctly when only results are provided', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ error: null }))   // delete results
      .mockReturnValueOnce(queryResult({ error: null }));  // insert results

    const res = await POST(postJson({ north: [], south: [], results: [gameRow, gameRow] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('2 תוצאות');
  });
});
