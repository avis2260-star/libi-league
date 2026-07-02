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
import { POST, PATCH, DELETE } from '@/app/api/admin/players/route';
import { queryResult, postJson, patchJson, deleteReq } from '../helpers/supabase-mock';

const fromMock = supabaseAdmin.from as jest.Mock;

// ===========================================================================
// POST /api/admin/players — create a player
// ===========================================================================

describe('players POST', () => {
  it('rejects a request missing the name with 400', async () => {
    const res = await POST(postJson({ team_id: 'team-1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'שם וקבוצה חובה' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects a request missing the team_id with 400', async () => {
    const res = await POST(postJson({ name: 'יוסי כהן' }));
    expect(res.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('inserts the player and returns the created row', async () => {
    const created = { id: 'p1', name: 'יוסי כהן', team_id: 'team-1' };
    fromMock.mockReturnValue(queryResult({ data: created, error: null }));

    const res = await POST(postJson({ name: 'יוסי כהן', team_id: 'team-1', jersey_number: 7 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ player: created });
    expect(fromMock).toHaveBeenCalledWith('players');
  });

  it('returns 500 with the error message when the insert fails', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: new Error('duplicate key') }));

    const res = await POST(postJson({ name: 'יוסי כהן', team_id: 'team-1' }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'duplicate key' });
  });
});

// ===========================================================================
// PATCH /api/admin/players — update a player
// ===========================================================================

describe('players PATCH', () => {
  it('rejects a request without an id with 400', async () => {
    const res = await PATCH(patchJson({ name: 'New Name' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'חסר id' });
  });

  it('updates an allowed field and returns success', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));

    const res = await PATCH(patchJson({ id: 'p1', name: 'שם חדש', is_active: false }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledWith('players');
  });

  it('returns 500 when the update errors', async () => {
    fromMock.mockReturnValue(queryResult({ error: new Error('update failed') }));

    const res = await PATCH(patchJson({ id: 'p1', name: 'x' }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'update failed' });
  });

  it('succeeds even when only non-whitelisted fields are sent (no-op update)', async () => {
    // 'points' is not in the allowed list — it should be silently dropped.
    fromMock.mockReturnValue(queryResult({ error: null }));

    const res = await PATCH(patchJson({ id: 'p1', points: 999 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});

// ===========================================================================
// DELETE /api/admin/players — delete a player
// ===========================================================================

describe('players DELETE', () => {
  it('rejects a request without an id query param with 400', async () => {
    const res = await DELETE(deleteReq());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'חסר id' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('deletes the player and returns success', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));

    const res = await DELETE(deleteReq('?id=p1'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledWith('players');
  });

  it('returns 500 when the delete errors', async () => {
    fromMock.mockReturnValue(queryResult({ error: new Error('fk violation') }));

    const res = await DELETE(deleteReq('?id=p1'));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'fk violation' });
  });
});
