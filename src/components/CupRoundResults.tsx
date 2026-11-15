'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export type CupRoundResultCard = {
  id: string;
  homeTeam: string;   // display names (already resolved + translated)
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

const ROTATE_MS = 4500;

/**
 * Season-facts card: the latest cup round's results, one game at a time.
 * Rotates on its own (pausing while hovered or focused, and not at all for
 * visitors who prefer reduced motion); the dots jump to a game.
 */
export default function CupRoundResults({
  round,
  games,
  lang,
}: {
  round: string;
  games: CupRoundResultCard[];
  lang: 'he' | 'en';
}) {
  const en = lang === 'en';
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = games.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;
  const g = games[index % count];
  const homeWon = g.homeScore > g.awayScore;
  const awayWon = g.awayScore > g.homeScore;

  return (
    <div
      className="group p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Link href="/cup" className="mb-1 block text-sm font-bold text-[#8aaac8] font-body hover:text-[#e0c97a] transition-colors">
        {en ? `Cup · ${round}` : `גביע · ${round}`}
        <span className="ms-1 text-[#e0c97a] opacity-0 transition-opacity group-hover:opacity-100">←</span>
      </Link>

      <Link
        href={`/cup/game/${g.id}`}
        key={g.id}
        className="flex flex-wrap items-baseline gap-x-1.5 text-base font-black font-heading hover:opacity-90"
      >
        <span className={homeWon ? 'text-[#e0c97a]' : 'text-[#c0d4e8]'}>{g.homeTeam}</span>
        <span className={`font-stats tabular-nums ${homeWon ? 'text-[#e0c97a]' : 'text-[#8aaac8]'}`}>{g.homeScore}</span>
        <span className="text-[#5a7a9a]">–</span>
        <span className={`font-stats tabular-nums ${awayWon ? 'text-[#e0c97a]' : 'text-[#8aaac8]'}`}>{g.awayScore}</span>
        <span className={awayWon ? 'text-[#e0c97a]' : 'text-[#c0d4e8]'}>{g.awayTeam}</span>
      </Link>

      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#8aaac8] font-body">
          {en ? `Game ${index + 1} of ${count}` : `משחק ${index + 1} מתוך ${count}`}
        </p>
        {count > 1 && (
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label={en ? 'Cup games' : 'משחקי הגביע'}>
            {games.map((game, i) => (
              <button
                key={game.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={en ? `Game ${i + 1}` : `משחק ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-[#e0c97a]' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
