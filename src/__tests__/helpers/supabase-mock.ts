// Shared test helpers for the admin API route suites.
//
// NOT a test file (no .test suffix) so Jest's testMatch ignores it.

import { NextRequest } from 'next/server';

export type DbResponse = { data?: unknown; error?: unknown };

/**
 * A chainable + thenable stand-in for a Supabase query builder.
 *
 * Every builder method returns the same builder, so any chain length works
 * (.from().select().eq().order(), .from().update().eq(), etc.). The builder
 * resolves to `response` in three ways the routes actually use it:
 *   • awaited directly         — `await sb.from('t').delete().eq('id', x)`
 *   • terminated with .single()      — `.insert(...).select().single()`
 *   • terminated with .maybeSingle() — `.select(...).eq(...).maybeSingle()`
 */
export function queryResult(response: DbResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    or: () => builder,
    ilike: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    single: () => Promise.resolve(response),
    maybeSingle: () => Promise.resolve(response),
    then: (res: (v: DbResponse) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(response).then(res, rej),
  };
  return builder;
}

const BASE = 'https://libi.test/api/admin';

export function postJson(body: unknown, url = BASE): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

export function patchJson(body: unknown, url = BASE): NextRequest {
  return new NextRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

export function deleteReq(query = '', url = BASE): NextRequest {
  return new NextRequest(`${url}${query}`, { method: 'DELETE' });
}
