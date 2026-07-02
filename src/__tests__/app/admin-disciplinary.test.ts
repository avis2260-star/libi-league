// The admin guard is unit-tested separately (require-admin.test.ts); here we
// bypass it so each suite tests the handler logic itself.
jest.mock('@/lib/require-admin', () => ({
  requireAdmin: jest.fn().mockResolvedValue(null),
  assertAdmin: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('@/lib/current-season', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue('2025-2026'),
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { GET, POST, PATCH, DELETE } from '@/app/api/admin/disciplinary/route';
import { queryResult, postJson, patchJson, deleteReq } from '../helpers/supabase-mock';

const fromMock = supabaseAdmin.from as jest.Mock;

describe('disciplinary GET', () => {
  it('returns records for the current season', async () => {
    const records = [{ id: 'd1', player_name: 'יוסי', type: 'technical' }];
    fromMock.mockReturnValue(queryResult({ data: records, error: null }));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ records });
  });
});

describe('disciplinary POST', () => {
  it('rejects a record missing the player name', async () => {
    const res = await POST(postJson({ type: 'technical' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'שם שחקן וסוג חובה' });
  });

  it('rejects a record missing the type', async () => {
    const res = await POST(postJson({ player_name: 'יוסי' }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid disciplinary type', async () => {
    const res = await POST(postJson({ player_name: 'יוסי', type: 'banned-for-life' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'סוג עבירה לא תקין: banned-for-life' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('accepts each allowed type', async () => {
    fromMock.mockReturnValue(queryResult({ data: { id: 'd1' }, error: null }));
    for (const type of ['technical', 'unsportsmanlike', 'ejection', 'suspension']) {
      const res = await POST(postJson({ player_name: 'יוסי', type }));
      expect(res.status).toBe(200);
    }
  });

  it('creates a record and returns it', async () => {
    const record = { id: 'd1', player_name: 'יוסי', type: 'technical', season: '2025-2026' };
    fromMock.mockReturnValue(queryResult({ data: record, error: null }));
    const res = await POST(postJson({ player_name: 'יוסי', type: 'technical', round: '5' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ record });
  });

  it('returns 500 when the insert fails', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: new Error('insert failed') }));
    const res = await POST(postJson({ player_name: 'יוסי', type: 'technical' }));
    expect(res.status).toBe(500);
  });
});

describe('disciplinary PATCH', () => {
  it('rejects a request without an id', async () => {
    const res = await PATCH(patchJson({ type: 'technical' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'חסר id' });
  });

  it('rejects an invalid type on update', async () => {
    const res = await PATCH(patchJson({ id: 'd1', type: 'nonsense' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'סוג עבירה לא תקין: nonsense' });
  });

  it('updates a record and returns it', async () => {
    const record = { id: 'd1', player_name: 'דוד', type: 'ejection' };
    fromMock.mockReturnValue(queryResult({ data: record, error: null }));
    const res = await PATCH(patchJson({ id: 'd1', player_name: 'דוד', type: 'ejection' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ record });
  });
});

describe('disciplinary DELETE', () => {
  it('rejects a request without an id query param', async () => {
    const res = await DELETE(deleteReq());
    expect(res.status).toBe(400);
  });

  it('deletes the record', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await DELETE(deleteReq('?id=d1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
