'use client';

import { useState } from 'react';
import Link from 'next/link';
import { type GameResult } from '@/lib/league-data';

function TLink({ name, won }: { name: string; won: boolean }) {
  return (
    <Link
      href={`/team/${encodeURIComponent(name)}`}
      className={`text-sm font-semibold leading-tight hover:text-orange-400 hover:underline underline-offset-2 transition-colors ${won ? 'text-white' : 'text-[#5a7a9a]'}`}
    >
      {name}
    </Link>
  );
}

const isTechniScore = (sh: number, sa: number) =>
  (sh === 20 && sa === 0) || (sh === 0 && sa === 20);

function GameCard({ game }: { game: GameResult }) {
  const homeWins = game.sh > game.sa;
  const techni   = !!game.techni || isTechniScore(game.sh, game.sa);
  const techniOnHome = techni && !homeWins;
  const techniOnAway = techni && homeWins;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 transition hover:-translate-y-0.5 hover:border-orange-500/30">
      <div className="text-right">
        <TLink name={game.home} won={homeWins} />
        {techniOnHome && (
          <p className="mt-0.5 text-[9px] font-semibold text-red-400">🔴 הפסד טכני</p>
        )}
      </div>

      <div className="min-w-[72px] rounded-lg bg-black/40 px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className={`text-lg font-black ${homeWins ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>{game.sh}</span>
          <span className="text-xs text-[#3a5a7a]">:</span>
          <span className={`text-lg font-black ${!homeWins ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>{game.sa}</span>
        </div>
        {techni && <p className="mt-0.5 text-[8px] font-bold tracking-wide text-red-400">טכני *</p>}
      </div>

      <div className="text-left">
        <TLink name={game.away} won={!homeWins} />
        {techniOnAway && (
          <p className="mt-0.5 text-[9px] font-semibold text-red-400">🔴 הפסד טכני</p>
        )}
      </div>
    </div>
  );
}

export default function ResultsContent({ games }: { games: GameResult[] }) {
  const ROUNDS = [...new Set(games.map((g) => g.round))].sort((a, b) => b - a);

  const [activeRound, setActiveRound]       = useState<number | null>(null);
  const [activeDivision, setActiveDivision] = useState<'all' | 'North' | 'South'>('all');

  const filtered = games.filter((g) => {
    if (activeRound !== null && g.round !== activeRound) return false;
    if (activeDivision !== 'all' && g.division !== activeDivision) return false;
    return true;
  });

  const visibleRounds = activeRound !== null
    ? [activeRound]
    : ROUNDS.filter((r) => filtered.some((g) => g.round === r)).sort((a, b) => b - a);

  const grouped = visibleRounds.reduce<Record<number, GameResult[]>>((acc, r) => {
    acc[r] = filtered.filter((g) => g.round === r);
    return acc;
  }, {});

  const hasTechni = filtered.some((g) => !!g.techni || isTechniScore(g.sh, g.sa));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">תוצאות משחקים</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">
          מחזורים {ROUNDS[0]}–{ROUNDS[ROUNDS.length - 1]} · {filtered.length} משחקים
          {activeRound !== null ? ` במחזור ${activeRound}` : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveRound(null)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${activeRound === null ? 'border-orange-500 bg-orange-500 text-white' : 'border-white/10 bg-white/5 text-[#6b8aaa] hover:border-white/20 hover:text-white'}`}
          >
            כל המחזורים
          </button>
          {ROUNDS.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRound((prev) => (prev === r ? null : r))}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${activeRound === r ? 'border-orange-500 bg-orange-500 text-white' : 'border-white/10 bg-white/5 text-[#6b8aaa] hover:border-white/20 hover:text-white'}`}
            >
              מחזור {r}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'South', 'North'] as const).map((div) => {
            const LABEL = { all: 'כל המחוזות', South: 'מחוז דרום', North: 'מחוז צפון' };
            const active = activeDivision === div;
            const activeStyle =
              div === 'South' ? 'border-orange-500 bg-orange-500/15 text-orange-400'
              : div === 'North' ? 'border-blue-500 bg-blue-500/15 text-blue-400'
              : 'border-white/30 bg-white/10 text-white';
            return (
              <button
                key={div}
                onClick={() => setActiveDivision(div)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${active ? activeStyle : 'border-white/10 bg-white/5 text-[#6b8aaa] hover:border-white/20 hover:text-white'}`}
              >
                {LABEL[div]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {visibleRounds.length === 0 ? (
        <p className="rounded-xl border border-white/[0.07] py-12 text-center text-sm text-[#5a7a9a]">
          אין תוצאות להצגה
        </p>
      ) : (
        visibleRounds.map((r) => (
          <div key={r}>
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/15 px-4 py-1 text-xs font-bold text-orange-400">
                מחזור {r} · {grouped[r][0]?.date}
              </div>
              <div className="h-px flex-1 bg-white/[0.05]" />
              <span className="text-xs text-[#4a6a8a]">{grouped[r].length} משחקים</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {grouped[r].map((g, i) => <GameCard key={i} game={g} />)}
            </div>
          </div>
        ))
      )}

      {hasTechni && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-[#8aaac8]">
          <span className="mt-0.5 shrink-0 text-red-400">🔴</span>
          <span>
            <span className="font-bold text-red-400">הפסד טכני *</span>
            {' '}— תוצאה של 20:0 עקב אי-הגעה לאולם או פסילה.
          </span>
        </div>
      )}
    </div>
  );
}
