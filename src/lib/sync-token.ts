/**
 * Secret key that lets the desktop PowerShell script (scripts/sync-libi.ps1)
 * upload the league Excel file without a browser login.
 *
 * Every /api/admin route needs a logged-in admin session (plus MFA from an
 * untrusted network), which a script can't have. This key opens ONE route
 * only — POST /api/admin/sync-excel-file — and nothing else. It's configured
 * in the EXCEL_SYNC_TOKEN environment variable (Vercel → Settings →
 * Environment Variables). When that's missing or shorter than
 * MIN_SYNC_TOKEN_LENGTH, the key path is closed and only a logged-in admin can
 * sync (fail closed).
 *
 * Used by the middleware too, so no Node-only APIs here.
 */
export const EXCEL_SYNC_PATH = '/api/admin/sync-excel-file';
export const MIN_SYNC_TOKEN_LENGTH = 32;

function configuredToken(): string | null {
  const token = (process.env.EXCEL_SYNC_TOKEN ?? '').trim();
  return token.length >= MIN_SYNC_TOKEN_LENGTH ? token : null;
}

/** Compare without stopping at the first differing character. */
function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** True when the request carries `Authorization: Bearer <EXCEL_SYNC_TOKEN>`. */
export function hasValidSyncToken(headers: Headers | null | undefined): boolean {
  const expected = configuredToken();
  if (!expected) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(headers?.get('authorization') ?? '');
  return match ? constantTimeEqual(match[1], expected) : false;
}

/** The desktop script's upload: the one request the key may let through. */
export function isScriptedExcelSync(request: {
  method: string;
  nextUrl: { pathname: string };
  headers: Headers;
}): boolean {
  return (
    request.method === 'POST' &&
    request.nextUrl.pathname === EXCEL_SYNC_PATH &&
    hasValidSyncToken(request.headers)
  );
}
