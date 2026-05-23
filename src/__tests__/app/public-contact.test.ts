// Resend is instantiated at module load (`new Resend(...)`). The factory below
// returns a client whose emails.send is our shared `mockSend` spy (the `mock`
// prefix lets Jest reference it inside the hoisted factory).
const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn(() => ({ emails: { send: mockSend } })),
}));
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult, postJson } from '../helpers/supabase-mock';
import { POST as contactPOST } from '@/app/api/contact/route';
import { POST as reportPOST } from '@/app/api/report-error/route';

const fromMock = supabaseAdmin.from as jest.Mock;

beforeEach(() => {
  mockSend.mockResolvedValue({ id: 'email-1' });
});

// ===========================================================================
// contact
// ===========================================================================

describe('contact POST', () => {
  it('rejects when any field is blank', async () => {
    expect((await contactPOST(postJson({ name: '', email: 'a@b.c', message: 'hi' }))).status).toBe(400);
    expect((await contactPOST(postJson({ name: 'A', email: '   ', message: 'hi' }))).status).toBe(400);
    expect((await contactPOST(postJson({ name: 'A', email: 'a@b.c', message: '' }))).status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('saves to the DB and sends an email on success', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await contactPOST(postJson({ name: ' Dana ', email: ' d@x.com ', message: ' hello ' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledWith('contact_submissions');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and does NOT send email when the DB insert fails', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'db down' } }));
    const res = await contactPOST(postJson({ name: 'A', email: 'a@b.c', message: 'hi' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'שגיאת שמירה' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 500 when sending the email throws', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    mockSend.mockRejectedValue(new Error('resend exploded'));
    const res = await contactPOST(postJson({ name: 'A', email: 'a@b.c', message: 'hi' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'שגיאה כללית' });
  });
});

// ===========================================================================
// report-error — email failure is NON-fatal (report already persisted)
// ===========================================================================

describe('report-error POST', () => {
  it('rejects a blank description', async () => {
    const res = await reportPOST(postJson({ pageUrl: '/x' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'נא לתאר את השגיאה' });
  });

  it('saves the report and sends an email', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await reportPOST(postJson({ pageUrl: '/standings', description: 'wrong score' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the DB insert fails', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'db down' } }));
    const res = await reportPOST(postJson({ description: 'x' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'שגיאת שמירה' });
  });

  it('still succeeds when the email send fails (report is already saved)', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    mockSend.mockRejectedValue(new Error('smtp down'));
    const res = await reportPOST(postJson({ description: 'x' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
