'use client';

// Clickable summary tiles that double as tabs on the playoff-stats page.
// Each tile keeps its count and, when selected, shows its panel below.
import { useState, type ReactNode } from 'react';

export type StatTab = {
  key: string;
  label: string;
  value: string;
  accentClass: string; // number color, e.g. 'text-orange-400'
  barClass: string;    // active-underline bg, e.g. 'bg-orange-400'
  panel: ReactNode;
};

export default function PlayoffStatsTabs({ tabs, initialKey }: { tabs: StatTab[]; initialKey: string }) {
  const [active, setActive] = useState(initialKey);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3" role="tablist">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className={`rounded-xl border px-3 py-3 text-center transition ${
                isActive
                  ? 'border-white/25 bg-white/[0.07]'
                  : 'border-white/[0.07] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.05]'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a]">{t.label}</p>
              <p className={`mt-1 text-2xl font-black font-stats ${t.accentClass}`}>{t.value}</p>
              <span className={`mx-auto mt-1.5 block h-0.5 w-8 rounded-full transition-colors ${isActive ? t.barClass : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{current.panel}</div>
    </div>
  );
}
