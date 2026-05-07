'use client';

import { createContext, useContext, useState, useCallback } from 'react';

type LangContextType = {
  lang: 'he' | 'en';
  toggle: () => void;
  t: (he: string) => string;
};

const LangContext = createContext<LangContextType>({
  lang: 'he',
  toggle: () => {},
  t: (he: string) => he,
});

export const useLang = () => useContext(LangContext);

// Re-export shared dictionary
import { DICT } from '@/lib/dict';
export { DICT };

// Normalize for fuzzy dict lookup — see lib/get-lang.ts for the same logic.
function normalizeForDict(s: string): string {
  return s
    .replace(/[‎‏‪-‮]/g, '')
    .replace(/["“”„‟״'‘’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
const NORM_DICT: Record<string, string> = {};
for (const [he, en] of Object.entries(DICT)) {
  NORM_DICT[normalizeForDict(he)] = en;
}

export default function TranslationProvider({
  children,
  initialLang = 'he',
}: {
  children: React.ReactNode;
  initialLang?: 'he' | 'en';
}) {
  const [lang, setLang] = useState<'he' | 'en'>(initialLang);

  const toggle = useCallback(() => {
    setLang(prev => {
      const next = prev === 'he' ? 'en' : 'he';
      try {
        localStorage.setItem('libi-lang', next);
      } catch {}
      // Set cookie so server components can read it
      document.cookie = `libi-lang=${next}; path=/; max-age=31536000; SameSite=Lax`;
      // Update html dir and lang
      document.documentElement.lang = next === 'he' ? 'he' : 'en';
      document.documentElement.dir = next === 'he' ? 'rtl' : 'ltr';
      return next;
    });
  }, []);

  const t = useCallback((he: string): string => {
    if (lang === 'he') return he;
    if (he == null) return he;
    // 1. Exact match. 2. Trimmed. 3. Normalized (strip gereshim etc.)
    return DICT[he] ?? DICT[he.trim()] ?? NORM_DICT[normalizeForDict(he)] ?? he;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LangContext.Provider>
  );
}
