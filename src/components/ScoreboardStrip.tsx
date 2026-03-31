'use client';

import Link from 'next/link';
import { useRef } from 'react';

type Game = {
  home: string;
  away: string;
  div: 'North' | 'South';
  homeLogo: string | null;
  awayLogo: string | null;
};

function TeamLogo({ logo, name }: { logo: string | null; name: string }) {
  return (
    <div className="h-7 w-7 shrink-0 rounded-full border border-white/10 bg-white/[0.05] overflow-hidden flex items-center justify-center">
      {logo
        ? <img src={logo} alt={name} className="h-full w-full object-cover" />
        : <span className="text-[10px] font-black text-[#4a6a8a]">{[...name].find(c => c.trim()) ?? '?'}</span>
      }
    </div>
  );
}

export default function ScoreboardStrip({
  games,
  nextRound,
  nextDate,
  heDay,
}: {
  games: Game[];
  nextRound: number;
  nextDate: string;
  heDay: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: 'left' | 'right') {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-[#0d1a28]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-3 py-2">
        {heDay && (
          <>
            <div className="shrink-0 text-center min-w-[3.5rem]">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#4a6a8a]">{heDay}</p>
              <p className="text-[11px] font-bold text-[#8aaac8]">{nextDate}</p>
            </div>
            <div className="h-6 w-px bg-white/[0.06] shrink-0" />
          </>
        )}
        <p className="flex-1 text-[11px] font-bold text-[#5a7a9a]">מחזור {nextRound} · משחקים קרובים</p>

        {/* Scroll arrows */}
        <button
          onClick={() => scroll('right')}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8aaac8] hover:bg-white/[0.08] hover:text-white transition-colors"
          aria-label="scroll right"
        >
          ›
        </button>
        <button
          onClick={() => scroll('left')}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8aaac8] hover:bg-white/[0.08] hover:text-white transition-colors"
          aria-label="scroll left"
        >
          ‹
        </button>

        <Link
          href={`/games#round-${nextRound}`}
          className="shrink-0 text-[11px] font-bold text-orange-400 hover:text-orange-300 transition-colors pr-1"
        >
          ← כל המשחקים
        </Link>
      </div>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {games.map((g, i) => (
          <div
            key={i}
            className={`relative group shrink-0 w-48 p-3 transition-colors hover:bg-white/[0.04] ${
              i < games.length - 1 ? 'border-l border-white/[0.05]' : ''
            }`}
          >
            {/* Whole-card link (background) — goes to games schedule */}
            <Link
              href={`/games#round-${nextRound}`}
              className="absolute inset-0 z-0"
              aria-label={`${g.home} vs ${g.away}`}
              tabIndex={-1}
            />

            {/* Division badge */}
            <div className={`relative z-10 pointer-events-none mb-2.5 flex items-center gap-1 text-[9px] font-bold ${
              g.div === 'North' ? 'text-blue-400' : 'text-orange-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${g.div === 'North' ? 'bg-blue-400' : 'bg-orange-400'}`} />
              {g.div === 'North' ? 'מחוז צפון' : 'מחוז דרום'}
            </div>

            {/* Home team — links to team page */}
            <Link
              href={`/team/${encodeURIComponent(g.home)}`}
              className="relative z-10 flex items-center gap-2 mb-1 group/home"
            >
              <TeamLogo logo={g.homeLogo} name={g.home} />
              <p className="truncate text-xs font-black text-[#e8edf5] group-hover/home:text-orange-400 transition-colors leading-snug flex-1">
                {g.home}
              </p>
            </Link>

            {/* VS divider */}
            <div className="relative z-10 pointer-events-none my-1.5 flex items-center gap-1.5 pr-9">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-[9px] font-black text-[#3a5a7a]">VS</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            {/* Away team — links to team page */}
            <Link
              href={`/team/${encodeURIComponent(g.away)}`}
              className="relative z-10 flex items-center gap-2 group/away"
            >
              <TeamLogo logo={g.awayLogo} name={g.away} />
              <p className="truncate text-xs font-black text-[#e8edf5] group-hover/away:text-orange-400 transition-colors leading-snug flex-1">
                {g.away}
              </p>
            </Link>

            <p className="relative z-10 pointer-events-none mt-2 text-[9px] text-[#3a5a7a]">{nextDate}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
