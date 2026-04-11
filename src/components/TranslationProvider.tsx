'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

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

export default function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<'he' | 'en'>('he');

  // Persist choice
  useEffect(() => {
    const saved = localStorage.getItem('libi-lang');
    if (saved === 'en') setLang('en');
  }, []);

  const toggle = useCallback(() => {
    setLang(prev => {
      const next = prev === 'he' ? 'en' : 'he';
      localStorage.setItem('libi-lang', next);
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
    return DICT[he] ?? he;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LangContext.Provider>
  );
}
