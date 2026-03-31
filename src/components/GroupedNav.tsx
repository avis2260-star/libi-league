'use client';

import { useState, useRef, useEffect } from 'react';

/* ── Groups definition ──────────────────────────────────────────────────── */
const GROUPS = [
  {
    id: 'home', icon: '🏠', label: 'בית',
    direct: '/', links: [] as { href: string; label: string }[],
  },
  {
    id: 'league', icon: '📅', label: 'ליגה',
    direct: null,
    links: [
      { href: '/games',     label: 'משחקים' },
      { href: '/results',   label: 'תוצאות' },
      { href: '/standings', label: 'טבלאות' },
      { href: '/teams',     label: 'קבוצות' },
      { href: '/submit',    label: '📥 הגשת תוצאות' },
    ],
  },
  {
    id: 'comp', icon: '🏆', label: 'תחרויות',
    direct: null,
    links: [
      { href: '/cup',     label: 'גביע' },
      { href: '/playoff', label: 'פלייאוף' },
    ],
  },
  {
    id: 'info', icon: 'ℹ️', label: 'מידע',
    direct: null,
    links: [
      { href: '/takanon', label: 'תקנון 📋' },
      { href: '/about',   label: 'אודות'    },
    ],
  },
];

/* ── Shared pill style helpers ──────────────────────────────────────────── */
const pillBase =
  'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-all duration-150';
const pillIdle =
  'border-white/[0.09] bg-white/[0.04] text-[#6b8aaa] hover:border-white/20 hover:bg-white/[0.07] hover:text-white';
const pillActive =
  'border-orange-500/40 bg-orange-500/10 text-orange-400';

/* ────────────────────────────────────────────────────────────────────────── */
export default function GroupedNav() {
  const [desktopOpen, setDesktopOpen] = useState<string | null>(null);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  /* Close desktop dropdown on outside click */
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (desktopRef.current && !desktopRef.current.contains(e.target as Node)) {
        setDesktopOpen(null);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  /* ── Desktop ── */
  const Desktop = (
    <div ref={desktopRef} className="hidden sm:flex items-center gap-2 relative">
      {GROUPS.map(group => {
        /* Direct link (בית) */
        if (group.direct) {
          return (
            <a key={group.id} href={group.direct} className={`${pillBase} ${pillIdle}`}>
              <span>{group.icon}</span>
              <span>{group.label}</span>
            </a>
          );
        }

        /* Dropdown group */
        const isOpen = desktopOpen === group.id;
        return (
          <div key={group.id} className="relative">
            <button
              onClick={() => setDesktopOpen(isOpen ? null : group.id)}
              className={`${pillBase} ${isOpen ? pillActive : pillIdle}`}
            >
              <span>{group.icon}</span>
              <span>{group.label}</span>
              <span
                className="text-[9px] leading-none transition-transform duration-200"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                ▾
              </span>
            </button>

            {isOpen && (
              <div
                className="absolute top-full mt-2 min-w-[150px] rounded-2xl border border-white/[0.09]
                  bg-[#0f1e30] shadow-2xl py-1"
                dir="rtl"
                style={{ right: 0, zIndex: 9999 }}
              >
                {group.links.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setDesktopOpen(null)}
                    className="block px-4 py-2.5 text-sm font-semibold text-[#6b8aaa]
                      hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ── Mobile ── */
  const Mobile = (
    <div className="sm:hidden relative">
      {/* Hamburger */}
      <button
        onClick={() => { setMobileOpen(o => !o); setMobileGroup(null); }}
        aria-label="תפריט ניווט"
        className="flex flex-col gap-1.5 p-2 rounded-lg hover:bg-white/5 transition"
      >
        <span className={`block h-0.5 w-5 bg-white transition-transform duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
        <span className={`block h-0.5 w-5 bg-white transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
        <span className={`block h-0.5 w-5 bg-white transition-transform duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {mobileOpen && (
        <div
          className="absolute top-full right-0 left-0 z-50 border-b border-white/[0.06]
            bg-[#0f1e30]/98 backdrop-blur-sm"
          dir="rtl"
          style={{ right: '-1rem', left: '-100vw' }}
        >
          {/* 2×2 pill grid */}
          <div className="grid grid-cols-2 gap-2 p-3">
            {GROUPS.map(group => {
              /* Direct link (בית) */
              if (group.direct) {
                return (
                  <a
                    key={group.id}
                    href={group.direct}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-2xl border
                      border-white/[0.09] bg-white/[0.04] px-3 py-3 text-sm font-bold
                      text-[#6b8aaa] hover:text-white hover:bg-white/[0.07] transition"
                  >
                    <span className="text-base">{group.icon}</span>
                    <span>{group.label}</span>
                  </a>
                );
              }

              const isOpen = mobileGroup === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => setMobileGroup(isOpen ? null : group.id)}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3
                    text-sm font-bold transition
                    ${isOpen ? pillActive : 'border-white/[0.09] bg-white/[0.04] text-[#6b8aaa] hover:text-white hover:bg-white/[0.07]'}`}
                >
                  <span className="text-base">{group.icon}</span>
                  <span>{group.label}</span>
                  <span className="text-[9px] leading-none" style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}>
                    {isOpen ? '▴' : '▾'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Expanded group links — shown below the grid */}
          {mobileGroup && (() => {
            const group = GROUPS.find(g => g.id === mobileGroup);
            if (!group || !group.links.length) return null;
            return (
              <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
                <p className="px-1 pb-1.5 text-[10px] font-black tracking-widest uppercase text-[#2a4a6a]">
                  {group.icon} {group.label}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.links.map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5
                        text-sm font-semibold text-[#6b8aaa] hover:bg-white/[0.07] hover:text-white
                        text-center transition"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );

  return <>{Desktop}</>;
}
