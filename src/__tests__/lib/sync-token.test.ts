import { hasValidSyncToken, isScriptedExcelSync, EXCEL_SYNC_PATH } from '@/lib/sync-token';

const KEY = 'a'.repeat(30) + '0123456789abcdef'; // 46 chars
const saved = process.env.EXCEL_SYNC_TOKEN;

beforeEach(() => {
  process.env.EXCEL_SYNC_TOKEN = KEY;
});
afterAll(() => {
  if (saved === undefined) delete process.env.EXCEL_SYNC_TOKEN;
  else process.env.EXCEL_SYNC_TOKEN = saved;
});

const auth = (value?: string) => new Headers(value === undefined ? {} : { authorization: value });

describe('hasValidSyncToken', () => {
  it('accepts the configured key as a Bearer token (scheme is case-insensitive)', () => {
    expect(hasValidSyncToken(auth(`Bearer ${KEY}`))).toBe(true);
    expect(hasValidSyncToken(auth(`bearer ${KEY}`))).toBe(true);
  });

  it('rejects a wrong, partial or longer key', () => {
    expect(hasValidSyncToken(auth(`Bearer ${KEY.slice(0, -1)}x`))).toBe(false);
    expect(hasValidSyncToken(auth(`Bearer ${KEY.slice(0, 20)}`))).toBe(false);
    expect(hasValidSyncToken(auth(`Bearer ${KEY}extra`))).toBe(false);
  });

  it('rejects a missing header, another scheme, or no headers at all', () => {
    expect(hasValidSyncToken(auth())).toBe(false);
    expect(hasValidSyncToken(auth(KEY))).toBe(false);
    expect(hasValidSyncToken(auth(`Basic ${KEY}`))).toBe(false);
    expect(hasValidSyncToken(undefined)).toBe(false);
  });

  it('stays closed when EXCEL_SYNC_TOKEN is unset or too short', () => {
    delete process.env.EXCEL_SYNC_TOKEN;
    expect(hasValidSyncToken(auth('Bearer '))).toBe(false);
    expect(hasValidSyncToken(auth('Bearer undefined'))).toBe(false);

    process.env.EXCEL_SYNC_TOKEN = 'short-key';
    expect(hasValidSyncToken(auth('Bearer short-key'))).toBe(false);
  });
});

describe('isScriptedExcelSync', () => {
  const req = (method: string, pathname: string, value?: string) => ({
    method,
    nextUrl: { pathname },
    headers: auth(value),
  });

  it('is true only for POST to the Excel-sync route with the right key', () => {
    expect(isScriptedExcelSync(req('POST', EXCEL_SYNC_PATH, `Bearer ${KEY}`))).toBe(true);
  });

  it('does not open any other route or method', () => {
    expect(isScriptedExcelSync(req('POST', '/api/admin/teams', `Bearer ${KEY}`))).toBe(false);
    expect(isScriptedExcelSync(req('DELETE', EXCEL_SYNC_PATH, `Bearer ${KEY}`))).toBe(false);
    expect(isScriptedExcelSync(req('GET', EXCEL_SYNC_PATH, `Bearer ${KEY}`))).toBe(false);
    expect(isScriptedExcelSync(req('POST', EXCEL_SYNC_PATH))).toBe(false);
  });
});
