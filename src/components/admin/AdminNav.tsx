'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const GROUPS = [
  {
    label: '🎮 משחקים',
    tabs: [
      { href: '/admin?tab=games',    label: '🎮 Games'     },
      { href: '/admin?tab=boxscore', label: '📊 Box Score'  },
      { href: '/admin?tab=media',    label: '🎥 Media'      },
    ],
  },
  {
    label: '👥 אנשים',
    tabs: [
      { href: '/admin?tab=players',   label: '👤 שחקנים' },
      { href: '/admin?tab=officials', label: '🦺 שופטים' },
      { href: '/admin?tab=teams',     label: '🛡️ קבוצות' },
    ],
  },
  {
    label: '📊 נתונים',
    tabs: [
      { href: '/admin?tab=sync',         label: '📋 Sync'       },
      { href: '/admin?tab=synclog',      label: '📜 לוג'        },
      { href: '/admin?tab=disciplinary', label: '⚠️ משמעת'     },
      { href: '/admin?tab=playoff',      label: '🏆 פלייאוף'   },
    ],
  },
  {
    label: '⚙️ הגדרות',
    tabs: [
      { href: '/admin?tab=settings',     label: '⚙️ הגדרות' },
      { href: '/admin?tab=seasons',      label: '📅 עונות'   },
      { href: '/admin?tab=announcements',label: '📢 הודעות'  },
      { href: '/admin?tab=takanon',      label: '📋 תקנון'   },
    ],
  },
];

export default function AdminNav() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'games';
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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

  return (
    <nav ref={navRef} className="flex items-center border-b border-gray-800 bg-gray-900 px-4">
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
                  : 'border-transparent text-gray-400 hover:border-orange-500/50 hover:text-white'
              }`}
            >
              {group.label}
              <span className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-gray-700 bg-gray-900 shadow-xl overflow-hidden">
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
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
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
  );
}
