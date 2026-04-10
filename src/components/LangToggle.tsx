'use client';

import { useLang } from './TranslationProvider';

export default function LangToggle() {
  const { lang, toggle } = useLang();

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1.5 text-xs font-bold text-[#6b8aaa] transition hover:border-white/20 hover:text-white"
      title={lang === 'he' ? 'Switch to English' : 'עבור לעברית'}
    >
      {lang === 'he' ? 'EN' : 'עב'}
    </button>
  );
}
