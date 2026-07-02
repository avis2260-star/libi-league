// The admin guard is unit-tested separately (require-admin.test.ts); here we
// bypass it so each suite tests the handler logic itself.
jest.mock('@/lib/require-admin', () => ({
  requireAdmin: jest.fn().mockResolvedValue(null),
  assertAdmin: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Tests for /api/admin/hall-of-fame
 *
 * The route has two I/O surfaces:
 *   1. supabaseAdmin.from()  — standard CRUD on league_history_{seasons,records}
 *   2. global.fetch          — runSQL() for the one-time setup/init action
 */

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult, postJson } from '../helpers/supabase-mock';
import { POST } from '@/app/api/admin/hall-of-fame/route';

const fromMock = supabaseAdmin.from as jest.Mock;

// The route reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as
// module-level constants (const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!),
// so they are captured at import time before any beforeEach runs.
// We only assert that fetch was *called* (not the exact URL) for the setup/init test.

let fetchMock: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

// ===========================================================================
// setup/init  — runs raw SQL via fetch
// ===========================================================================

describe('hall-of-fame POST — setup/init', () => {
  it('runs DDL SQL and returns ok', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    const res = await POST(postJson({ type: 'setup', action: 'init' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // The URL contains the module-level env var (undefined in test); we verify the
    // path suffix and method rather than the full URL.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/pg-meta/v1/query'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns 500 when the SQL endpoint responds non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, text: async () => 'syntax error' });
    const res = await POST(postJson({ type: 'setup', action: 'init' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'syntax error' });
  });
});

// ===========================================================================
// season CRUD
// ===========================================================================

describe('hall-of-fame POST — season', () => {
  it('add inserts a season row', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await POST(postJson({ type: 'season', action: 'add', year: '2024', champion_name: 'חולון' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('add returns 400 on a DB error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'duplicate year' } }));
    const res = await POST(postJson({ type: 'season', action: 'add', year: '2024' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'duplicate year' });
  });

  it('edit updates the season row by id', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await POST(postJson({ type: 'season', action: 'edit', id: 's1', year: '2023', champion_name: 'מכבי' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('edit returns 400 on a DB error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'not found' } }));
    const res = await POST(postJson({ type: 'season', action: 'edit', id: 'bad', year: '2020' }));
    expect(res.status).toBe(400);
  });

  it('delete removes the season row', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await POST(postJson({ type: 'season', action: 'delete', id: 's1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

// ===========================================================================
// cup CRUD
// ===========================================================================

describe('hall-of-fame POST — cup/upsert', () => {
  it('returns 400 when year is missing', async () => {
    const res = await POST(postJson({ type: 'cup', action: 'upsert', cup_holder_name: 'X' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'year required' });
  });

  it('updates cup_holder on an existing year row', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: { id: 'row1' }, error: null }))  // maybeSingle
      .mockReturnValue(queryResult({ error: null }));                             // update

    const res = await POST(postJson({ type: 'cup', action: 'upsert', year: '2024', cup_holder_name: 'בית שמש' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, id: 'row1' });
  });

  it('inserts a new season row when the year does not exist yet', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: null, error: null }))   // maybeSingle → no row
      .mockReturnValue(queryResult({ data: { id: 'newRow' }, error: null })); // insert.single

    const res = await POST(postJson({ type: 'cup', action: 'upsert', year: '2025', cup_holder_name: 'אשדוד' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, id: 'newRow' });
  });
});

describe('hall-of-fame POST — cup/edit', () => {
  it('returns 400 when id or year is missing', async () => {
    const res = await POST(postJson({ type: 'cup', action: 'edit', cup_holder_name: 'X' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'id and year required' });
  });

  it('returns 404 when the row does not exist', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: null }));
    const res = await POST(postJson({ type: 'cup', action: 'edit', id: 'bad', year: '2024' }));
    expect(res.status).toBe(404);
  });

  it('does a simple update when the year is unchanged', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: { id: 'r1', year: '2024' }, error: null })) // fetch current
      .mockReturnValue(queryResult({ error: null }));                                        // update

    const res = await POST(postJson({ type: 'cup', action: 'edit', id: 'r1', year: '2024', cup_holder_name: 'X' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, id: 'r1' });
  });

  it('clears old cup and moves to existing year row when year changes', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: { id: 'old', year: '2023' }, error: null })) // fetch current
      .mockReturnValueOnce(queryResult({ error: null }))                                     // clear old
      .mockReturnValueOnce(queryResult({ data: { id: 'new' }, error: null }))               // find new year
      .mockReturnValue(queryResult({ error: null }));                                         // update new

    const res = await POST(postJson({ type: 'cup', action: 'edit', id: 'old', year: '2024', cup_holder_name: 'Y' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, moved: true, id: 'new' });
  });

  it('inserts a new season row when the target year has no row', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: { id: 'old', year: '2023' }, error: null })) // fetch current
      .mockReturnValueOnce(queryResult({ error: null }))                                     // clear old
      .mockReturnValueOnce(queryResult({ data: null, error: null }))                        // find new year → not found
      .mockReturnValue(queryResult({ data: { id: 'created' }, error: null }));              // insert

    const res = await POST(postJson({ type: 'cup', action: 'edit', id: 'old', year: '2030', cup_holder_name: 'Z' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, moved: true, id: 'created' });
  });
});

describe('hall-of-fame POST — cup/delete', () => {
  it('nullifies cup_holder_name without deleting the season row', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await POST(postJson({ type: 'cup', action: 'delete', id: 'r1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

// ===========================================================================
// record CRUD
// ===========================================================================

describe('hall-of-fame POST — record', () => {
  it('add inserts a record row', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await POST(postJson({ type: 'record', action: 'add', title: 'שיא ניקוד', holder: 'משה', value: '52' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('edit updates a record row', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await POST(postJson({ type: 'record', action: 'edit', id: 'rec1', title: 'שיא ניקוד', value: '54' }));
    expect(res.status).toBe(200);
  });

  it('delete removes a record row', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await POST(postJson({ type: 'record', action: 'delete', id: 'rec1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 400 on a DB error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'constraint violation' } }));
    const res = await POST(postJson({ type: 'record', action: 'add', title: '' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'constraint violation' });
  });
});

// ===========================================================================
// invalid type / action
// ===========================================================================

describe('hall-of-fame POST — invalid inputs', () => {
  it('returns 400 for an unrecognised type', async () => {
    const res = await POST(postJson({ type: 'unknown', action: 'add' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid type or action' });
  });

  it('returns 400 for a season with an unrecognised action', async () => {
    const res = await POST(postJson({ type: 'season', action: 'list' }));
    expect(res.status).toBe(400);
  });
});
