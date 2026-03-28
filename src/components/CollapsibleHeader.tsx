'use client';

import { useState } from 'react';

export default function CollapsibleHeader({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <div className={`transition-all duration-300 ${collapsed ? 'overflow-hidden max-h-0 border-b-0' : 'overflow-visible max-h-24 sm:overflow-visible'}`}>
        {children}
      </div>

      {/* Toggle tab — always visible, sticks to top */}
      <div className="flex justify-center">
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'הצג תפריט' : 'הסתר תפריט'}
          className="relative -mt-px flex items-center gap-1 rounded-b-lg border border-t-0 border-white/[0.08] bg-[#0f1e30]/95 backdrop-blur-sm px-3 py-0.5 text-[10px] font-bold text-[#3a5a7a] hover:text-[#7aaac8] transition sm:hidden"
        >
          {collapsed
            ? <><span className="text-[9px]">▼</span> תפריט</>
            : <><span className="text-[9px]">▲</span> הסתר</>
          }
        </button>
      </div>
    </>
  );
}
