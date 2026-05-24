jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { GET, POST, PATCH, DELETE } from '@/app/api/admin/seasons/route';
import { queryResult, postJson, patchJson, deleteReq } from '../helpers/supabase-mock';

const fromMock = supabaseAdmin.from as jest.Mock;

describe('seasons GET', () => {
  it('returns seasons ordered by creation', async () => {
    const seasons = [{ id: 's1', name: '2025-2026' }];
    fromMock.mockReturnValue(queryResult({ data: seasons, error: null }));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ seasons });
  });

  it('returns 500 on error', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: new Error('boom') }));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'boom' });
  });
});

describe('seasons POST', () => {
  it('rejects a request with no name', async () => {
    const res = await POST(postJson({ year: '2026' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'שם חובה' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('creates a season and returns the row', async () => {
    const season = { id: 's1', name: '2026-2027', status: 'active' };
    fromMock.mockReturnValue(queryResult({ data: season, error: null }));
    const res = await POST(postJson({ name: '2026-2027' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ season });
  });

  it('returns 500 when the insert fails', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: new Error('insert failed') }));
    const res = await POST(postJson({ name: '2026-2027' }));
    expect(res.status).toBe(500);
  });
});

describe('seasons PATCH', () => {
  it('rejects a request without an id', async () => {
    const res = await PATCH(patchJson({ status: 'archived' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'חסר id' });
  });

  it('rejects when no editable fields are supplied', async () => {
    const res = await PATCH(patchJson({ id: 's1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'אין שדות לעדכון' });
  });

  it('rejects an empty name', async () => {
    const res = await PATCH(patchJson({ id: 's1', name: '   ' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'שם העונה לא יכול להיות ריק' });
  });

  it('updates the status toggle', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await PATCH(patchJson({ id: 's1', status: 'archived' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('returns 500 when the update errors', async () => {
    fromMock.mockReturnValue(queryResult({ error: new Error('nope') }));
    const res = await PATCH(patchJson({ id: 's1', name: 'valid' }));
    expect(res.status).toBe(500);
  });
});

describe('seasons DELETE', () => {
  it('rejects a request without an id query param', async () => {
    const res = await DELETE(deleteReq());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'חסר id' });
  });

  it('deletes the season', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await DELETE(deleteReq('?id=s1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
