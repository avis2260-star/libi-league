'use client';

import { useState } from 'react';
import Link from 'next/link';
import { type GameResult } from '@/lib/league-data';

function normName(n: string) {
  return n.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function findLogo(name: string, logos: Record<string, string>) {
  return logos[name] ?? Object.entries(logos).find(([k]) => normName(k) === normName(name))?.[1];
}

function TeamLogo({ name, logos }: { name: string; logos: Record<string, string> }) {
  const url = findLogo(name, logos);
  if (url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name}
      className="h-7 w-7 shrink-0 rounded-full object-cover border border-white/10 shadow-sm" />
  );
  return (
    <div className="h-7 w-7 shrink-0 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[9px] font-black text-[#3a5a7a]">
      {[...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

const isTechniScore = (sh: number, sa: number) =>
  (sh === 20 && sa === 0) || (sh === 0 && sa === 20);

function GameCard({ game, logos }: { game: GameResult; logos: Record<string, string> }) {
  const homeWins     = game.sh > game.sa;
  const techni       = !!game.techni || isTechniScore(game.sh, game.sa);
  const techniOnHome = techni && !homeWins;
  const techniOnAway = techni && homeWins;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-orange-500/30">
      {/* Home */}
      <Link href={`/team/${encodeURIComponent(game.home)}`} className="flex items-center justify-end gap-2 min-w-0 group">
        <TeamLogo name={game.home} logos={logos} />
        <div className="text-right min-w-0">
          <p className={`text-sm font-bold leading-tight truncate group-hover:text-orange-400 transition-colors ${homeWins ? 'text-white' : 'text-[#8aaac8]'}`}>
            {game.home}
          </p>
          {techniOnHome && <p className="mt-0.5 text-[10px] font-black text-red-400">🔴 הפסד טכני</p>}
        </div>
      </Link>

      {/* Score */}
      <div className="min-w-[68px] shrink-0 rounded-lg bg-black/40 px-2.5 py-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className={`font-stats text-2xl font-black ${homeWins ? 'text-orange-400' : 'text-[#8aaac8]'}`}>{game.sh}</span>
          <span className="font-stats text-lg font-black text-[#8aaac8]">:</span>
          <span className={`font-stats text-2xl font-black ${!homeWins ? 'text-orange-400' : 'text-[#8aaac8]'}`}>{game.sa}</span>
        </div>
        {techni && <p className="mt-0.5 text-[8px] font-bold tracking-wide text-red-400">טכני *</p>}
      </div>

      {/* Away */}
      <Link href={`/team/${encodeURIComponent(game.away)}`} className="flex items-center justify-start gap-2 min-w-0 group">
        <div className="text-left min-w-0">
          <p className={`text-sm font-bold leading-tight truncate group-hover:text-orange-400 transition-colors ${!homeWins ? 'text-white' : 'text-[#8aaac8]'}`}>
            {game.away}
          </p>
          {techniOnAway && <p className="mt-0.5 text-[10px] font-black text-red-400">🔴 הפסד טכני</p>}
        </div>
        <TeamLogo name={game.away} logos={logos} />
      </Link>
    </div>
  );
}

const FALLBACK_DATES: Record<number, string> = {
  1:'01.11.25',2:'08.11.25',3:'29.11.25',4:'20.12.25',
  5:'10.01.26',6:'17.01.26',7:'07.02.26',8:'21.02.26',
  9:'28.02.26',10:'14.03.26',11:'21.03.26',
  12:'10.04.26',13:'17.04.26',14:'24.04.26',
};

function formatDate(d: string | undefined): string {
  if (!d) return '';
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(d)) return d;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
  return d;
}

export default function ResultsContent({ games, logos }: { games: GameResult[]; logos: Record<string, string> }) {
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
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/15 px-4 py-2 text-base font-black text-orange-400">
                מחזור {r} · {formatDate(grouped[r][0]?.date) || FALLBACK_DATES[r] || ''}
              </div>
              <div className="h-px flex-1 bg-white/[0.05]" />
              <span className="text-sm font-black text-[#8aaac8]">{grouped[r].length} משחקים</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {grouped[r].map((g, i) => <GameCard key={i} game={g} logos={logos} />)}
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
