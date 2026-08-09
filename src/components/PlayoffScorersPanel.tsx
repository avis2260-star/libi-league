'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/TranslationProvider';
import { displayName } from '@/lib/names';

export type ScorerRow = {
  id: string;
  name: string;
  photo_url: string | null;
  jersey_number: number | null;
  team_name: string | null;
  games: number;
  points: number;
  three_pointers: number;
  fouls: number;
};

type SortKey = 'games' | 'points' | 'avgPoints' | 'avg3' | 'avgFouls';

const MEDAL = ['🥇', '🥈', '🥉'];

function fmtAvg(total: number, games: number): string {
  if (!games) return '0';
  return (total / games).toFixed(1);
}

// Column metadata drives both the sortable headers and the per-row cells so the
// header labels, sort comparators, and the mobile active-metric cell can never
// drift apart. `he` is the header label, `mobileHe` the compact caption shown
// on the single stat cell that phones display.
const COLUMNS: {
  key: SortKey;
  he: string;
  mobileHe: string;
  accent: string;
  value: (p: ScorerRow) => number; // numeric value used for sorting
  display: (p: ScorerRow) => string; // formatted cell text
}[] = [
  { key: 'games',     he: 'משחקים',       mobileHe: 'משחקים',       accent: 'text-[#c8d8e8]',   value: p => p.games,                                    display: p => String(p.games) },
  { key: 'points',    he: 'סה״כ נק׳',     mobileHe: 'נק׳',          accent: 'text-orange-400',  value: p => p.points,                                   display: p => String(p.points) },
  { key: 'avgPoints', he: 'ממוצע נק׳',    mobileHe: 'ממוצע נק׳',    accent: 'text-emerald-400', value: p => (p.games ? p.points / p.games : 0),         display: p => fmtAvg(p.points, p.games) },
  { key: 'avg3',      he: 'ממוצע 3נק׳',   mobileHe: 'ממוצע 3נק׳',   accent: 'text-sky-400',     value: p => (p.games ? p.three_pointers / p.games : 0), display: p => fmtAvg(p.three_pointers, p.games) },
  { key: 'avgFouls',  he: 'ממוצע פאולים', mobileHe: 'ממוצע פאולים', accent: 'text-rose-400',    value: p => (p.games ? p.fouls / p.games : 0),          display: p => fmtAvg(p.fouls, p.games) },
];

// Scoring-leaders leaderboard — the "שחקנים פעילים" tab panel. Sortable by any
// stat column: click a header on desktop, or use the pill row on mobile (the
// header is hidden there).
export default function PlayoffScorersPanel({ scorers }: { scorers: ScorerRow[] }) {
  const { t, lang } = useLang();
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const activeCol = COLUMNS.find(c => c.key === sortKey)!;
  const arrow = sortDir === 'desc' ? '▼' : '▲';

  function onSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(k); setSortDir('desc'); }
  }

  const sorted = useMemo(() => {
    const col = COLUMNS.find(c => c.key === sortKey)!;
    return [...scorers].sort((a, b) => {
      const d = col.value(b) - col.value(a); // descending baseline
      const primary = sortDir === 'desc' ? d : -d;
      if (primary !== 0) return primary;
      return b.points - a.points; // stable tie-break: more points first
    });
  }, [scorers, sortKey, sortDir]);

  // The points bar stays scaled to the top scorer regardless of the active sort.
  const maxPts = useMemo(() => Math.max(1, ...scorers.map(s => s.points)), [scorers]);

  // Medals only make sense for the canonical scoring order; a "gold medal for
  // most fouls" would be nonsense, so fall back to plain rank numbers otherwise.
  const showMedals = sortKey === 'points' && sortDir === 'desc';

  return (
    <section className="space-y-3">
      <h2 className="text-base font-black text-white flex items-center gap-2 font-heading">
        <span>🏅</span>
        {t('מובילי הפלייאוף')}
      </h2>

      {scorers.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] py-16 text-center">
          <p className="text-4xl mb-3">🏀</p>
          <p className="font-bold text-[#8aaac8]">{t('עדיין אין סטטיסטיקה לפלייאוף')}</p>
        </div>
      ) : (
        <>
          {/* Mobile sort control — the desktop header row is hidden on phones,
              so offer a pill row to choose the sort category and direction. */}
          <div className="sm:hidden -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
            <span className="shrink-0 text-[11px] font-black text-[#5a7a9a]">{t('מיין לפי')}:</span>
            {COLUMNS.map(c => (
              <button
                key={c.key}
                type="button"
                onClick={() => onSort(c.key)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                  sortKey === c.key
                    ? 'border-orange-500/50 bg-orange-500/15 text-orange-300'
                    : 'border-white/[0.08] bg-white/[0.03] text-[#8aaac8]'
                }`}
              >
                {t(c.he)}{sortKey === c.key ? ` ${arrow}` : ''}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">

            {/* Table header — every stat column is a sort button */}
            <div className="hidden sm:grid grid-cols-[3rem_1fr_4rem_4rem_4.5rem_4.5rem_4.5rem] gap-2 px-5 py-3 border-b border-white/[0.08] text-[11px] font-black uppercase tracking-widest text-[#5a7a9a]">
              <span className="text-center">{t('מקום')}</span>
              <span>{t('שחקן')}</span>
              {COLUMNS.map(c => {
                const active = sortKey === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onSort(c.key)}
                    title={`${t('מיין לפי')} ${t(c.he)}`}
                    className={`flex items-center justify-center gap-1 uppercase tracking-widest transition-colors ${
                      active ? 'text-orange-300' : 'text-[#5a7a9a] hover:text-[#9ab6d4]'
                    }`}
                  >
                    <span>{t(c.he)}</span>
                    <span className="text-[8px] leading-none">{active ? arrow : '↕'}</span>
                  </button>
                );
              })}
            </div>

            {sorted.map((p, i) => (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="flex sm:grid sm:grid-cols-[3rem_1fr_4rem_4rem_4.5rem_4.5rem_4.5rem] gap-0 sm:gap-2 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors group"
              >
                {/* Rank */}
                <div className="w-14 sm:w-auto shrink-0 px-3 sm:px-0 py-4 flex flex-col items-center justify-center">
                  {showMedals && i < 3 ? (
                    <span className="text-xl">{MEDAL[i]}</span>
                  ) : (
                    <span className="text-sm font-black font-stats text-[#5a7a9a]">{i + 1}</span>
                  )}
                </div>

                {/* Player */}
                <div className="flex flex-1 min-w-0 items-center gap-3 py-3 pr-0 sm:pr-2">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.10] bg-white/[0.04]">
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-black text-[#4a6a8a]">
                        {p.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="break-words font-bold text-white group-hover:text-orange-300 transition-colors leading-tight font-heading">
                      {displayName(p.name, lang)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.jersey_number !== null && (
                        <span className="text-[10px] font-bold text-orange-400/80 shrink-0 font-stats">#{p.jersey_number}</span>
                      )}
                      {p.team_name && (
                        <span className="min-w-0 break-words text-xs font-bold text-[#8aaac8] font-body">{displayName(p.team_name, lang)}</span>
                      )}
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.06]">
                      <div
                        className="h-1 rounded-full bg-gradient-to-l from-orange-500 to-orange-700"
                        style={{ width: `${Math.round((p.points / maxPts) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Games (desktop) */}
                <div className={`hidden sm:block py-4 text-center ${sortKey === 'games' ? 'bg-orange-500/[0.06]' : ''}`}>
                  <p className="text-sm font-black text-[#c8d8e8] font-stats">{p.games}</p>
                </div>

                {/* Total points column (desktop) + active-metric cell (mobile) */}
                <div className={`w-20 sm:w-auto shrink-0 px-2 py-4 text-center ${sortKey === 'points' ? 'sm:bg-orange-500/[0.06]' : ''}`}>
                  <p className="hidden sm:block text-lg font-black text-orange-400 font-stats">{p.points}</p>
                  <p className={`sm:hidden text-lg font-black font-stats ${activeCol.accent}`}>{activeCol.display(p)}</p>
                  <p className="sm:hidden mt-0.5 text-[10px] font-bold text-[#8aaac8] font-body break-words">{t(activeCol.mobileHe)}</p>
                </div>

                {/* Avg points / game (desktop) */}
                <div className={`hidden sm:block py-4 text-center ${sortKey === 'avgPoints' ? 'bg-orange-500/[0.06]' : ''}`}>
                  <p className="text-base font-black text-emerald-400 font-stats">{fmtAvg(p.points, p.games)}</p>
                  <p className="text-[9px] font-bold text-[#5a7a9a] font-body">{t('למשחק')}</p>
                </div>

                {/* Avg 3pt (desktop) */}
                <div className={`hidden sm:block py-4 text-center ${sortKey === 'avg3' ? 'bg-orange-500/[0.06]' : ''}`}>
                  <p className="text-base font-black text-sky-400 font-stats">{fmtAvg(p.three_pointers, p.games)}</p>
                  <p className="text-[9px] font-bold text-[#5a7a9a] font-body">{t('למשחק')}</p>
                </div>

                {/* Avg fouls (desktop) */}
                <div className={`hidden sm:block py-4 text-center ${sortKey === 'avgFouls' ? 'bg-orange-500/[0.06]' : ''}`}>
                  <p className="text-base font-black text-rose-400 font-stats">{fmtAvg(p.fouls, p.games)}</p>
                  <p className="text-[9px] font-bold text-[#5a7a9a] font-body">{t('למשחק')}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="text-center text-xs text-[#3a5a7a] sm:hidden">
        {t('סובב למצב אופקי לצפייה בממוצעים')}
      </p>
    </section>
  );
}
