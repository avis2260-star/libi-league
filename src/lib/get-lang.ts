import { cookies } from 'next/headers';
import { DICT } from './dict';

export async function getLang(): Promise<'he' | 'en'> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('libi-lang')?.value === 'en' ? 'en' : 'he';
  } catch {
    return 'he';
  }
}

// Normalize a Hebrew/English string for fuzzy dict lookups: strip every
// gereshim / quote / apostrophe variant, RTL/LTR marks, collapse whitespace,
// lowercase. Keeps actual letters intact so different orthographies don't
// collapse together.
function normalizeForDict(s: string): string {
  return s
    .replace(/[‎‏‪-‮]/g, '') // bidi marks
    .replace(/["“”„‟״'‘’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Pre-build a normalized → English lookup so we don't iterate the dict on
// every miss.
const NORM_DICT: Record<string, string> = {};
for (const [he, en] of Object.entries(DICT)) {
  NORM_DICT[normalizeForDict(he)] = en;
}

export function st(he: string, lang: 'he' | 'en'): string {
  if (lang === 'he') return he;
  if (he == null) return he;
  // 1. Exact match. 2. Trimmed match. 3. Normalized (strip gereshim etc.)
  return DICT[he] ?? DICT[he.trim()] ?? NORM_DICT[normalizeForDict(he)] ?? he;
}
