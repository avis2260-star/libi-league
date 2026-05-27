import Link from 'next/link';
import { st } from '@/lib/get-lang';

type Lang = 'he' | 'en';

/**
 * Big home-page celebration banner for the cup champion or the league champion
 * (playoff winner). Renders one of two visual variants:
 *
 *   • 'hero'    — full ~600px tall card; used for the first 30 days after the
 *                 final game was decided.
 *   • 'compact' — slim ~80px strip; used from day 31 until the admin starts a
 *                 new season (at which point page.tsx stops rendering this
 *                 component because the current_season has no decided final).
 *
 * Data is fetched server-side in src/app/page.tsx; this component is pure
 * presentation so it works inside an async server page without a 'use client'.
 */

export type ChampionBannerProps = {
  type: 'cup' | 'league';
  variant: 'hero' | 'compact';
  teamName: string;
  teamLogoUrl: string | null;
  opponentName: string;
  homeIsChampion: boolean;            // is the champion on the home side of the final?
  homeScore: number | null;
  awayScore: number | null;
  decidedOnLabel: string | null;      // formatted date string for the chip, or null
  season: string;                      // "2025-2026"
  finalGameHref: string | null;       // /cup/game/[id] or /playoff/series/[num]
  bracketHref: string;                 // /cup or /playoff
  videoUrl: string | null;             // optional youtube link for "Watch Final"
  lang: Lang;
};

export default function ChampionBanner(props: ChampionBannerProps) {
  return props.variant === 'hero' ? <Hero {...props} /> : <Compact {...props} />;
}

// ── Hero variant ───────────────────────────────────────────────────────────

function Hero(p: ChampionBannerProps) {
  const T = (he: string) => st(he, p.lang);
  const en = p.lang === 'en';
  const eyebrow = p.type === 'cup'
    ? (en ? '🥇 Cup Holder'  : '🥇 מחזיקת הגביע')
    : (en ? '🎖️ League Champion' : '🎖️ אלופה');
  const title = p.type === 'cup'
    ? (en ? `Cup Holder · Libi League · ${p.season}` : `מחזיקת גביע ליגת ליבי · ${p.season}`)
    : (en ? `Libi League Champion · ${p.season}`      : `אלופת ליגת ליבי · עונת ${p.season}`);
  const subtitle = p.type === 'cup'
    ? (en ? 'Cup Final Winner' : 'מנצחת גמר הגביע')
    : (en ? 'Playoff Winner · Season Champion' : 'מנצחת הפלייאוף · אלופת העונה');
  const watchLabel = en ? 'Watch the Final' : 'צפו בגמר';
  const bracketLabel = p.type === 'cup'
    ? (en ? 'Cup Bracket →' : 'בראקט הגביע ←')
    : (en ? 'Playoff Bracket →' : 'בראקט הפלייאוף ←');

  const ringTone = p.type === 'cup' ? 'amber' : 'orange';

  // Final score: orient as champion : opponent
  const champScore = p.homeIsChampion ? p.homeScore : p.awayScore;
  const oppScore   = p.homeIsChampion ? p.awayScore : p.homeScore;

  return (
    <section
      dir={p.lang === 'he' ? 'rtl' : 'ltr'}
      className={`relative overflow-hidden rounded-3xl border bg-[#0c1825] px-6 py-8 sm:px-8 sm:py-10 ${
        ringTone === 'amber'
          ? 'border-amber-500/35 shadow-[0_30px_80px_-20px_rgba(245,158,11,0.25)]'
          : 'border-orange-500/45 shadow-[0_30px_80px_-20px_rgba(245,158,11,0.35)]'
      }`}
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 50% -20%, rgba(245,158,11,0.28) 0%, transparent 65%), linear-gradient(180deg, #102136 0%, #0b1726 100%)',
      }}
    >
      {/* Decorative sparkles */}
      <span className="pointer-events-none absolute left-[8%] top-[10%]  h-1 w-1   rounded-full bg-amber-200 shadow-[0_0_10px_2px_rgba(253,230,138,0.8)] opacity-70" />
      <span className="pointer-events-none absolute right-[12%] top-[22%] h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_10px_2px_rgba(253,230,138,0.8)] opacity-70" />
      <span className="pointer-events-none absolute left-[14%] top-[70%] h-1 w-1   rounded-full bg-amber-200 shadow-[0_0_10px_2px_rgba(253,230,138,0.8)] opacity-60" />
      <span className="pointer-events-none absolute right-[10%] top-[80%] h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_10px_2px_rgba(253,230,138,0.8)] opacity-70" />
      <span className="pointer-events-none absolute left-1/2 top-[8%]   h-1 w-1   rounded-full bg-amber-200 shadow-[0_0_10px_2px_rgba(253,230,138,0.8)] opacity-60" />

      {/* Eyebrow */}
      <div className="mb-4 flex items-center justify-center gap-3 text-[11px] sm:text-[13px] font-black uppercase tracking-[0.22em] text-amber-200">
        <span className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
        <span>{eyebrow}</span>
        <span className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
      </div>

      <div className="flex flex-col items-center text-center gap-3">
        {/* Trophy */}
        <div className="text-5xl sm:text-6xl drop-shadow-[0_8px_20px_rgba(245,158,11,0.5)]">🏆</div>

        {/* Logo */}
        <div className="relative grid place-items-center h-24 w-24 sm:h-32 sm:w-32 rounded-full border-2 border-amber-500/50 bg-white/[0.03] shadow-[0_0_40px_-5px_rgba(245,158,11,0.45)]">
          <span className="pointer-events-none absolute -inset-2 rounded-full border border-amber-200/20" />
          {p.teamLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.teamLogoUrl} alt={p.teamName} className="h-[84px] w-[84px] sm:h-[110px] sm:w-[110px] rounded-full object-cover" />
          ) : (
            <span className="text-4xl sm:text-5xl font-black text-amber-200 drop-shadow-[0_4px_16px_rgba(245,158,11,0.4)]">
              {p.teamName.trim().charAt(0)}
            </span>
          )}
        </div>

        <p className="text-[12px] sm:text-sm font-black tracking-[0.1em] text-amber-200">{T(title)}</p>
        <h2 className="text-3xl sm:text-5xl font-black leading-none bg-gradient-to-b from-white to-amber-200 bg-clip-text text-transparent">
          {T(p.teamName)}
        </h2>
        <p className="text-xs sm:text-sm font-bold text-[#8aaac8]">{T(subtitle)}</p>

        {/* Final score */}
        {p.homeScore != null && p.awayScore != null && (
          <div className="mt-4 inline-flex items-center justify-center gap-2 sm:gap-4 rounded-2xl border border-amber-500/25 bg-black/25 px-4 py-3">
            <span className="max-w-[100px] sm:max-w-[160px] truncate text-xs sm:text-sm font-black text-amber-200">{T(p.teamName)}</span>
            <span className="font-stats text-xl sm:text-3xl font-black tabular-nums text-white">
              {champScore} <span className="text-[#5a7a9a]">:</span> {oppScore}
            </span>
            <span className="max-w-[100px] sm:max-w-[160px] truncate text-xs sm:text-sm font-bold text-[#8aaac8]">{T(p.opponentName)}</span>
          </div>
        )}

        {/* Meta chips */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs font-bold text-[#8aaac8]">
          {p.decidedOnLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1">
              📅 {p.decidedOnLabel}
            </span>
          )}
          <span className="text-[#5a7a9a]">·</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1">
            {p.type === 'cup' ? (en ? 'Cup Final' : 'גמר הגביע') : (en ? 'Playoff Final' : 'גמר הפלייאוף')}
          </span>
        </div>

        {/* CTAs */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {p.videoUrl && p.finalGameHref && (
            <Link
              href={p.finalGameHref}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-700/40 bg-gradient-to-b from-amber-200 to-amber-500 px-4 py-2 text-xs sm:text-sm font-black text-amber-950 transition hover:-translate-y-px"
            >
              🎬 {watchLabel}
            </Link>
          )}
          {!p.videoUrl && p.finalGameHref && (
            <Link
              href={p.finalGameHref}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-700/40 bg-gradient-to-b from-amber-200 to-amber-500 px-4 py-2 text-xs sm:text-sm font-black text-amber-950 transition hover:-translate-y-px"
            >
              📊 {en ? 'Box Score' : 'גיליון המשחק'}
            </Link>
          )}
          <Link
            href={p.bracketHref}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs sm:text-sm font-black text-[#c8d8e8] transition hover:bg-white/[0.07] hover:border-white/[0.18]"
          >
            {bracketLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Compact variant ────────────────────────────────────────────────────────

function Compact(p: ChampionBannerProps) {
  const T = (he: string) => st(he, p.lang);
  const en = p.lang === 'en';
  const title = p.type === 'cup'
    ? (en ? `Cup Holder · ${p.season}` : `מחזיקת הגביע · ${p.season}`)
    : (en ? `Libi League Champion · ${p.season}` : `אלופת ליגת ליבי · ${p.season}`);
  const champScore = p.homeIsChampion ? p.homeScore : p.awayScore;
  const oppScore   = p.homeIsChampion ? p.awayScore : p.homeScore;

  return (
    <Link
      href={p.finalGameHref ?? p.bracketHref}
      dir={p.lang === 'he' ? 'rtl' : 'ltr'}
      className="relative block overflow-hidden rounded-2xl border border-amber-500/35 px-4 py-3 transition hover:border-amber-400/50"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 50% -50%, rgba(245,158,11,0.20) 0%, transparent 65%), linear-gradient(180deg, #102136 0%, #0b1726 100%)',
      }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="text-3xl sm:text-4xl shrink-0">🏆</span>
        <div className="grid place-items-center h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full border border-amber-500/45 bg-white/[0.03]">
          {p.teamLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.teamLogoUrl} alt={p.teamName} className="h-9 w-9 sm:h-11 sm:w-11 rounded-full object-cover" />
          ) : (
            <span className="text-base sm:text-lg font-black text-amber-200">{p.teamName.trim().charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] sm:text-[11px] font-black tracking-[0.16em] text-amber-200">{T(title)}</p>
          <h3 className="truncate text-base sm:text-lg font-black bg-gradient-to-b from-white to-amber-200 bg-clip-text text-transparent">
            {T(p.teamName)}
          </h3>
          <p className="truncate text-[11px] sm:text-xs font-bold text-[#8aaac8]">
            {p.homeScore != null && p.awayScore != null
              ? <>{champScore} : {oppScore} {en ? 'vs' : '·'} {T(p.opponentName)}</>
              : T(p.opponentName)}
            {p.decidedOnLabel && <> · {p.decidedOnLabel}</>}
          </p>
        </div>
        <span className="shrink-0 text-amber-300 text-lg sm:text-xl">{p.lang === 'he' ? '←' : '→'}</span>
      </div>
    </Link>
  );
}
