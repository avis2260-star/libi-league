// The admin guard is unit-tested separately (require-admin.test.ts); here we
// bypass it so each suite tests the handler logic itself.
jest.mock('@/lib/require-admin', () => ({
  requireAdmin: jest.fn().mockResolvedValue(null),
  assertAdmin: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/current-season', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue('2025-2026'),
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult, postJson, patchJson, deleteReq } from '../helpers/supabase-mock';

import * as cup from '@/app/api/admin/cup-games/route';
import * as playoff from '@/app/api/admin/playoff/route';
import * as syncLogs from '@/app/api/admin/sync-logs/route';

const fromMock = supabaseAdmin.from as jest.Mock;

// ===========================================================================
// cup-games
// ===========================================================================

describe('cup-games', () => {
  it('POST rejects when round/home/away are missing', async () => {
    expect((await cup.POST(postJson({ home_team: 'A', away_team: 'B' }))).status).toBe(400);
    expect((await cup.POST(postJson({ round: 'גמר', away_team: 'B' }))).status).toBe(400);
    expect((await cup.POST(postJson({ round: 'גמר', home_team: 'A' }))).status).toBe(400);
  });

  it('POST trims and creates a cup game', async () => {
    fromMock.mockReturnValue(queryResult({ data: { id: 'c1' }, error: null }));
    const res = await cup.POST(postJson({ round: ' גמר ', home_team: ' A ', away_team: ' B ', played: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ game: { id: 'c1' } });
  });

  it('PATCH requires an id', async () => {
    expect((await cup.PATCH(patchJson({ home_score: 10 }))).status).toBe(400);
  });

  it('PATCH updates a cup game', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await cup.PATCH(patchJson({ id: 'c1', home_score: 88, played: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('DELETE requires an id', async () => {
    expect((await cup.DELETE(deleteReq())).status).toBe(400);
  });

  it('DELETE removes a cup game', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect((await cup.DELETE(deleteReq('?id=c1'))).status).toBe(200);
  });
});

// ===========================================================================
// admin playoff — GET derives top-4 per division; PUT/PATCH mutate
// ===========================================================================

describe('admin playoff GET', () => {
  it('returns series, games and the top-4 teams per division from standings', async () => {
    const standings = [
      { name: 'N1', division: 'North', rank: 1 },
      { name: 'N2', division: 'North', rank: 2 },
      { name: 'N3', division: 'North', rank: 3 },
      { name: 'N4', division: 'North', rank: 4 },
      { name: 'N5', division: 'North', rank: 5 }, // beyond top-4 — excluded
      { name: 'S1', division: 'South', rank: 1 },
      { name: 'S2', division: 'South', rank: 2 },
    ];
    fromMock
      .mockReturnValueOnce(queryResult({ data: [{ series_number: 1 }] })) // playoff_series
      .mockReturnValueOnce(queryResult({ data: [{ game_number: 1 }] }))   // playoff_games
      .mockReturnValueOnce(queryResult({ data: standings }));             // standings

    const res = await playoff.GET();
    const body = await res.json();

    expect(body.northTeams).toEqual(['N1', 'N2', 'N3', 'N4']);
    expect(body.southTeams).toEqual(['S1', 'S2']);
    expect(body.series).toEqual([{ series_number: 1 }]);
    expect(body.games).toEqual([{ game_number: 1 }]);
  });

  it('returns empty arrays when there is no playoff data', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: null }))
      .mockReturnValueOnce(queryResult({ data: null }))
      .mockReturnValueOnce(queryResult({ data: null }));
    const body = await (await playoff.GET()).json();
    expect(body).toEqual({ series: [], games: [], northTeams: [], southTeams: [] });
  });
});

describe('admin playoff PUT / PATCH', () => {
  it('PUT updates series team names', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await playoff.PUT(postJson({ series_number: 1, team_a: 'A', team_b: 'B' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('PUT surfaces a DB error as 500', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'update failed' } }));
    const res = await playoff.PUT(postJson({ series_number: 1, team_a: 'A', team_b: 'B' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'update failed' });
  });

  it('PATCH upserts a game result', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await playoff.PATCH(patchJson({ series_number: 1, game_number: 2, home_score: 70, away_score: 65, played: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('PATCH surfaces a DB error as 500', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'conflict' } }));
    const res = await playoff.PATCH(patchJson({ series_number: 1, game_number: 1 }));
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// sync-logs — rollback restores snapshots
// ===========================================================================

describe('sync-logs GET', () => {
  it('returns recent logs for the current season', async () => {
    fromMock.mockReturnValue(queryResult({ data: [{ id: 'l1' }], error: null }));
    const res = await syncLogs.GET();
    expect(await res.json()).toEqual({ logs: [{ id: 'l1' }] });
  });
});

describe('sync-logs POST (rollback)', () => {
  it('rejects a request that is not action=rollback', async () => {
    const res = await syncLogs.POST(postJson({ action: 'nope', id: 'l1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'נדרש action=rollback ו-id' });
  });

  it('rejects a rollback with no id', async () => {
    const res = await syncLogs.POST(postJson({ action: 'rollback' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the log row is not found', async () => {
    // fetch snapshot → returns null data
    fromMock.mockReturnValueOnce(queryResult({ data: null, error: null }));
    const res = await syncLogs.POST(postJson({ action: 'rollback', id: 'missing' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'לוג לא נמצא' });
  });

  it('restores standings + results snapshots and marks the log rolled back', async () => {
    const log = {
      snapshot_standings: [{ name: 'חולון', rank: 1 }],
      snapshot_results: [{ home_team: 'חולון', away_team: 'בני נתניה' }],
    };
    fromMock
      .mockReturnValueOnce(queryResult({ data: log, error: null })) // fetch snapshot
      .mockReturnValueOnce(queryResult({ error: null }))            // delete standings
      .mockReturnValueOnce(queryResult({ error: null }))            // insert standings
      .mockReturnValueOnce(queryResult({ error: null }))            // delete results
      .mockReturnValueOnce(queryResult({ error: null }))            // insert results
      .mockReturnValueOnce(queryResult({ error: null }));           // mark rolled back

    const res = await syncLogs.POST(postJson({ action: 'rollback', id: 'l1' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledTimes(6);
  });

  it('returns 500 when restoring throws', async () => {
    const log = { snapshot_standings: [{ name: 'חולון' }], snapshot_results: [] };
    fromMock
      .mockReturnValueOnce(queryResult({ data: log, error: null })) // fetch snapshot
      .mockReturnValueOnce(queryResult({ error: new Error('delete failed') })); // delete standings throws
    const res = await syncLogs.POST(postJson({ action: 'rollback', id: 'l1' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'delete failed' });
  });
});
