'use client';

import { useState } from 'react';
import { GAME_RESULTS, type GameResult } from '@/lib/league-data';

const isTechniScore = (sh: number, sa: number) =>
  (sh === 20 && sa === 0) || (sh === 0 && sa === 20);

const ROUNDS = [...new Set(GAME_RESULTS.map((g) => g.round))].sort((a, b) => a - b);

// ── Game card ─────────────────────────────────────────────────────────────────

function GameCard({ game }: { game: GameResult }) {
  const homeWins = game.sh > game.sa;
  const techni   = !!game.techni || isTechniScore(game.sh, game.sa);

  // The "ניצחון טכני" badge appears next to the LOSING team (score = 0)
  // homeWins → home=20 (winner), away=0 (loser) → badge on AWAY side
  // awayWins → home=0 (loser), away=20 (winner) → badge on HOME side
  const techniOnHome = techni && !homeWins; // home is loser
  const techniOnAway = techni && homeWins;  // away is loser

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 transition hover:-translate-y-0.5 hover:border-orange-500/30">
      {/* Home team — winner gets full white, loser is dimmed */}
      <div className="text-right">
        <p className={`text-sm font-semibold leading-tight ${homeWins ? 'text-white' : 'text-[#5a7a9a]'}`}>
          {game.home}
        </p>
        {techniOnHome && (
          <p className="mt-0.5 text-[9px] font-semibold text-red-400">🔴 הפסד טכני</p>
        )}
      </div>

      {/* Score box */}
      <div className="min-w-[72px] rounded-lg bg-black/40 px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className={`text-lg font-black ${homeWins ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>
            {game.sh}
          </span>
          <span className="text-xs text-[#3a5a7a]">:</span>
          <span className={`text-lg font-black ${!homeWins ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>
            {game.sa}
          </span>
        </div>
        {techni && (
          <p className="mt-0.5 text-[8px] font-bold tracking-wide text-red-400">טכני *</p>
        )}
      </div>

      {/* Away team */}
      <div className="text-left">
        <p className={`text-sm font-semibold leading-tight ${!homeWins ? 'text-white' : 'text-[#5a7a9a]'}`}>
          {game.away}
        </p>
        {techniOnAway && (
          <p className="mt-0.5 text-[9px] font-semibold text-red-400">🔴 הפסד טכני</p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const [activeRound, setActiveRound]       = useState<number | null>(null);
  const [activeDivision, setActiveDivision] = useState<'all' | 'North' | 'South'>('all');

  // Apply filters
  const filtered = GAME_RESULTS.filter((g) => {
    if (activeRound !== null && g.round !== activeRound) return false;
    if (activeDivision !== 'all' && g.division !== activeDivision) return false;
    return true;
  });

  // Group by round (only rounds that have games after filtering)
  const visibleRounds = activeRound !== null
    ? [activeRound]
    : ROUNDS.filter((r) => filtered.some((g) => g.round === r));

  const grouped = visibleRounds.reduce<Record<number, GameResult[]>>((acc, r) => {
    acc[r] = filtered.filter((g) => g.round === r);
    return acc;
  }, {});

  const hasTechni = filtered.some((g) => !!g.techni || isTechniScore(g.sh, g.sa));

  function handleRoundClick(r: number) {
    setActiveRound((prev) => (prev === r ? null : r));
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-3xl font-black text-white">תוצאות משחקים</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">
          מחזורים 1–8 · {filtered.length} משחקים{activeRound !== null ? ` במחזור ${activeRound}` : ''}
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3">
        {/* Round filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveRound(null)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              activeRound === null
                ? 'border-orange-500 bg-orange-500 text-white'
                : 'border-white/10 bg-white/5 text-[#6b8aaa] hover:border-white/20 hover:text-white'
            }`}
          >
            כל המחזורים
          </button>
          {ROUNDS.map((r) => (
            <button
              key={r}
              onClick={() => handleRoundClick(r)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                activeRound === r
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-white/10 bg-white/5 text-[#6b8aaa] hover:border-white/20 hover:text-white'
              }`}
            >
              מחזור {r}
            </button>
          ))}
        </div>

        {/* District filter */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'South', 'North'] as const).map((div) => {
            const LABEL = { all: 'כל המחוזות', South: 'מחוז דרום', North: 'מחוז צפון' };
            const active = activeDivision === div;
            const divStyle =
              div === 'South' ? (active ? 'border-orange-500 bg-orange-500/15 text-orange-400' : '')
              : div === 'North' ? (active ? 'border-blue-500 bg-blue-500/15 text-blue-400' : '')
              : (active ? 'border-white/30 bg-white/10 text-white' : '');
            return (
              <button
                key={div}
                onClick={() => setActiveDivision(div)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  active ? divStyle : 'border-white/10 bg-white/5 text-[#6b8aaa] hover:border-white/20 hover:text-white'
                }`}
              >
                {LABEL[div]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Results ── */}
      {visibleRounds.length === 0 ? (
        <p className="rounded-xl border border-white/[0.07] py-12 text-center text-sm text-[#5a7a9a]">
          אין תוצאות להצגה
        </p>
      ) : (
        visibleRounds.map((r) => (
          <div key={r}>
            {/* Round header */}
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/15 px-4 py-1 text-xs font-bold text-orange-400">
                מחזור {r} · {grouped[r][0]?.date}
              </div>
              <div className="h-px flex-1 bg-white/[0.05]" />
              <span className="text-xs text-[#4a6a8a]">{grouped[r].length} משחקים</span>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {grouped[r].map((g, i) => <GameCard key={i} game={g} />)}
            </div>
          </div>
        ))
      )}

      {/* Technical win legend */}
      {hasTechni && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-[#8aaac8]">
          <span className="mt-0.5 shrink-0 text-red-400">🔴</span>
          <span>
            <span className="font-bold text-red-400">ניצחון טכני *</span>
            {' '}— תוצאה של 20:0 עקב אי-הגעה לאולם או פסילה. הניצחון נרשם לקבוצה שהופיעה.
          </span>
        </div>
      )}
    </div>
  );
}
