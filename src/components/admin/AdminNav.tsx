'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const GROUPS = [
  {
    label: '🎮 משחקים',
    emoji: '🎮',
    shortLabel: 'משחקים',
    tabs: [
      { href: '/admin?tab=games',       label: '🎮 Games'     },
      { href: '/admin?tab=boxscore',    label: '📊 Box Score'  },
      { href: '/admin?tab=media',       label: '🎥 Media'      },
      { href: '/admin?tab=submissions', label: '📥 הגשות'      },
    ],
  },
  {
    label: '👥 אנשים',
    emoji: '👥',
    shortLabel: 'אנשים',
    tabs: [
      { href: '/admin?tab=players',     label: '👤 שחקנים' },
      { href: '/admin?tab=playerstats', label: '📊 סטטיסטיקה' },
      { href: '/admin?tab=officials', label: '🦺 שופטים' },
      { href: '/admin?tab=teams',     label: '🛡️ קבוצות' },
    ],
  },
  {
    label: '📊 נתונים',
    emoji: '📊',
    shortLabel: 'נתונים',
    tabs: [
      { href: '/admin?tab=sync',         label: '📋 Sync'       },
      { href: '/admin?tab=synclog',      label: '📜 לוג'        },
      { href: '/admin?tab=disciplinary', label: '⚠️ משמעת'     },
      { href: '/admin?tab=playoff',      label: '🏆 פלייאוף'   },
    ],
  },
  {
    label: '⚙️ הגדרות',
    emoji: '⚙️',
    shortLabel: 'הגדרות',
    tabs: [
      { href: '/admin?tab=settings',     label: '⚙️ הגדרות' },
      { href: '/admin?tab=seasons',      label: '📅 עונות'   },
      { href: '/admin?tab=announcements',label: '📢 הודעות'  },
      { href: '/admin?tab=takanon',      label: '📋 תקנון'   },
      { href: '/admin?tab=messages',     label: '📬 פניות'        },
      { href: '/admin?tab=about',        label: '📖 דף אודות'    },
      { href: '/admin?tab=accessibility',label: '♿ נגישות'        },
      { href: '/admin?tab=terms',        label: '📋 תנאי שימוש'  },
      { href: '/admin?tab=halloffame',   label: '🏆 היכל התהילה' },
    ],
  },
];

export default function AdminNav() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'games';
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close desktop dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function isGroupActive(group: typeof GROUPS[0]) {
    return group.tabs.some(t => t.href.includes(`tab=${activeTab}`));
  }

  const mobileGroupData = mobileGroup
    ? GROUPS.find(g => g.label === mobileGroup) ?? null
    : null;

  return (
    <>
      {/* ── Desktop nav (grouped dropdowns, recolored) ─────────────────── */}
      <nav ref={navRef} className="hidden sm:flex items-center border-b border-white/[0.06] bg-[#0f1e30] px-4">
        {GROUPS.map((group) => {
          const active = isGroupActive(group);
          const open = openGroup === group.label;

          return (
            <div key={group.label} className="relative">
              <button
                onClick={() => setOpenGroup(open ? null : group.label)}
                className={`flex h-12 items-center gap-1.5 border-b-2 px-5 text-sm font-medium transition whitespace-nowrap ${
                  active
                    ? 'border-orange-500 text-white'
                    : 'border-transparent text-[#5a7a9a] hover:border-orange-500/50 hover:text-white'
                }`}
              >
                {group.label}
                <span className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {open && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-white/[0.09] bg-[#0f1e30] shadow-xl overflow-hidden">
                  {group.tabs.map((tab) => {
                    const tabActive = tab.href.includes(`tab=${activeTab}`);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        onClick={() => setOpenGroup(null)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
                          tabActive
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'text-[#6b8aaa] hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        {tab.label}
                        {tabActive && <span className="mr-auto text-orange-400">●</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Mobile: backdrop ───────────────────────────────────────────── */}
      {mobileGroup && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setMobileGroup(null)}
        />
      )}

      {/* ── Mobile: slide-up sub-tabs ──────────────────────────────────── */}
      <div
        className={`fixed left-0 right-0 z-50 sm:hidden transition-transform duration-300 ease-in-out ${
          mobileGroup ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))' }}
        dir="rtl"
      >
        {mobileGroupData && (
          <div className="mx-3 mb-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1e30]/98 backdrop-blur-md shadow-2xl">
            <p className="border-b border-white/[0.06] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#3a5a7a]">
              {mobileGroupData.label}
            </p>
            <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
              {mobileGroupData.tabs.map((tab) => {
                const tabActive = tab.href.includes(`tab=${activeTab}`);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMobileGroup(null)}
                    className={`flex items-center gap-3 bg-[#0f1e30] px-4 py-4 text-sm font-bold transition-colors hover:bg-white/[0.05] ${
                      tabActive ? 'text-orange-400' : 'text-[#6b8aaa]'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile: fixed bottom bar ───────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden" dir="rtl">
        <div className="h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />

        <div
          className="flex items-stretch bg-[#0b1520]/95 backdrop-blur-md border-t border-white/[0.06]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {GROUPS.map((group) => {
            const active = isGroupActive(group);
            const isOpen = mobileGroup === group.label;

            return (
              <button
                key={group.label}
                onClick={() => setMobileGroup(isOpen ? null : group.label)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-all"
              >
                {(active || isOpen) && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                )}
                <span className={`text-xl transition-all ${
                  active || isOpen
                    ? 'drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]'
                    : ''
                }`}>
                  {group.emoji}
                </span>
                <span className={`text-[10px] font-bold transition-all ${
                  active || isOpen ? 'text-orange-400' : 'text-[#3a5a7a]'
                }`}>
                  {group.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
