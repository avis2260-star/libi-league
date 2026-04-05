'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAppRotation } from './AppRotationProvider';

const NAV = [
  {
    href: '/',
    label: 'בית',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/games',
    label: 'משחקים',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: '/standings',
    label: 'טבלאות',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    href: '/teams',
    label: 'קבוצות',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: '/cup',
    label: 'גביע',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0012 0V2z" />
      </svg>
    ),
  },
];

const MORE_LINKS = [
  { href: '/players',  label: 'כרטיסי שחקן', emoji: '🃏' },
  { href: '/scoreboard', label: 'משחק חי',    emoji: '🔴' },
  { href: '/submit',   label: 'הגשת תוצאות', emoji: '📥' },
  { href: '/results',  label: 'תוצאות',      emoji: '📊' },
  { href: '/playoff',  label: 'פלייאוף',     emoji: '🏆' },
  { href: '/takanon',  label: 'תקנון',       emoji: '📋' },
  { href: '/about',    label: 'אודות',       emoji: 'ℹ️' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { rotated, toggle: toggleRotation } = useAppRotation();

  return (
    <>
      {/* Backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Slide-up extra menu */}
      <div
        className={`fixed left-0 right-0 z-50 sm:hidden transition-transform duration-300 ease-in-out ${
          menuOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))' }}
        dir="rtl"
      >
        <div className="mx-3 mb-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1e30]/98 backdrop-blur-md shadow-2xl">
          <p className="border-b border-white/[0.06] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#3a5a7a]">
            עוד דפים
          </p>
          <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
            {MORE_LINKS.map(({ href, label, emoji }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 bg-[#0f1e30] px-4 py-4 text-sm font-bold transition-colors hover:bg-white/[0.05] ${
                    isActive ? 'text-orange-400' : 'text-[#6b8aaa]'
                  }`}
                >
                  <span className="text-xl">{emoji}</span>
                  {label}
                </Link>
              );
            })}
            {/* Rotate screen button */}
            <button
              onClick={() => { toggleRotation(); setMenuOpen(false); }}
              className={`flex items-center gap-3 bg-[#0f1e30] px-4 py-4 text-sm font-bold transition-colors hover:bg-white/[0.05] col-span-2 border-t border-white/[0.06] ${
                rotated ? 'text-orange-400' : 'text-[#6b8aaa]'
              }`}
            >
              <span className="text-xl">{rotated ? '📱' : '🔄'}</span>
              {rotated ? 'בטל סיבוב מסך' : 'סובב מסך לרוחב'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden" dir="rtl">
        <div className="h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />

        <div
          className="flex items-stretch bg-[#0b1520]/95 backdrop-blur-md border-t border-white/[0.06]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Main nav items */}
          {NAV.map(({ href, label, icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-all"
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                )}
                <span className={`transition-all ${isActive ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'text-[#3a5a7a]'}`}>
                  {icon}
                </span>
                <span className={`text-[10px] font-bold transition-all ${isActive ? 'text-orange-400' : 'text-[#3a5a7a]'}`}>
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Hamburger — left side (RTL end) */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-all"
            aria-label="עוד"
          >
            {menuOpen && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            )}
            <span className={`flex flex-col gap-1 transition-all ${menuOpen ? 'text-orange-400' : 'text-[#3a5a7a]'}`}>
              <span className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${menuOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
              <span className={`block h-0.5 w-5 rounded-full bg-current transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${menuOpen ? '-translate-y-1.5 -rotate-45' : ''}`} />
            </span>
            <span className={`text-[10px] font-bold transition-all ${menuOpen ? 'text-orange-400' : 'text-[#3a5a7a]'}`}>
              עוד
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
