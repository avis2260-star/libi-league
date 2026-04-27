'use client';

import { useState } from 'react';
import { useLang } from './TranslationProvider';

const NAV_GROUPS = [
  {
    label: 'ראשי',
    links: [
      { href: '/', label: 'בית' },
    ],
  },
  {
    label: 'עונה שוטפת',
    links: [
      { href: '/games',     label: 'משחקים' },
      { href: '/results',   label: 'תוצאות' },
      { href: '/standings', label: 'טבלאות' },
      { href: '/teams',     label: 'קבוצות' },
      { href: '/scoreboard', label: '🔴 משחק חי'       },
      { href: '/submit',    label: '📥 הגשת תוצאות' },
    ],
  },
  {
    label: 'תחרויות',
    links: [
      { href: '/cup',          label: 'גביע 🏆'        },
      { href: '/playoff',      label: 'פלייאוף'        },
      { href: '/hall-of-fame', label: 'היכל התהילה 🏅' },
    ],
  },
  {
    label: 'כללי',
    links: [
      { href: '/takanon', label: 'תקנון 📋' },
      { href: '/about',   label: 'אודות'    },
    ],
  },
];

export default function MobileNav() {
  const { t, lang } = useLang();
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={t('תפריט ניווט')}
        className="flex sm:hidden flex-col gap-1.5 p-2 rounded-lg hover:bg-white/5 transition"
      >
        <span className={`block h-0.5 w-5 bg-white transition-transform duration-200 ${open ? 'translate-y-2 rotate-45' : ''}`} />
        <span className={`block h-0.5 w-5 bg-white transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block h-0.5 w-5 bg-white transition-transform duration-200 ${open ? '-translate-y-2 -rotate-45' : ''}`} />
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div
          className="absolute top-full right-0 left-0 z-50 border-b border-white/5 bg-[#0f1e30]/98 backdrop-blur-sm sm:hidden"
          dir={dir}
        >
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {/* Group divider + label */}
              {gi > 0 && <div className="mx-4 border-t border-white/[0.06]" />}
              <p className="px-5 pt-3 pb-1 text-xs font-black tracking-widest uppercase text-[#8aaac8]">
                {t(group.label)}
              </p>
              <ul className="pb-1">
                {group.links.map(({ href, label }) => (
                  <li key={href}>
                    <a
                      href={href}
                      onClick={() => setOpen(false)}
                      className="block px-5 py-2.5 text-sm font-semibold text-[#6b8aaa] transition hover:bg-white/5 hover:text-white"
                    >
                      {t(label)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="h-2" />
        </div>
      )}
    </>
  );
}
