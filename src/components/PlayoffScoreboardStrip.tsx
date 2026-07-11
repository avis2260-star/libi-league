'use client';

import Link from 'next/link';
import { useLang } from '@/components/TranslationProvider';
import { displayName } from '@/lib/names';
import TeamLogoZoom from '@/components/TeamLogoZoom';

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
  dateLabel: string;   // "29.06" — empty when no date
  dayLabel: string;    // "ראשון" / "Sun" — empty when no date
  timeLabel: string;   // "20:30" — empty when no time
  location: string | null;
};

const STAGE_LABEL: Record<'he' | 'en', Record<PlayoffStripGame['stageKey'], string>> = {
  he: { qf: 'רבע גמר', sf: 'חצי גמר', final: 'גמר' },
  en: { qf: 'Quarterfinal', sf: 'Semifinal', final: 'Final' },
};

// Accent per stage — quarters cool blue, semis orange, final gold.
const STAGE_ACCENT: Record<PlayoffStripGame['stageKey'], { text: string; dot: string; bg: string; border: string }> = {
  qf:    { text: 'text-sky-400',    dot: 'bg-sky-400',    bg: 'bg-sky-400/10',    border: '#38bdf8' },
  sf:    { text: 'text-orange-400', dot: 'bg-orange-400', bg: 'bg-orange-400/10', border: '#fb923c' },
  final: { text: 'text-[#e0c97a]',  dot: 'bg-[#e0c97a]',  bg: 'bg-[#e0c97a]/10',  border: '#e0c97a' },
};

function TeamLogo({ logo, name }: { logo: string | null; name: string }) {
  const { t } = useLang();
  return (
    <div className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-white/[0.05] overflow-hidden flex items-center justify-center text-xs">
      {logo
        ? <TeamLogoZoom src={logo} alt={t(name)} className="h-full w-full object-cover" />
        : <span className="font-black text-[#4a6a8a]">{[...t(name)].find(c => c.trim()) ?? '?'}</span>}
    </div>
  );
}

/* ── Playoff scoreboard strip ──────────────────────────────────────────────
   Replaces the regular-season ScoreboardStrip on the home page during the
   playoffs. Cards stretch to fill the strip's full width (responsive auto-fit
   grid) and show each active series' next game with its best-of-3 tally. */
export default function PlayoffScoreboardStrip({ games }: { games: PlayoffStripGame[] }) {
  const { t, lang } = useLang();
  const en = lang === 'en';

  if (games.length === 0) return null;

  return (
    <section className="rounded-xl overflow-hidden border border-[#e0c97a]/20 bg-gradient-to-b from-[#14110a] to-[#0d1a28]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <span className="text-base leading-none">🏆</span>
        <p className="text-sm font-black tracking-wide text-[#e0c97a] font-heading">{en ? 'Playoffs' : 'פלייאוף'}</p>
        <span className="text-[#3a5a7a]">·</span>
        <p className="text-sm font-black text-[#8aaac8] font-body">{en ? 'Upcoming games' : 'משחקים קרובים'}</p>
        <Link
          href="/playoff"
          className="ms-auto shrink-0 text-[11px] font-bold text-[#e0c97a] hover:text-yellow-300 transition-colors"
        >
          {en ? 'Bracket →' : 'לעץ הפלייאוף ←'}
        </Link>
      </div>

      {/* Stretched, responsive cards — auto-fit columns fill the full width. */}
      <div className="grid gap-px bg-white/[0.06] grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
        {games.map((g) => {
          const accent    = STAGE_ACCENT[g.stageKey];
          const started   = g.homeWins > 0 || g.awayWins > 0;
          const homeLeads = g.homeWins > g.awayWins;
          const awayLeads = g.awayWins > g.homeWins;
          return (
            <Link
              key={`${g.seriesNumber}-${g.gameNumber}`}
              href={`/playoff/series/${g.seriesNumber}`}
              className="group bg-[#0b1622] p-3 text-right transition-colors hover:bg-white/[0.03] border-t-2"
              style={{ borderTopColor: accent.border }}
            >
              {/* Stage badge + game number */}
              <div className="mb-3 flex items-center justify-between gap-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${accent.text} ${accent.bg}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                  {STAGE_LABEL[en ? 'en' : 'he'][g.stageKey]}
                </span>
                <span className="text-[10px] font-bold text-[#5a7a9a]">{en ? `Game ${g.gameNumber}` : `משחק ${g.gameNumber}`}</span>
              </div>

              {/* Home team + series wins */}
              <div className="flex items-center gap-2 mb-2">
                <TeamLogo logo={g.homeLogo} name={g.homeTeam} />
                <p className={`flex-1 min-w-0 break-words text-sm font-black leading-tight font-heading transition-colors group-hover:text-[#e0c97a] ${homeLeads ? 'text-white' : 'text-[#c8d8e8]'}`}>
                  {t(g.homeTeam)}
                </p>
                <span className={`shrink-0 text-lg font-black tabular-nums font-stats ${homeLeads ? 'text-[#e0c97a]' : started ? 'text-white' : 'text-[#3a5a7a]'}`}>{g.homeWins}</span>
              </div>

              {/* Away team + series wins */}
              <div className="flex items-center gap-2">
                <TeamLogo logo={g.awayLogo} name={g.awayTeam} />
                <p className={`flex-1 min-w-0 break-words text-sm font-black leading-tight font-heading transition-colors group-hover:text-[#e0c97a] ${awayLeads ? 'text-white' : 'text-[#c8d8e8]'}`}>
                  {t(g.awayTeam)}
                </p>
                <span className={`shrink-0 text-lg font-black tabular-nums font-stats ${awayLeads ? 'text-[#e0c97a]' : started ? 'text-white' : 'text-[#3a5a7a]'}`}>{g.awayWins}</span>
              </div>

              {/* Footer: date + format */}
              <div className="mt-3 flex items-center justify-between gap-1 border-t border-white/[0.05] pt-2">
                <span className="truncate text-base font-black text-white font-heading">
                  {g.dateLabel
                    ? <span>{g.dayLabel ? `${g.dayLabel} · ` : ''}{g.dateLabel}{g.timeLabel ? ` · ${g.timeLabel}` : ''}</span>
                    : <span className="text-[#5a7a9a]">{en ? 'TBD' : 'טרם נקבע'}</span>}
                </span>
                <span className={`shrink-0 text-[10px] font-black ${accent.text}`}>
                  {g.stageKey === 'final' ? (en ? 'Single game' : 'משחק אחד') : (en ? 'Best of 3' : 'הטוב מ-3')}
                </span>
              </div>
              {g.location && (
                <p className="mt-1 truncate text-sm font-black text-[#9ab6d4] font-body">📍 {displayName(g.location, lang)}</p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
