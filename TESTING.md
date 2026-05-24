# Testing Guide

This project uses **Jest + ts-jest** for unit tests. The suite covers the
backend/logic layers (API routes, server actions, `lib/` utilities, auth,
middleware) and a couple of representative React components.

```bash
npm test              # run everything once
npm run test:watch    # re-run on file change
npm run test:coverage # generate a coverage report (coverage/ is gitignored)
```

CI runs `npm test` on every push to `main`/`master` and on every PR
(`.github/workflows/test.yml`).

---

## Do I need to write a test for new code?

Tests only cover the exact code they were written for. The existing suite
**protects against regressions** in already-covered code, but it does **not**
automatically test anything new you add.

| You are adding… | Write a test? |
| --- | --- |
| A new **API route** with validation/branching | **Yes** — copy the closest existing suite |
| A new **server action** in `admin/actions.ts` | **Yes** |
| A new **`lib/` function** with real logic | **Yes** |
| A new **page** or display-only component | Optional — low ROI for static UI |
| A component with **interactive logic** (forms, state) | Recommended — see `ContactForm.test.tsx` |
| A trivial change (copy text, styling) | No |

Rule of thumb: **if it has logic that could silently break (validation,
data transforms, conditional branches), it deserves a test.**

---

## Layout & conventions

```
src/__tests__/
  helpers/supabase-mock.ts   # shared chainable Supabase builder + request helpers
  lib/*.test.ts              # pure utility tests (node env)
  app/*.test.ts              # API route + server action tests (node env)
  components/*.test.tsx       # React component tests (jsdom env — see docblock)
  middleware.test.ts
```

- Test files end in `.test.ts` / `.test.tsx` and live under `src/__tests__/`.
- API/logic tests run in the fast **node** environment (the default).
- Component tests need the DOM — add this docblock at the **top of the file**:
  ```ts
  /** @jest-environment jsdom */
  ```
- Import app code with the `@/` alias, e.g. `import { POST } from '@/app/api/.../route'`.

---

## The shared Supabase mock (`helpers/supabase-mock.ts`)

`queryResult(response)` returns a chainable, thenable stand-in for a Supabase
query builder. Every builder method (`select`, `insert`, `eq`, `order`,
`or`, `ilike`, …) returns the same builder, so any chain length works. It
resolves to your `response` in the three ways routes consume it:

```ts
await sb.from('t').delete().eq('id', x)          // awaited directly
await sb.from('t').insert(...).select().single() // .single()
await sb.from('t').select().eq(...).maybeSingle() // .maybeSingle()
```

Request builders for route handlers: `postJson(body)`, `patchJson(body)`,
`deleteReq('?id=x')`.

---

## Template: a new API route test

```ts
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult, postJson, deleteReq } from '../helpers/supabase-mock';
import * as route from '@/app/api/admin/my-route/route';

const fromMock = supabaseAdmin.from as jest.Mock;
beforeEach(() => jest.clearAllMocks());

describe('my-route', () => {
  it('rejects an invalid body', async () => {
    const res = await route.POST(postJson({}));
    expect(res.status).toBe(400);
  });

  it('inserts on a valid body', async () => {
    fromMock.mockReturnValue(queryResult({ data: { id: 'x' }, error: null }));
    const res = await route.POST(postJson({ name: 'ok' }));
    expect(res.status).toBe(200);
  });
});
```

**Multiple sequential `from()` calls** in one handler? Drive each one with
`mockReturnValueOnce` in call order:

```ts
fromMock
  .mockReturnValueOnce(queryResult({ data: [], error: null }))  // 1st from()
  .mockReturnValueOnce(queryResult({ error: null }));           // 2nd from()
```

---

## Template: a server action test (`admin/actions.ts`)

Server actions need the cache + season modules mocked too:

```ts
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/current-season', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue('2024-2025'),
  clearCurrentSeasonCache: jest.fn(),
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult } from '../helpers/supabase-mock';
import { myAction } from '@/app/admin/actions';

const fromMock = supabaseAdmin.from as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockReturnValue(queryResult({ data: [], error: null }));
});
```

---

## Routes that read an uploaded file (`req.formData()`)

Don't build a real multipart `NextRequest` — Next.js validates `File` private
fields and throws. Stub `formData()` directly instead:

```ts
function mockFormReq(fields: Record<string, string | File | null>): NextRequest {
  const fd = { get: (k: string) => fields[k] ?? null } as unknown as FormData;
  return { formData: () => Promise.resolve(fd) } as unknown as NextRequest;
}

const res = await route.POST(
  mockFormReq({ file: new File(['data'], 'x.pdf', { type: 'application/pdf' }) }),
);
```

For Supabase **Storage** routes, mock the storage client too:

```ts
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn(), storage: { from: jest.fn() } },
}));
const storageMock = supabaseAdmin.storage as unknown as { from: jest.Mock };
storageMock.from.mockReturnValue({
  upload:       jest.fn().mockResolvedValue({ error: null }),
  getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.test/x' } }),
  remove:       jest.fn().mockResolvedValue({ error: null }),
});
```

---

## Excel / xlsx routes

Build a real workbook buffer in memory and feed it through the same
`XLSX.read` pipeline the route uses (see `lib/excel-sync-parsers.test.ts` and
`app/admin-sync-excel-file.test.ts`):

```ts
import * as XLSX from 'xlsx';
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'טבלאות');
const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
const file = new File([buf], 'data.xlsx', { type: '...spreadsheetml.sheet' });
```

Keep heavy parsing logic in `src/lib/` (importable + unit-testable) rather than
inline in the route handler — that's why the Excel parsers were extracted to
`lib/excel-sync-parsers.ts`.

---

## Two gotchas worth knowing

1. **Plain error objects ≠ `Error` instances.** Several routes do
   `if (error) throw error`, where `error` is a plain Supabase object
   `{ message: '...' }`. Their `catch` blocks then emit a **generic** message
   (`err instanceof Error ? err.message : 'Upload failed'`), not the DB string.
   Assert the generic message, not the DB one.

2. **Module-level env reads.** Code like
   `const KEY = process.env.X!` runs at **import time**, before any
   `beforeEach`. Setting `process.env.X` in `beforeEach` is too late — the
   constant already captured `undefined`. Either set it before the import or
   assert loosely (e.g. `expect.stringContaining('/path')`).
