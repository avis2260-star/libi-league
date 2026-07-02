import { NextRequest } from 'next/server';
import { POST as analyzePOST } from '@/app/api/analyze-scoresheet/route';
import { POST as extractPOST } from '@/app/api/extract-stats/route';
import { resetRateLimiter } from '@/lib/rate-limit';

function jsonReq(body: unknown): NextRequest {
  return new NextRequest('https://libi.test/api/ai', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/** A Gemini-shaped response whose model text contains `payload` as JSON. */
function geminiOk(payload: unknown) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  };
}

const ORIGINAL_KEY = process.env.GEMINI_API_KEY;
let fetchMock: jest.Mock;

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  resetRateLimiter(); // the routes are per-IP rate limited; tests share one "IP"
});
afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = ORIGINAL_KEY;
});

// ===========================================================================
// analyze-scoresheet
// ===========================================================================

describe('analyze-scoresheet POST', () => {
  it('rejects a request with no image', async () => {
    const res = await analyzePOST(jsonReq({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No image provided' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 500 when GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await analyzePOST(jsonReq({ imageBase64: 'abc' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'GEMINI_API_KEY not set' });
  });

  it('parses and returns the JSON embedded in the model response', async () => {
    const verdict = { confidence_score: 9, status: 'pass', issues: [], recommendation: '' };
    fetchMock.mockResolvedValue(geminiOk(verdict));
    const res = await analyzePOST(jsonReq({ imageBase64: 'abc' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(verdict);
  });

  it('extracts JSON even when the model wraps it in prose', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Here is the result:\n{"status":"fail"}\nThanks' }] } }],
      }),
    });
    const res = await analyzePOST(jsonReq({ imageBase64: 'abc' }));
    expect(await res.json()).toEqual({ status: 'fail' });
  });

  it('returns 500 with the API error message when Gemini responds non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'quota exceeded' } }) });
    const res = await analyzePOST(jsonReq({ imageBase64: 'abc' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'quota exceeded' });
  });

  it('returns 500 when the model text contains no JSON object', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'no json here' }] } }] }),
    });
    const res = await analyzePOST(jsonReq({ imageBase64: 'abc' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'No JSON in response' });
  });
});

// ===========================================================================
// extract-stats
// ===========================================================================

describe('extract-stats POST', () => {
  it('returns 500 when GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await extractPOST(jsonReq({ imageBase64: 'abc', homeName: 'A', awayName: 'B' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'GEMINI_API_KEY not set' });
  });

  it('returns the extracted stats JSON', async () => {
    const stats = {
      home_score: 80, away_score: 70, quarters_visible: false,
      home_quarters: [], away_quarters: [], home_players: [], away_players: [],
    };
    fetchMock.mockResolvedValue(geminiOk(stats));
    const res = await extractPOST(jsonReq({
      imageBase64: 'abc', homeName: 'חולון', awayName: 'בני נתניה',
      homePlayers: [{ name: 'יוסי', jersey_number: 7 }],
      awayPlayers: [{ name: 'דוד' }],
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(stats);
  });

  it('works when no roster hints are supplied', async () => {
    fetchMock.mockResolvedValue(geminiOk({ home_score: 1, away_score: 2 }));
    const res = await extractPOST(jsonReq({ imageBase64: 'abc', homeName: 'A', awayName: 'B' }));
    expect(res.status).toBe(200);
  });

  it('returns 500 when Gemini responds non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'bad request' } }) });
    const res = await extractPOST(jsonReq({ imageBase64: 'abc', homeName: 'A', awayName: 'B' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'bad request' });
  });

  it('returns 500 when there is no JSON in the model response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'sorry' }] } }] }),
    });
    const res = await extractPOST(jsonReq({ imageBase64: 'abc', homeName: 'A', awayName: 'B' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'No JSON in response' });
  });
});

// ===========================================================================
// abuse guards (rate limit / size cap / media type)
// ===========================================================================

describe('AI route abuse guards', () => {
  it('rejects an oversized base64 payload with 413', async () => {
    const res = await analyzePOST(jsonReq({ imageBase64: 'x'.repeat(8_000_001) }));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-image media type', async () => {
    const res = await analyzePOST(jsonReq({ imageBase64: 'abc', mediaType: 'application/pdf' }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 429 once the per-IP rate limit is exhausted', async () => {
    fetchMock.mockResolvedValue(geminiOk({ status: 'pass' }));
    for (let i = 0; i < 20; i++) {
      expect((await analyzePOST(jsonReq({ imageBase64: 'abc' }))).status).toBe(200);
    }
    const res = await analyzePOST(jsonReq({ imageBase64: 'abc' }));
    expect(res.status).toBe(429);
  });
});
