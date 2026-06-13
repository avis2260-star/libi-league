/**
 * Tests for /api/admin/game-stats/import — the per-game Excel box-score upload.
 *
 * The route parses the sheet, matches each line to a player on one of the
 * game's two teams, REPLACES that game's game_stats, and recalculates the
 * matched players' season totals.
 *
 * supabaseAdmin.from() is dispatched per table so 'games', 'players' and
 * 'game_stats' can each return their own shape. As elsewhere, req.formData()
 * is stubbed directly rather than building a real multipart body.
 */

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('@/lib/current-season', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue('2024-2025'),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import * as XLSX from 'xlsx';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult } from '../helpers/supabase-mock';
import { POST as importPOST } from '@/app/api/admin/game-stats/import/route';

const fromMock = supabaseAdmin.from as jest.Mock;

function mockFormReq(fields: Record<string, string | File | null>): NextRequest {
  const fd = { get: (key: string) => fields[key] ?? null } as unknown as FormData;
  return { formData: () => Promise.resolve(fd) } as unknown as NextRequest;
}

/** Build a real .xlsx File from an array-of-arrays sheet. */
function statsFile(rows: unknown[][]): File {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'סטטיסטיקה');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], 'stats.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const HEADER = ['שם השחקן', 'מספר', 'נקודות', 'שלשות', 'עבירות'];

/** Dispatch from() per table name. */
function mockTables(opts: { game?: unknown; roster?: unknown[]; gameStats?: unknown[] }) {
  fromMock.mockImplementation((table: string) => {
    if (table === 'games') return queryResult({ data: opts.game ?? null, error: null });
    if (table === 'players') return queryResult({ data: opts.roster ?? [], error: null });
    if (table === 'game_stats') return queryResult({ data: opts.gameStats ?? [], error: null });
    return queryResult({ data: null, error: null });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('game-stats/import POST', () => {
  it('returns 400 when the file is missing', async () => {
    const res = await importPOST(mockFormReq({ file: null, gameId: 'g1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('קובץ') });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns 400 when gameId is missing', async () => {
    const file = statsFile([HEADER, ['יוסי כהן', 7, 18, 2, 3]]);
    const res = await importPOST(mockFormReq({ file, gameId: null }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the sheet has no recognisable stat columns', async () => {
    const file = statsFile([['שם', 'מספר'], ['יוסי', 7]]); // no points column
    const res = await importPOST(mockFormReq({ file, gameId: 'g1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('סטטיסטיקה') });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('matches a player by name and replaces the game box score', async () => {
    mockTables({
      game: { id: 'g1', home_team_id: 'H', away_team_id: 'A' },
      roster: [{ id: 'p1', team_id: 'H', name: 'יוסי כהן', jersey_number: 7 }],
      // serves prev-select (.player_id) AND recalc-select (.points/...)
      gameStats: [{ player_id: 'p1', points: 18, three_pointers: 2, fouls: 3 }],
    });

    const file = statsFile([HEADER, ['יוסי כהן', 7, 18, 2, 3]]);
    const res = await importPOST(mockFormReq({ file, gameId: 'g1' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, matched: 1, unmatched: [] });
    expect(fromMock).toHaveBeenCalledWith('games');
    expect(fromMock).toHaveBeenCalledWith('players');
    expect(fromMock).toHaveBeenCalledWith('game_stats');
  });

  it('reports unmatched names and does NOT wipe stats when nothing matched', async () => {
    mockTables({
      game: { id: 'g1', home_team_id: 'H', away_team_id: 'A' },
      roster: [{ id: 'p1', team_id: 'H', name: 'דוד לוי', jersey_number: 11 }],
    });

    const file = statsFile([HEADER, ['שחקן לא קיים', '', 5, 0, 1]]);
    const res = await importPOST(mockFormReq({ file, gameId: 'g1' }));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.unmatched).toEqual(['שחקן לא קיים']);
    // The destructive delete must never run on a zero-match upload.
    const calledTables = fromMock.mock.calls.map((c) => c[0]);
    expect(calledTables).not.toContain('game_stats');
  });

  it('returns 404 when the game does not exist', async () => {
    mockTables({ game: null });
    const file = statsFile([HEADER, ['יוסי כהן', 7, 18, 2, 3]]);
    const res = await importPOST(mockFormReq({ file, gameId: 'missing' }));
    expect(res.status).toBe(404);
  });
});
