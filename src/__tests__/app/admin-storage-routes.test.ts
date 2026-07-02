// The admin guard is unit-tested separately (require-admin.test.ts); here we
// bypass it so each suite tests the handler logic itself.
jest.mock('@/lib/require-admin', () => ({
  requireAdmin: jest.fn().mockResolvedValue(null),
  assertAdmin: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Tests for the three storage-backed admin routes:
 *   - /api/admin/logo       (team logo, image-only)
 *   - /api/admin/takanon    (league constitution, PDF/DOCX/TXT)
 *   - /api/admin/download-forms (downloadable forms, multiple types + size limit)
 *
 * All three routes call req.formData() as their only interaction with the
 * request object, so we mock that method directly instead of constructing
 * a real NextRequest with a multipart body (which triggers Next.js private-
 * field validation on File objects).
 */

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    storage: {
      createBucket: jest.fn(),
      from: jest.fn(),
    },
  },
}));

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { queryResult, deleteReq } from '../helpers/supabase-mock';

import * as logo from '@/app/api/admin/logo/route';
import * as takanon from '@/app/api/admin/takanon/route';
import * as downloadForms from '@/app/api/admin/download-forms/route';

// ─── shared mock handles ────────────────────────────────────────────────────

const fromMock = supabaseAdmin.from as jest.Mock;
const storageMock = supabaseAdmin.storage as unknown as {
  createBucket: jest.Mock;
  from: jest.Mock;
};

function makeStorageBuilder(overrides: Partial<{
  uploadErr: unknown;
  removeErr: unknown;
  publicUrl: string;
}> = {}) {
  return {
    upload:       jest.fn().mockResolvedValue({ error: overrides.uploadErr ?? null }),
    getPublicUrl: jest.fn().mockReturnValue({
      data: { publicUrl: overrides.publicUrl ?? 'https://cdn.test/file.png' },
    }),
    remove: jest.fn().mockResolvedValue({ error: overrides.removeErr ?? null }),
  };
}

/**
 * Creates a minimal mock of NextRequest where only formData() is exercised.
 * The `fields` map mirrors what FormData.get() would return.
 *
 * Using a real NextRequest with a multipart body causes Next.js internals to
 * try to access private fields (#name) on non-File objects and throws.
 */
function mockFormReq(fields: Record<string, string | File | null>): NextRequest {
  const fd = { get: (key: string) => fields[key] ?? null } as unknown as FormData;
  return { formData: () => Promise.resolve(fd) } as unknown as NextRequest;
}

/** A File whose .size property reports an arbitrary number of bytes. */
function fakeFile(name: string, type: string, reportedSize: number): File {
  const f = new File(['x'], name, { type });
  // Create an object with `f` as prototype but override the size own-property.
  return Object.defineProperty(
    Object.create(f) as File,
    'size',
    { value: reportedSize, writable: false, enumerable: true, configurable: true },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  storageMock.createBucket.mockResolvedValue({ error: null });
});

// ===========================================================================
// logo
// ===========================================================================

describe('logo POST', () => {
  it('returns 400 when no file is supplied', async () => {
    const res = await logo.POST(mockFormReq({ file: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No file' });
  });

  it('returns 400 for a non-image MIME type', async () => {
    const res = await logo.POST(
      mockFormReq({ file: new File(['data'], 'doc.pdf', { type: 'application/pdf' }) }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('תמונה') });
  });

  it('uploads the image and returns a URL with a cache-busting timestamp', async () => {
    const sb = makeStorageBuilder({ publicUrl: 'https://cdn.test/logo.png' });
    storageMock.from.mockReturnValue(sb);
    fromMock.mockReturnValue(queryResult({ error: null }));

    const res = await logo.POST(
      mockFormReq({ file: new File(['img'], 'logo.png', { type: 'image/png' }) }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(/^https:\/\/cdn\.test\/logo\.png\?v=/);
    expect(sb.upload).toHaveBeenCalled();
  });

  it('tolerates an "already exists" error from createBucket', async () => {
    storageMock.createBucket.mockResolvedValue({ error: { message: 'already exists' } });
    storageMock.from.mockReturnValue(makeStorageBuilder());
    fromMock.mockReturnValue(queryResult({ error: null }));

    const res = await logo.POST(
      mockFormReq({ file: new File(['img'], 'logo.jpg', { type: 'image/jpeg' }) }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 500 when createBucket fails with an unexpected error', async () => {
    storageMock.createBucket.mockResolvedValue({ error: { message: 'permission denied' } });

    const res = await logo.POST(
      mockFormReq({ file: new File(['img'], 'logo.png', { type: 'image/png' }) }),
    );
    expect(res.status).toBe(500);
  });
});

describe('logo GET', () => {
  it('returns null when no setting exists', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: null }));
    expect(await (await logo.GET()).json()).toEqual({ url: null });
  });

  it('returns the stored URL', async () => {
    fromMock.mockReturnValue(queryResult({ data: { value: 'https://cdn.test/logo.png?v=1' }, error: null }));
    expect(await (await logo.GET()).json()).toEqual({ url: 'https://cdn.test/logo.png?v=1' });
  });
});

describe('logo DELETE', () => {
  it('removes from storage and clears the setting, returning ok', async () => {
    const sb = makeStorageBuilder();
    storageMock.from.mockReturnValue(sb);
    fromMock.mockReturnValue(queryResult({ error: null }));

    const res = await logo.DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sb.remove).toHaveBeenCalled();
  });

  it('returns 500 when storage remove throws', async () => {
    const sb = makeStorageBuilder();
    sb.remove.mockRejectedValue(new Error('bucket not found'));
    storageMock.from.mockReturnValue(sb);

    const res = await logo.DELETE();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'bucket not found' });
  });
});

// ===========================================================================
// takanon
// ===========================================================================

describe('takanon POST', () => {
  it('returns 400 when no file is provided', async () => {
    const res = await takanon.POST(mockFormReq({ file: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No file provided' });
  });

  it('returns 400 for a disallowed MIME type', async () => {
    const res = await takanon.POST(
      mockFormReq({ file: new File(['data'], 'pic.png', { type: 'image/png' }) }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('PDF') });
  });

  it('uploads a PDF and saves all four settings rows', async () => {
    const sb = makeStorageBuilder({ publicUrl: 'https://cdn.test/takanon.pdf' });
    storageMock.from.mockReturnValue(sb);
    fromMock.mockReturnValue(queryResult({ error: null }));

    const res = await takanon.POST(
      mockFormReq({ file: new File(['pdf content'], 'rules.pdf', { type: 'application/pdf' }) }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: 'https://cdn.test/takanon.pdf', filename: 'rules.pdf' });
    expect(sb.upload).toHaveBeenCalled();
  });

  it('returns 500 when the storage upload fails', async () => {
    // The route does `if (uploadError) throw uploadError` where uploadError is a
    // plain object, so the catch returns the generic "Upload failed" message.
    const sb = makeStorageBuilder({ uploadErr: { message: 'quota exceeded' } });
    storageMock.from.mockReturnValue(sb);

    const res = await takanon.POST(
      mockFormReq({ file: new File(['data'], 'rules.pdf', { type: 'application/pdf' }) }),
    );
    expect(res.status).toBe(500);
  });
});

describe('takanon GET', () => {
  it('returns nulls when no settings exist', async () => {
    fromMock.mockReturnValue(queryResult({ data: [], error: null }));
    expect(await (await takanon.GET()).json()).toEqual({ url: null, filename: null, type: null, updated: null });
  });

  it('returns the stored values', async () => {
    fromMock.mockReturnValue(queryResult({
      data: [
        { key: 'takanon_url',      value: 'https://cdn.test/t.pdf' },
        { key: 'takanon_filename', value: 'rules.pdf' },
        { key: 'takanon_type',     value: 'pdf' },
        { key: 'takanon_updated',  value: '2024-01-01T00:00:00Z' },
      ],
      error: null,
    }));
    expect(await (await takanon.GET()).json()).toEqual({
      url: 'https://cdn.test/t.pdf',
      filename: 'rules.pdf',
      type: 'pdf',
      updated: '2024-01-01T00:00:00Z',
    });
  });
});

describe('takanon DELETE', () => {
  it('removes the storage object and clears settings rows', async () => {
    const sb = makeStorageBuilder();
    storageMock.from.mockReturnValue(sb);
    fromMock
      .mockReturnValueOnce(
        queryResult({ data: [{ key: 'takanon_url', value: 'https://cdn.test/takanon/takanon-123.pdf' }], error: null }),
      )
      .mockReturnValue(queryResult({ error: null }));

    const res = await takanon.DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sb.remove).toHaveBeenCalledWith(['takanon-123.pdf']);
  });

  it('still deletes settings even if there is no stored URL', async () => {
    const sb = makeStorageBuilder();
    storageMock.from.mockReturnValue(sb);
    fromMock
      .mockReturnValueOnce(queryResult({ data: [], error: null }))
      .mockReturnValue(queryResult({ error: null }));

    const res = await takanon.DELETE();
    expect(res.status).toBe(200);
    expect(sb.remove).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// download-forms
// ===========================================================================

describe('download-forms GET', () => {
  it('returns the forms list', async () => {
    fromMock.mockReturnValue(queryResult({ data: [{ id: 'f1', label: 'Form A' }], error: null }));
    expect(await (await downloadForms.GET()).json()).toEqual({ forms: [{ id: 'f1', label: 'Form A' }] });
  });

  it('returns 500 on a DB error', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: { message: 'db error' } }));
    const res = await downloadForms.GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'db error' });
  });
});

describe('download-forms POST', () => {
  it('returns 400 when no file is provided', async () => {
    const res = await downloadForms.POST(mockFormReq({ file: null, label: 'Form A' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('קובץ') });
  });

  it('returns 400 when no label is provided', async () => {
    const res = await downloadForms.POST(
      mockFormReq({ file: new File(['data'], 'form.pdf', { type: 'application/pdf' }), label: '' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('שם') });
  });

  it('returns 400 when the file exceeds 25 MB', async () => {
    const oversized = fakeFile('large.pdf', 'application/pdf', 26 * 1024 * 1024);
    const res = await downloadForms.POST(mockFormReq({ file: oversized, label: 'Big File' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('25MB') });
  });

  it('returns 400 for a disallowed MIME type', async () => {
    const res = await downloadForms.POST(
      mockFormReq({
        file: new File(['data'], 'prog.exe', { type: 'application/octet-stream' }),
        label: 'Executable',
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('application/octet-stream') });
  });

  it('uploads and inserts a form row on success', async () => {
    const sb = makeStorageBuilder({ publicUrl: 'https://cdn.test/download-forms/form.pdf' });
    storageMock.from.mockReturnValue(sb);
    fromMock.mockReturnValue(
      queryResult({ data: { id: 'f1', label: 'Reg Form', file_url: 'https://cdn.test/form.pdf' }, error: null }),
    );

    const res = await downloadForms.POST(
      mockFormReq({
        file: new File(['pdf'], 'reg.pdf', { type: 'application/pdf' }),
        label: 'Reg Form',
        sort_order: '1',
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ form: { id: 'f1', label: 'Reg Form' } });
    expect(sb.upload).toHaveBeenCalled();
  });

  it('rolls back the storage upload when the DB insert fails', async () => {
    const sb = makeStorageBuilder({ publicUrl: 'https://cdn.test/download-forms/form.pdf' });
    storageMock.from.mockReturnValue(sb);
    fromMock.mockReturnValue(
      queryResult({ data: null, error: { message: 'duplicate key' } }),
    );

    const res = await downloadForms.POST(
      mockFormReq({ file: new File(['pdf'], 'dup.pdf', { type: 'application/pdf' }), label: 'Dup' }),
    );

    // The DB error is a plain object so the catch block emits the generic message.
    expect(res.status).toBe(500);
    // The key assertion: storage rollback was attempted.
    expect(sb.remove).toHaveBeenCalled();
  });
});

describe('download-forms DELETE', () => {
  const BASE_URL = 'https://libi.test/api/admin/download-forms';

  it('returns 400 when no id is provided', async () => {
    const res = await downloadForms.DELETE(deleteReq('', BASE_URL));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'חסר id' });
  });

  it('looks up the form, deletes the DB row, and removes the storage object', async () => {
    const sb = makeStorageBuilder();
    storageMock.from.mockReturnValue(sb);
    fromMock
      .mockReturnValueOnce(
        queryResult({ data: { file_url: 'https://cdn.test/download-forms/form-123.pdf' }, error: null }),
      )
      .mockReturnValueOnce(queryResult({ error: null })); // DELETE

    const res = await downloadForms.DELETE(deleteReq('?id=f1', BASE_URL));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sb.remove).toHaveBeenCalledWith(['form-123.pdf']);
  });

  it('returns 500 when the select fails', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: { message: 'not found' } }));
    const res = await downloadForms.DELETE(deleteReq('?id=missing', BASE_URL));
    expect(res.status).toBe(500);
  });
});
