'use client';

import { useState } from 'react';

const NAV_LINKS = [
  { href: '/',          label: 'בית'       },
  { href: '/games',     label: 'משחקים'    },
  { href: '/results',   label: 'תוצאות'    },
  { href: '/standings', label: 'טבלאות'    },
  { href: '/teams',     label: 'קבוצות'    },
  { href: '/cup',       label: 'גביע 🏆'   },
  { href: '/takanon',   label: 'תקנון 📋'  },
  { href: '/playoff',   label: 'פלייאוף'   },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button — visible only on small screens */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="תפריט ניווט"
        className="flex sm:hidden flex-col gap-1.5 p-2 rounded-lg hover:bg-white/5 transition"
      >
        <span className={`block h-0.5 w-5 bg-white transition-transform duration-200 ${open ? 'translate-y-2 rotate-45' : ''}`} />
        <span className={`block h-0.5 w-5 bg-white transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block h-0.5 w-5 bg-white transition-transform duration-200 ${open ? '-translate-y-2 -rotate-45' : ''}`} />
      </button>

      {/* Mobile dropdown menu */}
      {open && (
        <div
          className="absolute top-full right-0 left-0 z-50 border-b border-white/5 bg-[#0f1e30]/98 backdrop-blur-sm sm:hidden"
          dir="rtl"
        >
          <ul className="flex flex-col py-2">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block px-5 py-3 text-sm font-semibold text-[#6b8aaa] transition hover:bg-white/5 hover:text-white"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
