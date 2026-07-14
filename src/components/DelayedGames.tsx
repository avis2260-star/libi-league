'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/TranslationProvider';

export type DelayedPendingCard = {
  round: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  dateLabel: string;   // "12.06" — empty when no date
  dayLabel: string;    // "שישי" / "Fri" — empty when no date
  time: string | null;
  location: string | null;
  href: string;
};

export type DelayedFinishedCard = {
  round: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number;
  awayScore: number;
  dateLabel: string;
  href: string;
};

function TeamLogo({ logo, name, size = 'sm' }: { logo: string | null; name: string; size?: 'sm' | 'md' }) {
  const { t } = useLang();
  const cls = size === 'md' ? 'h-8 w-8 text-[10px]' : 'h-7 w-7 text-[10px]';
  return (
    <div className={`${cls} shrink-0 rounded-full border border-white/10 bg-white/[0.05] overflow-hidden flex items-center justify-center`}>
      {logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logo} alt={t(name)} className="h-full w-full object-cover" />
        : <span className="font-black text-[#4a6a8a]">{[...t(name)].find(c => c.trim()) ?? '?'}</span>}
    </div>
  );
}

/* ── Delayed (postponed / makeup) games on the home page ────────────────────
   Pending delayed games surface as a strip (so a postponed game stays visible
   after its round is over); once played, the result shows here too — tagged
   with the round it belonged to. */
export default function DelayedGames({
  pending,
  finished,
}: {
  pending: DelayedPendingCard[];
  finished: DelayedFinishedCard[];
}) {
  const { t, lang } = useLang();
  const en = lang === 'en';
  const scrollRef = useRef<HTMLDivElement>(null);

  if (pending.length === 0 && finished.length === 0) return null;

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  }

  const roundLabel = (r: number) =>
    r > 0 ? (en ? `Round ${r}` : `מחזור ${r}`) : (en ? 'Make-up' : 'השלמה');

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-white font-heading">
        <span className="rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 px-2 py-1 text-sm">⏱️</span>
        {en ? 'Delayed games' : 'משחקים דחויים'}
      </h2>

      {/* Pending delayed games — strip */}
      {pending.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-gradient-to-b from-[#1a1405] to-[#0d1a28] mb-4">
          <div className="flex items-center gap-3 border-b border-white/[0.05] px-3 py-2">
            <p className="flex-1 text-sm font-black text-amber-300/90 font-body">
              {en ? 'Awaiting make-up' : 'ממתינים להשלמה'}
            </p>
            <button onClick={() => scroll('right')} className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8aaac8] hover:bg-white/[0.08] hover:text-white transition-colors" aria-label="scroll right">›</button>
            <button onClick={() => scroll('left')} className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8aaac8] hover:bg-white/[0.08] hover:text-white transition-colors" aria-label="scroll left">‹</button>
          </div>

          <div ref={scrollRef} className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {pending.map((g, i) => (
              <Link
                key={`${g.round}-${g.homeTeam}-${g.awayTeam}`}
                href={g.href}
                className={`relative group shrink-0 w-48 p-3 text-right transition-colors hover:bg-white/[0.04] ${i < pending.length - 1 ? 'border-l border-white/[0.05]' : ''}`}
              >
                <div className="mb-2.5 flex items-center gap-1.5 text-[9px] font-bold text-amber-400">
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5">{roundLabel(g.round)}</span>
                  <span className="text-amber-400/80">⏱️ {en ? 'Postponed' : 'דחוי'}</span>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <TeamLogo logo={g.homeLogo} name={g.homeTeam} />
                  <p className="min-w-0 break-words text-xs font-black text-[#e8edf5] group-hover:text-amber-300 transition-colors leading-snug flex-1 font-heading">{t(g.homeTeam)}</p>
                </div>
                <div className="my-1.5 flex items-center gap-1.5 pr-9">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-[9px] font-black text-[#3a5a7a]">VS</span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>
                <div className="flex items-center gap-2">
                  <TeamLogo logo={g.awayLogo} name={g.awayTeam} />
                  <p className="min-w-0 break-words text-xs font-black text-[#e8edf5] group-hover:text-amber-300 transition-colors leading-snug flex-1 font-heading">{t(g.awayTeam)}</p>
                </div>

                <p className="mt-2 text-xs font-black text-[#8aaac8] font-body">
                  {g.dateLabel
                    ? <span className="font-stats text-[#c8d8e8]">{g.dayLabel ? `${g.dayLabel} · ` : ''}{g.dateLabel}{g.time ? ` · ${g.time}` : ''}</span>
                    : <span className="text-[#5a7a9a]">{en ? 'New date TBD' : 'מועד חדש ייקבע'}</span>}
                </p>
                {g.location && (
                  <p className="mt-0.5 break-words text-[10px] font-bold text-[#5a7a9a] font-body">📍 {g.location}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Finished delayed games — results tagged with their round */}
      {finished.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {finished.map((g, i) => {
            const homeWins = g.homeScore > g.awayScore;
            return (
              <Link
                key={`fin-${i}`}
                href={g.href}
                className="group rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-amber-500/[0.04]"
              >
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black">
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-400">{roundLabel(g.round)}</span>
                  <span className="text-amber-400/70">⏱️ {en ? 'Make-up result' : 'תוצאת השלמה'}</span>
                  {g.dateLabel && <span className="ms-auto font-stats text-[#5a7a9a]">{g.dateLabel}</span>}
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="flex min-w-0 items-center justify-end gap-2">
                    <p className={`min-w-0 break-words text-sm font-bold leading-tight font-heading ${homeWins ? 'text-white' : 'text-[#8aaac8]'}`}>{t(g.homeTeam)}</p>
                    <TeamLogo logo={g.homeLogo} name={g.homeTeam} />
                  </div>
                  <div className="min-w-[64px] shrink-0 rounded-lg bg-black/40 px-2 py-1.5 text-center">
                    <span className={`font-stats text-xl font-black tabular-nums ${homeWins ? 'text-amber-400' : 'text-[#8aaac8]'}`}>{g.homeScore}</span>
                    <span className="font-stats text-sm font-black text-[#8aaac8]"> : </span>
                    <span className={`font-stats text-xl font-black tabular-nums ${!homeWins ? 'text-amber-400' : 'text-[#8aaac8]'}`}>{g.awayScore}</span>
                  </div>
                  <div className="flex min-w-0 items-center justify-start gap-2">
                    <TeamLogo logo={g.awayLogo} name={g.awayTeam} />
                    <p className={`min-w-0 break-words text-sm font-bold leading-tight font-heading ${!homeWins ? 'text-white' : 'text-[#8aaac8]'}`}>{t(g.awayTeam)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
