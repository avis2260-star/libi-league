'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/TranslationProvider';

export type PlayoffStripGame = {
  seriesNumber: number;
  stageKey: 'qf' | 'sf' | 'final';
  gameNumber: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  /** Series tally oriented to this card's home/away teams. */
  homeWins: number;
  awayWins: number;
  dateLabel: string;   // "29.06" — empty when no date yet
  dayLabel: string;    // "ראשון" / "Sun" — empty when no date yet
  location: string | null;
};

const STAGE_LABEL: Record<'he' | 'en', Record<PlayoffStripGame['stageKey'], string>> = {
  he: { qf: 'רבע גמר', sf: 'חצי גמר', final: 'גמר' },
  en: { qf: 'Quarterfinal', sf: 'Semifinal', final: 'Final' },
};

// Accent per stage — quarters cool blue, semis orange, final gold.
const STAGE_ACCENT: Record<PlayoffStripGame['stageKey'], { text: string; dot: string }> = {
  qf:    { text: 'text-sky-400',    dot: 'bg-sky-400' },
  sf:    { text: 'text-orange-400', dot: 'bg-orange-400' },
  final: { text: 'text-[#e0c97a]',  dot: 'bg-[#e0c97a]' },
};

function TeamLogo({ logo, name }: { logo: string | null; name: string }) {
  const { t } = useLang();
  return (
    <div className="h-7 w-7 shrink-0 rounded-full border border-white/10 bg-white/[0.05] overflow-hidden flex items-center justify-center text-[10px]">
      {logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logo} alt={t(name)} className="h-full w-full object-cover" />
        : <span className="font-black text-[#4a6a8a]">{[...t(name)].find(c => c.trim()) ?? '?'}</span>}
    </div>
  );
}

/* ── Playoff scoreboard strip ──────────────────────────────────────────────
   Drops into the home page in place of the regular-season ScoreboardStrip when
   the season phase is 'playoffs'. Shows the next upcoming game of each active
   series (best-of-3 tally included); each card links to its series page. */
export default function PlayoffScoreboardStrip({ games }: { games: PlayoffStripGame[] }) {
  const { t, lang } = useLang();
  const en = lang === 'en';
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  }

  if (games.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-[#e0c97a]/20 bg-gradient-to-b from-[#12100a] to-[#0d1a28]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-3 py-2">
        <div className="shrink-0 flex items-center gap-1.5">
          <span className="text-base leading-none">🏆</span>
          <p className="text-sm font-black tracking-wide text-[#e0c97a] font-heading">
            {en ? 'Playoffs' : 'פלייאוף'}
          </p>
        </div>
        <div className="h-6 w-px bg-white/[0.06] shrink-0" />
        <p className="flex-1 text-sm font-black text-[#8aaac8] font-body">{en ? 'Upcoming games' : 'משחקים קרובים'}</p>

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
          href="/playoff"
          className="shrink-0 text-[11px] font-bold text-[#e0c97a] hover:text-yellow-300 transition-colors pr-1"
        >
          {en ? '← Bracket' : '← לעץ הפלייאוף'}
        </Link>
      </div>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {games.map((g, i) => {
          const accent = STAGE_ACCENT[g.stageKey];
          const started = g.homeWins > 0 || g.awayWins > 0;
          return (
            <Link
              key={`${g.seriesNumber}-${g.gameNumber}`}
              href={`/playoff/series/${g.seriesNumber}`}
              className={`relative group shrink-0 w-48 p-3 text-right transition-colors hover:bg-white/[0.04] ${
                i < games.length - 1 ? 'border-l border-white/[0.05]' : ''
              }`}
            >
              {/* Stage badge */}
              <div className={`mb-2.5 flex items-center gap-1 text-[9px] font-bold ${accent.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                {STAGE_LABEL[en ? 'en' : 'he'][g.stageKey]}
                <span className="text-[#3a5a7a]">· {en ? `Game ${g.gameNumber}` : `משחק ${g.gameNumber}`}</span>
              </div>

              {/* Home team + series tally */}
              <div className="flex items-center gap-2 mb-1">
                <TeamLogo logo={g.homeLogo} name={g.homeTeam} />
                <p className="truncate text-xs font-black text-[#e8edf5] group-hover:text-[#e0c97a] transition-colors leading-snug flex-1 font-heading">
                  {t(g.homeTeam)}
                </p>
                <span className={`shrink-0 text-xs font-black font-stats ${started ? 'text-white' : 'text-[#3a5a7a]'}`}>{g.homeWins}</span>
              </div>

              {/* VS divider */}
              <div className="my-1.5 flex items-center gap-1.5 pr-9">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-[9px] font-black text-[#3a5a7a]">VS</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              {/* Away team + series tally */}
              <div className="flex items-center gap-2">
                <TeamLogo logo={g.awayLogo} name={g.awayTeam} />
                <p className="truncate text-xs font-black text-[#e8edf5] group-hover:text-[#e0c97a] transition-colors leading-snug flex-1 font-heading">
                  {t(g.awayTeam)}
                </p>
                <span className={`shrink-0 text-xs font-black font-stats ${started ? 'text-white' : 'text-[#3a5a7a]'}`}>{g.awayWins}</span>
              </div>

              {/* Footer: date + best-of-3 hint + location */}
              <p className="mt-2 text-xs font-black text-[#8aaac8] font-body">
                {g.dateLabel
                  ? <span className="font-stats text-[#c8d8e8]">{g.dayLabel ? `${g.dayLabel} · ` : ''}{g.dateLabel}</span>
                  : <span className="text-[#5a7a9a]">{en ? 'TBD' : 'טרם נקבע'}</span>}
                <span className="mx-1 text-[#3a5a7a]">·</span>
                <span className={accent.text}>{g.stageKey === 'final' ? (en ? 'Single game' : 'משחק אחד') : (en ? 'Best of 3' : 'הטוב מ-3')}</span>
              </p>
              {g.location && (
                <p className="mt-0.5 truncate text-[10px] font-bold text-[#5a7a9a] font-body">📍 {g.location}</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
