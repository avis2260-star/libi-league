jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { queryResult, postJson, patchJson, deleteReq } from '../helpers/supabase-mock';

import * as announcements from '@/app/api/admin/announcements/route';
import * as rules from '@/app/api/admin/rules/route';
import * as officials from '@/app/api/admin/officials/route';
import * as leagueSettings from '@/app/api/admin/league-settings/route';

const fromMock = supabaseAdmin.from as jest.Mock;

// ===========================================================================
// announcements
// ===========================================================================

describe('announcements', () => {
  it('GET returns the list', async () => {
    fromMock.mockReturnValue(queryResult({ data: [{ id: 'a1' }], error: null }));
    const res = await announcements.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ announcements: [{ id: 'a1' }] });
  });

  it('POST rejects a missing message', async () => {
    const res = await announcements.POST(postJson({ type: 'ticker' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'הודעה חובה' });
  });

  it('POST creates an announcement', async () => {
    fromMock.mockReturnValue(queryResult({ data: { id: 'a1', message: 'hi' }, error: null }));
    const res = await announcements.POST(postJson({ message: 'hi' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ announcement: { id: 'a1', message: 'hi' } });
  });

  it('PATCH rejects a request missing id or active', async () => {
    const res = await announcements.PATCH(patchJson({ id: 'a1' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'חסר id או active' });
  });

  it('PATCH toggles active=false', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await announcements.PATCH(patchJson({ id: 'a1', active: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('DELETE rejects a missing id', async () => {
    const res = await announcements.DELETE(deleteReq());
    expect(res.status).toBe(400);
  });

  it('DELETE removes the announcement', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await announcements.DELETE(deleteReq('?id=a1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});

// ===========================================================================
// rules (revalidates /about)
// ===========================================================================

describe('rules', () => {
  it('POST rejects a missing title', async () => {
    const res = await rules.POST(postJson({ body: 'text' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'כותרת ותיאור חובה' });
  });

  it('POST rejects a missing body', async () => {
    const res = await rules.POST(postJson({ title: 'Title' }));
    expect(res.status).toBe(400);
  });

  it('POST creates a rule and revalidates /about', async () => {
    fromMock.mockReturnValue(queryResult({ data: { id: 'r1' }, error: null }));
    const res = await rules.POST(postJson({ title: 'T', body: 'B', sort_order: 2 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rule: { id: 'r1' } });
    expect(revalidatePath).toHaveBeenCalledWith('/about');
  });

  it('PATCH rejects a missing id', async () => {
    const res = await rules.PATCH(patchJson({ title: 'x' }));
    expect(res.status).toBe(400);
  });

  it('PATCH updates and revalidates', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await rules.PATCH(patchJson({ id: 'r1', title: 'New' }));
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith('/about');
  });

  it('DELETE removes a rule and revalidates', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await rules.DELETE(deleteReq('?id=r1'));
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith('/about');
  });
});

// ===========================================================================
// officials
// ===========================================================================

describe('officials', () => {
  it('GET returns officials', async () => {
    fromMock.mockReturnValue(queryResult({ data: [{ id: 'o1' }], error: null }));
    const res = await officials.GET();
    expect(await res.json()).toEqual({ officials: [{ id: 'o1' }] });
  });

  it('POST rejects when name or role is missing', async () => {
    expect((await officials.POST(postJson({ name: 'Ref' }))).status).toBe(400);
    expect((await officials.POST(postJson({ role: 'referee' }))).status).toBe(400);
  });

  it('POST creates an official', async () => {
    fromMock.mockReturnValue(queryResult({ data: { id: 'o1' }, error: null }));
    const res = await officials.POST(postJson({ name: 'Ref', role: 'referee' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ official: { id: 'o1' } });
  });

  it('DELETE requires an id', async () => {
    expect((await officials.DELETE(deleteReq())).status).toBe(400);
  });
});

// ===========================================================================
// league-settings (upsert)
// ===========================================================================

describe('league-settings', () => {
  it('GET returns key/value settings', async () => {
    fromMock.mockReturnValue(queryResult({ data: [{ key: 'current_season', value: '2025-2026' }], error: null }));
    const res = await leagueSettings.GET();
    expect(await res.json()).toEqual({ settings: [{ key: 'current_season', value: '2025-2026' }] });
  });

  it('POST rejects a missing key', async () => {
    const res = await leagueSettings.POST(postJson({ value: 'x' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'key ו-value חובה' });
  });

  it('POST rejects an undefined value', async () => {
    const res = await leagueSettings.POST(postJson({ key: 'foo' }));
    expect(res.status).toBe(400);
  });

  it('POST upserts a setting', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await leagueSettings.POST(postJson({ key: 'current_season', value: '2026-2027' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('POST accepts an empty-string value (only undefined is rejected)', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await leagueSettings.POST(postJson({ key: 'note', value: '' }));
    expect(res.status).toBe(200);
  });
});
