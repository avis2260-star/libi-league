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

export function st(he: string, lang: 'he' | 'en'): string {
  if (lang === 'he') return he;
  if (he == null) return he;
  // Exact key first, then trimmed — so admin-stored strings with stray
  // whitespace still translate.
  return DICT[he] ?? DICT[he.trim()] ?? he;
}
