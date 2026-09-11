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
import { GET, POST, PATCH } from '@/app/api/admin/teams/route';
import { queryResult, patchJson, postJson } from '../helpers/supabase-mock';

const fromMock = supabaseAdmin.from as jest.Mock;

// ===========================================================================
// GET /api/admin/teams
// ===========================================================================

describe('teams GET', () => {
  it('returns the list of teams', async () => {
    const teams = [{ id: 't1', name: 'חולון' }];
    fromMock.mockReturnValue(queryResult({ data: teams, error: null }));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ teams });
  });

  it('returns 500 with the error message on query failure', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: { message: 'db down' } }));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'db down' });
  });
});

// ===========================================================================
// POST /api/admin/teams — create a team
// ===========================================================================

describe('teams POST', () => {
  it('rejects an empty (whitespace-only) name with 400', async () => {
    const res = await POST(postJson({ name: '   ' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'שם הקבוצה חובה' });
  });

  it('rejects a name longer than 80 characters with 400', async () => {
    const res = await POST(postJson({ name: 'א'.repeat(81) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'שם הקבוצה ארוך מדי (מקסימום 80 תווים)' });
  });

  it('rejects an invalid division with 400', async () => {
    const res = await POST(postJson({ name: 'קבוצה חדשה', division: 'East' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'מחוז לא תקין — חייב להיות North או South' });
  });

  it('returns 409 when a team with the same name already exists', async () => {
    fromMock.mockReturnValueOnce(queryResult({ data: { id: 'dup' }, error: null })); // clash found
    const res = await POST(postJson({ name: 'חולון' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'קבוצה בשם הזה כבר קיימת' });
  });

  it('creates the team and returns the inserted row', async () => {
    const team = {
      id: 't9', name: 'קבוצה חדשה', logo_url: null,
      captain_name: '', contact_info: null, division: 'North',
    };
    fromMock
      .mockReturnValueOnce(queryResult({ data: null, error: null })) // clash check: none
      .mockReturnValueOnce(queryResult({ data: team, error: null })); // insert().select().single()

    const res = await POST(postJson({ name: 'קבוצה חדשה', division: 'North' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ team });
  });
});

// ===========================================================================
// PATCH /api/admin/teams — rename / set logo / set division
// ===========================================================================

describe('teams PATCH', () => {
  it('rejects a request without an id with 400', async () => {
    const res = await PATCH(patchJson({ name: 'New' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'חסר id' });
  });

  it('rejects an empty (whitespace-only) name with 400', async () => {
    const res = await PATCH(patchJson({ id: 't1', name: '   ' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'שם הקבוצה לא יכול להיות ריק' });
  });

  it('rejects a name longer than 80 characters with 400', async () => {
    const res = await PATCH(patchJson({ id: 't1', name: 'א'.repeat(81) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'שם הקבוצה ארוך מדי (מקסימום 80 תווים)' });
  });

  it('returns 409 when another team already uses the requested name', async () => {
    // First call: the name-clash lookup → returns a clashing row.
    fromMock.mockReturnValueOnce(queryResult({ data: { id: 'other' }, error: null }));

    const res = await PATCH(patchJson({ id: 't1', name: 'חולון' }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'קבוצה אחרת כבר משתמשת בשם הזה' });
  });

  it('renames the team when the name is free', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: null, error: null })) // clash check: no clash
      .mockReturnValueOnce(queryResult({ error: null }));            // update

    const res = await PATCH(patchJson({ id: 't1', name: 'חולון חדש' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('updates only the logo without a name-clash check', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));

    const res = await PATCH(patchJson({ id: 't1', logo_url: 'https://cdn/logo.png' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    // Only the update call — no clash lookup
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('updates the division without a name-clash check', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));

    const res = await PATCH(patchJson({ id: 't1', division: 'South' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid division with 400', async () => {
    const res = await PATCH(patchJson({ id: 't1', division: 'East' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'מחוז לא תקין — חייב להיות North או South' });
  });

  it('returns 400 when there is nothing to update', async () => {
    const res = await PATCH(patchJson({ id: 't1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'אין שדות לעדכון' });
  });
});
