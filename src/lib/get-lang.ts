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
  return DICT[he] ?? he;
}
