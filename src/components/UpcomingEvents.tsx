import Link from 'next/link';

/**
 * Upcoming cup-games hero section. Renders each match within the
 * "approaching" window (today + N days) as a large, prominent card —
 * meant to live between the league scoreboard strip (above) and the
 * last-round results (below) on the homepage.
 *
 * Server component — receives pre-built `events` from the homepage
 * server code so it doesn't have to know about cup_games shape.
 */

export type UpcomingEvent = {
  type: 'cup';
  isoDate: string;
  displayDate: string;
  heDayLabel: string;
  /** Number of days from today to the game (0 = today, 1 = tomorrow). */
  daysUntil: number;
  roundName: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
};

function TeamLogo({ logo, name, large }: { logo: string | null; name: string; large?: boolean }) {
  const size = large ? 'h-20 w-20 sm:h-24 sm:w-24 text-2xl' : 'h-10 w-10 text-sm';
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt={name} className={`${size} rounded-full border-2 border-white/15 object-cover shadow-lg`} />
    );
  }
  const letter = [...name].find((c) => c.trim()) ?? '?';
  return (
    <span className={`${size} flex items-center justify-center rounded-full border-2 border-white/15 bg-white/[0.06] font-black text-[#7aaac8] shadow-lg`}>
      {letter}
    </span>
  );
}

/** Hebrew "in N days" / "today" / "tomorrow" countdown. */
function countdownLabel(days: number, lang: 'he' | 'en'): string {
  if (lang === 'en') {
    if (days <= 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }
  if (days <= 0) return 'היום';
  if (days === 1) return 'מחר';
  return `בעוד ${days} ימים`;
}

/** Detect the cup final by its round name — gets the celebratory gold treatment. */
function isFinal(roundName: string): boolean {
  const n = roundName.trim();
  return n === 'גמר' || /\bfinal\b/i.test(n);
}

export default function UpcomingEvents({
  events,
  lang,
}: {
  events: UpcomingEvent[];
  lang: 'he' | 'en';
}) {
  if (!events.length) return null;

  const en = lang === 'en';

  return (
    <section dir={en ? 'ltr' : 'rtl'} className="space-y-3">
      <header className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-base font-black text-white font-heading">
          🏆 {en ? 'Coming up in the cup' : 'מתקרב בגביע'}
        </h2>
        <p className="text-[11px] font-bold text-[#5a7a9a] font-body">
          {events.length === 1
            ? (en ? '1 game' : 'משחק 1')
            : (en ? `${events.length} games` : `${events.length} משחקים`)}
        </p>
      </header>

      <div className="space-y-3">
        {events.map((ev) => {
          const final = isFinal(ev.roundName);
          const urgent = ev.daysUntil <= 3; // within ~3 days → extra emphasis
          const gradientClass = final
            ? 'from-yellow-500/30 via-amber-600/15 to-orange-600/20'
            : 'from-amber-500/20 via-orange-500/[0.08] to-orange-600/15';
          const borderClass = final
            ? 'border-yellow-400/40 shadow-[0_0_40px_-12px_rgba(250,204,21,0.4)]'
            : 'border-amber-500/30';

          return (
            <div
              key={`${ev.isoDate}-${ev.homeTeam}-${ev.awayTeam}`}
              className={`relative block overflow-hidden rounded-3xl border-2 ${borderClass} bg-gradient-to-br ${gradientClass} transition-all hover:shadow-xl group`}
            >
              {/* Decorative trophy watermark */}
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-6 -left-6 select-none text-[10rem] leading-none opacity-[0.06]"
              >
                🏆
              </span>

              <div className="relative p-5 sm:p-7">
                {/* Top row — round name + countdown */}
                <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
                      final
                        ? 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/40'
                        : 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                    }`}>
                      🏆 {en ? `Cup · ${ev.roundName}` : `גביע · ${ev.roundName}`}
                    </span>
                    {urgent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-red-300 animate-pulse">
                        {en ? 'GAME WEEK' : 'שבוע המשחק'}
                      </span>
                    )}
                  </div>

                  <div className="text-end">
                    <p className={`text-sm sm:text-base font-black uppercase tracking-widest ${
                      urgent ? 'text-red-300' : 'text-amber-300/90'
                    }`}>
                      {countdownLabel(ev.daysUntil, lang)}
                    </p>
                    <p className="mt-1 text-lg sm:text-xl font-black text-white tabular-nums font-stats leading-tight">
                      {ev.heDayLabel} · {ev.displayDate}
                    </p>
                  </div>
                </div>

                {/* Matchup — big team logos and names */}
                <div className="flex items-center justify-around gap-3 sm:gap-6">
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    <TeamLogo logo={ev.homeLogo} name={ev.homeTeam} large />
                    <p className="text-sm sm:text-base font-black text-white text-center truncate max-w-full font-heading">
                      {ev.homeTeam}
                    </p>
                    {!final && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#7aaac8]">
                        {en ? 'Home' : 'בית'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className={`text-3xl sm:text-4xl font-black tabular-nums font-stats ${
                      final ? 'text-yellow-300' : 'text-amber-300'
                    }`}>
                      VS
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                    <TeamLogo logo={ev.awayLogo} name={ev.awayTeam} large />
                    <p className="text-sm sm:text-base font-black text-white text-center truncate max-w-full font-heading">
                      {ev.awayTeam}
                    </p>
                    {!final && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#7aaac8]">
                        {en ? 'Away' : 'חוץ'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer actions — primary CTA goes to the full bracket;
                    secondary link points to the AI pre-match commentary. */}
                <div className="mt-6 flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                  <Link
                    href="/cup"
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.03] ${
                      final
                        ? 'bg-yellow-400/20 border border-yellow-400/50 text-yellow-100 hover:bg-yellow-400/30'
                        : 'bg-amber-500/20 border border-amber-500/50 text-amber-100 hover:bg-amber-500/30'
                    }`}
                  >
                    {en ? 'View bracket →' : '← לבראקט המלא'}
                  </Link>
                  <Link
                    href="/events"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#c8d8e8] transition-all hover:scale-[1.03] hover:bg-white/[0.08] hover:text-orange-300"
                  >
                    {en ? 'Pre-match →' : '← לקראת המשחק'}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
