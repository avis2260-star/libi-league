'use client';

import { useState } from 'react';
import Link from 'next/link';

type Game = {
  home: string;
  away: string;
  div: 'North' | 'South';
  homeLogo: string | null;
  awayLogo: string | null;
};

type RosterEntry = { name: string; jersey_number: number | null };

function TeamLogo({ logo, name, size = 'sm' }: { logo: string | null; name: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-12 w-12 text-sm' : 'h-7 w-7 text-[10px]';
  return (
    <div className={`${cls} shrink-0 rounded-full border border-white/10 bg-white/[0.05] overflow-hidden flex items-center justify-center`}>
      {logo
        ? <img src={logo} alt={name} className="h-full w-full object-cover" />
        : <span className="font-black text-[#4a6a8a]">{[...name].find(c => c.trim()) ?? '?'}</span>
      }
    </div>
  );
}

/* ── Game detail modal ──────────────────────────────────────────────────────── */
function GameModal({
  game,
  nextDate,
  heDay,
  nextRound,
  homeRoster,
  awayRoster,
  onClose,
}: {
  game: Game;
  nextDate: string;
  heDay: string;
  nextRound: number;
  homeRoster: RosterEntry[];
  awayRoster: RosterEntry[];
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[199] bg-black/70 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.15s ease' }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="animate-modal-in fixed inset-x-4 z-[200] max-w-lg mx-auto rounded-2xl border border-white/[0.1] bg-[#0d1a28] shadow-2xl overflow-y-auto"
        style={{ top: '8vh', maxHeight: '84vh' }}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-[#0f1e30]">
          <div>
            <span className={`text-[10px] font-bold ${game.div === 'North' ? 'text-blue-400' : 'text-orange-400'}`}>
              {game.div === 'North' ? '🔵 מחוז צפון' : '🟠 מחוז דרום'}
            </span>
            <p className="text-sm font-black text-white mt-0.5">{heDay} · {nextDate}</p>
            <p className="text-[10px] text-[#5a7a9a]">מחזור {nextRound}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#5a7a9a] hover:text-white hover:border-white/20 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Teams matchup */}
        <div className="px-6 py-5 flex items-center gap-4">
          {/* Home team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamLogo logo={game.homeLogo} name={game.home} size="md" />
            <Link
              href={`/team/${encodeURIComponent(game.home)}`}
              onClick={onClose}
              className="text-sm font-black text-white text-center leading-tight hover:text-orange-400 transition-colors"
            >
              {game.home}
            </Link>
            <span className="text-[10px] text-[#4a6a8a] font-semibold">בית</span>
          </div>

          {/* VS */}
          <div className="shrink-0 text-center">
            <span className="text-2xl font-black text-[#1e3a5f]">VS</span>
          </div>

          {/* Away team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamLogo logo={game.awayLogo} name={game.away} size="md" />
            <Link
              href={`/team/${encodeURIComponent(game.away)}`}
              onClick={onClose}
              className="text-sm font-black text-white text-center leading-tight hover:text-orange-400 transition-colors"
            >
              {game.away}
            </Link>
            <span className="text-[10px] text-[#4a6a8a] font-semibold">חוץ</span>
          </div>
        </div>

        {/* Rosters */}
        {(homeRoster.length > 0 || awayRoster.length > 0) && (
          <div className="border-t border-white/[0.06]">
            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/[0.05]">
              {/* Home roster */}
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#4a6a8a] mb-3">סגל {game.home}</p>
                {homeRoster.length === 0 ? (
                  <p className="text-xs text-[#3a5a7a]">לא נמצאו שחקנים</p>
                ) : (
                  <ul className="space-y-1.5">
                    {homeRoster.map((p, i) => (
                      <li key={i} className="flex items-center gap-2">
                        {p.jersey_number !== null && (
                          <span className="w-5 shrink-0 text-[10px] font-black text-orange-400/70 text-left">{p.jersey_number}</span>
                        )}
                        <span className="text-xs text-[#c8d8e8] truncate">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Away roster */}
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#4a6a8a] mb-3">סגל {game.away}</p>
                {awayRoster.length === 0 ? (
                  <p className="text-xs text-[#3a5a7a]">לא נמצאו שחקנים</p>
                ) : (
                  <ul className="space-y-1.5">
                    {awayRoster.map((p, i) => (
                      <li key={i} className="flex items-center gap-2">
                        {p.jersey_number !== null && (
                          <span className="w-5 shrink-0 text-[10px] font-black text-orange-400/70 text-left">{p.jersey_number}</span>
                        )}
                        <span className="text-xs text-[#c8d8e8] truncate">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <Link
            href={`/games#round-${nextRound}`}
            onClick={onClose}
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            ← כל משחקי המחזור
          </Link>
          <button
            onClick={onClose}
            className="text-xs text-[#4a6a8a] hover:text-white transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */
export default function ScoreboardStrip({
  games,
  nextRound,
  nextDate,
  heDay,
  teamRosters = {},
}: {
  games: Game[];
  nextRound: number;
  nextDate: string;
  heDay: string;
  teamRosters?: Record<string, RosterEntry[]>;
}) {
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const scrollRef = { current: null as HTMLDivElement | null };

  function scroll(dir: 'left' | 'right') {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  }

  return (
    <>
      {activeGame && (
        <GameModal
          game={activeGame}
          nextDate={nextDate}
          heDay={heDay}
          nextRound={nextRound}
          homeRoster={teamRosters[activeGame.home] ?? []}
          awayRoster={teamRosters[activeGame.away] ?? []}
          onClose={() => setActiveGame(null)}
        />
      )}

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
          ref={el => { scrollRef.current = el; }}
          className="flex overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {games.map((g, i) => (
            <button
              key={i}
              onClick={() => setActiveGame(g)}
              className={`relative group shrink-0 w-48 p-3 text-right transition-colors hover:bg-white/[0.04] cursor-pointer ${
                i < games.length - 1 ? 'border-l border-white/[0.05]' : ''
              }`}
            >
              {/* Division badge */}
              <div className={`mb-2.5 flex items-center gap-1 text-[9px] font-bold ${
                g.div === 'North' ? 'text-blue-400' : 'text-orange-400'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${g.div === 'North' ? 'bg-blue-400' : 'bg-orange-400'}`} />
                {g.div === 'North' ? 'מחוז צפון' : 'מחוז דרום'}
              </div>

              {/* Home team */}
              <div className="flex items-center gap-2 mb-1">
                <TeamLogo logo={g.homeLogo} name={g.home} />
                <p className="truncate text-xs font-black text-[#e8edf5] group-hover:text-orange-400 transition-colors leading-snug flex-1">
                  {g.home}
                </p>
              </div>

              {/* VS divider */}
              <div className="my-1.5 flex items-center gap-1.5 pr-9">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-[9px] font-black text-[#3a5a7a]">VS</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              {/* Away team */}
              <div className="flex items-center gap-2">
                <TeamLogo logo={g.awayLogo} name={g.away} />
                <p className="truncate text-xs font-black text-[#e8edf5] group-hover:text-orange-400 transition-colors leading-snug flex-1">
                  {g.away}
                </p>
              </div>

              <p className="mt-2 text-[9px] text-[#3a5a7a]">{nextDate} · לחץ לפרטים</p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
