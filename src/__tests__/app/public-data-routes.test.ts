jest.mock('@/lib/current-season', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue('2025-2026'),
}));

// upload-scoresheet uses supabaseAdmin.storage; playoff uses .from.
const storageUpload = jest.fn();
const storageGetPublicUrl = jest.fn();
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    storage: {
      from: jest.fn(() => ({
        upload: storageUpload,
        getPublicUrl: storageGetPublicUrl,
      })),
    },
  },
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest } from 'next/server';
import { queryResult } from '../helpers/supabase-mock';
import { GET as playoffGET } from '@/app/api/playoff/route';
import { POST as uploadPOST } from '@/app/api/upload-scoresheet/route';
import { resetRateLimiter } from '@/lib/rate-limit';

const fromMock = supabaseAdmin.from as jest.Mock;

beforeEach(() => resetRateLimiter());

// ===========================================================================
// public playoff GET
// ===========================================================================

describe('public playoff GET', () => {
  it('returns series and games for the current season', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: [{ series_number: 1 }] }))
      .mockReturnValueOnce(queryResult({ data: [{ game_number: 1 }] }));
    const body = await (await playoffGET()).json();
    expect(body).toEqual({ series: [{ series_number: 1 }], games: [{ game_number: 1 }] });
  });

  it('coalesces null query results to empty arrays', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: null }))
      .mockReturnValueOnce(queryResult({ data: null }));
    const body = await (await playoffGET()).json();
    expect(body).toEqual({ series: [], games: [] });
  });
});

// ===========================================================================
// upload-scoresheet POST
// ===========================================================================

function fileUploadRequest(file: File | null): NextRequest {
  const fd = new FormData();
  if (file) fd.set('file', file);
  return new NextRequest('https://libi.test/api/upload-scoresheet', { method: 'POST', body: fd });
}

describe('upload-scoresheet POST', () => {
  it('rejects a request with no file', async () => {
    const res = await uploadPOST(fileUploadRequest(null));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No file provided' });
  });

  it('uploads the file and returns its public URL', async () => {
    storageUpload.mockResolvedValue({ error: null });
    storageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/scoresheets/x.jpg' } });

    const file = new File([new Uint8Array([1, 2, 3])], 'sheet.jpg', { type: 'image/jpeg' });
    const res = await uploadPOST(fileUploadRequest(file));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://cdn/scoresheets/x.jpg' });
    expect(storageUpload).toHaveBeenCalledTimes(1);
  });

  it('returns 500 with the error message when the storage upload fails', async () => {
    storageUpload.mockResolvedValue({ error: new Error('bucket missing') });

    const file = new File([new Uint8Array([1])], 'sheet.png', { type: 'image/png' });
    const res = await uploadPOST(fileUploadRequest(file));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'bucket missing' });
  });

  it('rejects a non-image file type', async () => {
    const file = new File([new Uint8Array([1])], 'evil.html', { type: 'text/html' });
    const res = await uploadPOST(fileUploadRequest(file));
    expect(res.status).toBe(400);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('returns 429 once the per-IP rate limit is exhausted', async () => {
    storageUpload.mockResolvedValue({ error: null });
    storageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } });
    const file = new File([new Uint8Array([1])], 'sheet.jpg', { type: 'image/jpeg' });
    for (let i = 0; i < 10; i++) {
      expect((await uploadPOST(fileUploadRequest(file))).status).toBe(200);
    }
    expect((await uploadPOST(fileUploadRequest(file))).status).toBe(429);
  });
});
