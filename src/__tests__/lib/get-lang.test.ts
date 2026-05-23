// ---------------------------------------------------------------------------
// Mock next/headers so that the module can be imported outside a Next.js
// server context. The mock is hoisted before the import by Jest's transform.
// ---------------------------------------------------------------------------
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { cookies } from 'next/headers';
import { getLang, st } from '@/lib/get-lang';

// ---------------------------------------------------------------------------
// st() – synchronous string translation
//
// st() is a pure function that maps Hebrew UI strings to English using the
// static DICT. No mocking required.
// ---------------------------------------------------------------------------

describe('st – Hebrew mode', () => {
  it('returns the input string unchanged', () => {
    expect(st('בית', 'he')).toBe('בית');
  });

  it('returns multi-word strings unchanged', () => {
    expect(st('לוח המשחקים', 'he')).toBe('לוח המשחקים');
  });

  it('returns strings not in the dictionary unchanged', () => {
    expect(st('מחרוזת שלא קיימת במילון', 'he')).toBe('מחרוזת שלא קיימת במילון');
  });

  it('returns empty string unchanged', () => {
    expect(st('', 'he')).toBe('');
  });

  it('returns strings with punctuation unchanged', () => {
    expect(st('ליגת ליב"י', 'he')).toBe('ליגת ליב"י');
  });
});

describe('st – English mode (exact DICT lookup)', () => {
  it('translates a single-word key', () => {
    expect(st('בית', 'en')).toBe('Home');
  });

  it('translates a multi-word key', () => {
    expect(st('לוח המשחקים', 'en')).toBe('Game Schedule');
  });

  it('translates a stats abbreviation', () => {
    expect(st('נקודות', 'en')).toBe('Points');
  });

  it('translates a playoff term', () => {
    expect(st('חצי גמר', 'en')).toBe('Semi Finals');
  });

  it('translates a navigation label with emoji', () => {
    expect(st('🏆 היכל התהילה', 'en')).toBe('🏆 Hall of Fame');
  });

  it('returns the original Hebrew when the key is not in the dictionary', () => {
    expect(st('מחרוזת שלא קיימת', 'en')).toBe('מחרוזת שלא קיימת');
  });
});

describe('st – English mode (trim fallback)', () => {
  it('translates a key that has surrounding whitespace', () => {
    // DICT['בית'] exists; '  בית  '.trim() === 'בית'
    expect(st('  בית  ', 'en')).toBe('Home');
  });

  it('translates a key with a leading space', () => {
    expect(st(' תוצאות', 'en')).toBe('Results');
  });
});

describe('st – English mode (normalized geresh fallback)', () => {
  // The dictionary key is 'נק׳' (with Hebrew geresh).
  // If the caller passes "נק'" (with a straight apostrophe), normalizeForDict
  // strips it and the lookup still succeeds.
  it('translates a key after stripping a straight apostrophe', () => {
    expect(st("נק'", 'en')).toBe('PTS');
  });

  it('translates a key after stripping a Hebrew geresh from input', () => {
    // Input already has the Hebrew geresh; should match directly via NORM_DICT
    expect(st('נק׳', 'en')).toBe('PTS');
  });
});

describe('st – null / undefined edge cases', () => {
  it('returns null when he is null (runtime guard)', () => {
    // TypeScript signature says `he: string` but the code guards `if (he == null)`
    // to handle data that slips through at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(st(null as any, 'en')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getLang() – reads the libi-lang cookie
// ---------------------------------------------------------------------------

describe('getLang', () => {
  it('returns "en" when the libi-lang cookie is set to "en"', async () => {
    (cookies as jest.Mock).mockResolvedValueOnce({
      get: (_name: string) => ({ value: 'en' }),
    });
    await expect(getLang()).resolves.toBe('en');
  });

  it('returns "he" when the libi-lang cookie is set to "he"', async () => {
    (cookies as jest.Mock).mockResolvedValueOnce({
      get: (_name: string) => ({ value: 'he' }),
    });
    await expect(getLang()).resolves.toBe('he');
  });

  it('returns "he" when the libi-lang cookie is absent', async () => {
    (cookies as jest.Mock).mockResolvedValueOnce({
      get: (_name: string) => undefined,
    });
    await expect(getLang()).resolves.toBe('he');
  });

  it('returns "he" when the cookie value is an unrecognised string', async () => {
    (cookies as jest.Mock).mockResolvedValueOnce({
      get: (_name: string) => ({ value: 'fr' }),
    });
    await expect(getLang()).resolves.toBe('he');
  });

  it('returns "he" as a safe fallback when cookies() throws', async () => {
    (cookies as jest.Mock).mockRejectedValueOnce(new Error('not in server context'));
    await expect(getLang()).resolves.toBe('he');
  });
});
