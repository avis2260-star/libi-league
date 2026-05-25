export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLang, st } from '@/lib/get-lang';
import { resolveSeasonFromParams, listKnownSeasons } from '@/lib/current-season';
import { makeNameResolver } from '@/lib/team-name-resolver';
import SeasonPicker from '@/components/SeasonPicker';
import ArchiveBanner from '@/components/ArchiveBanner';
import MarkdownLite from '@/components/MarkdownLite';
import ArticleViewCounter from '@/components/ArticleViewCounter';

type CupGame = {
  id: string;
  round: string;
  round_order: number;
  game_number: number;
  home_team: string;
  away_team: string;
  date: string | null;
  played: boolean;
};

type PreviewRow = {
  id: string;
  cup_game_id: string;
  home_review: string;
  away_review: string;
  is_published: boolean;
  updated_at: string;
  view_count: number;
};

type TeamRow = { id: string; name: string; logo_url: string | null };

/** Strip quote glyphs + collapse whitespace + lowercase so cup_games.home_team
 *  ("ראשון \"גפן\" לציון") matches teams.name ("ראשון 'גפן' לציון") despite
 *  the curly/straight quote inconsistency that bit us on a similar page. */
function normKey(s: string): string {
  return s.replace(/["“”״''`׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

type Event = {
  cupGame: CupGame;
  preview: PreviewRow;
  parsedDate: Date | null;
  isFuture: boolean;
};

/** Same defensive parser the homepage uses for cup_games.date — handles both
 *  ISO ("2026-05-29") and admin-typed DD.MM[.YY] (e.g. "13.12.25", "29.05"). */
function parseFlexibleDate(s: string | null | undefined, season: string): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(trimmed)) {
    const native = new Date(trimmed);
    if (!isNaN(native.getTime())) return native;
  }

  const m = trimmed.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (!m) return null;

  const day   = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  let   year: number;

  if (m[3]) {
    year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
  } else {
    const seasonMatch = season.match(/^(\d{4})-(\d{4})$/);
    if (seasonMatch) {
      const startYear = parseInt(seasonMatch[1], 10);
      const endYear   = parseInt(seasonMatch[2], 10);
      year = month >= 8 ? startYear : endYear;
    } else {
      year = new Date().getFullYear();
    }
  }
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}.${mm}.${yy}`;
}

function fmtDay(d: Date, lang: 'he' | 'en'): string {
  const he = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (lang === 'en' ? en : he)[d.getDay()];
}

function TeamLogo({ logo, name, big }: { logo: string | null; name: string; big?: boolean }) {
  const size = big ? 'h-20 w-20 sm:h-24 sm:w-24 text-2xl' : 'h-12 w-12 text-sm';
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

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { viewing, current, isArchive } = await resolveSeasonFromParams(params);

  const [{ data: previewsData }, { data: teamsData }, lang, seasons] = await Promise.all([
    supabaseAdmin
      .from('match_previews')
      .select('id, cup_game_id, home_review, away_review, is_published, updated_at, view_count')
      .eq('season', viewing)
      .eq('is_published', true),
    supabaseAdmin
      .from('teams')
      .select('id, name, logo_url'),
    getLang(),
    listKnownSeasons(),
  ]);

  const T = (he: string) => st(he, lang);
  const previews = (previewsData ?? []) as PreviewRow[];
  const teamRows = (teamsData ?? []) as TeamRow[];

  // Name resolver maps any cached cup_games team string (with whatever quote
  // glyphs Excel left in it) to the canonical name from the admin Teams tab.
  // Quote-insensitive logo map keyed on normKey ensures the lookup still
  // works even if the resolver fails to canonicalize (e.g. team not yet
  // renamed in admin).
  const resolveTeamName = makeNameResolver(teamRows.map(t => ({ id: t.id, name: t.name })));
  const logoByKey: Record<string, string | null> = {};
  for (const t of teamRows) {
    if (t.name) logoByKey[normKey(t.name)] = t.logo_url;
  }
  function lookupLogo(name: string): string | null {
    if (!name) return null;
    // Try canonical (admin Teams tab) first, then the raw cup_games string.
    const canonical = resolveTeamName(name);
    return (
      logoByKey[normKey(canonical)] ??
      logoByKey[normKey(name)] ??
      null
    );
  }
  function displayTeamName(name: string): string {
    return resolveTeamName(name) || name;
  }

  // No published previews → empty state, but we still want to render the
  // page chrome (header, picker) so users understand they're on the right page.
  let events: Event[] = [];
  if (previews.length > 0) {
    const ids = previews.map((p) => p.cup_game_id);
    const { data: cupData } = await supabaseAdmin
      .from('cup_games')
      .select('id, round, round_order, game_number, home_team, away_team, date, played')
      .in('id', ids);
    const cupGames = (cupData ?? []) as CupGame[];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    events = previews
      .map((p): Event | null => {
        const cupGame = cupGames.find((c) => c.id === p.cup_game_id);
        if (!cupGame) return null;
        const parsedDate = parseFlexibleDate(cupGame.date, viewing);
        const isFuture = parsedDate ? parsedDate >= today : false;
        return { cupGame, preview: p, parsedDate, isFuture };
      })
      .filter((e): e is Event => e !== null);

    // Sort: future events closest-first, then past events most-recent-first.
    events.sort((a, b) => {
      if (a.isFuture !== b.isFuture) return a.isFuture ? -1 : 1;
      if (!a.parsedDate || !b.parsedDate) return 0;
      return a.isFuture
        ? a.parsedDate.getTime() - b.parsedDate.getTime()
        : b.parsedDate.getTime() - a.parsedDate.getTime();
    });
  }

  const featured  = events[0] ?? null;
  const secondary = events.slice(1);

  return (
    <div dir={lang === 'en' ? 'ltr' : 'rtl'} className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-white font-heading">
            🎤 {T('לקראת המשחק')}
          </h1>
          <p className="mt-1 text-sm font-bold text-[#8aaac8] font-body">
            {T('פרשנות מקצועית למשחקי הגביע')} · {viewing}
          </p>
        </div>
        <SeasonPicker current={current} viewing={viewing} seasons={seasons} />
      </div>

      {isArchive && <ArchiveBanner viewing={viewing} current={current} pathname="/events" />}

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
          <p className="text-5xl mb-3">📭</p>
          <p className="text-base font-bold text-[#8aaac8]">
            {T('עדיין לא פורסמו כתבות.')}
          </p>
          <p className="mt-2 text-sm text-[#5a7a9a]">
            {T('עקוב אחרי המסך הזה לקראת משחקי הגביע הקרובים — פרשנות מלאה תופיע כאן.')}
          </p>
        </div>
      ) : (
        <>
          {/* ── Featured (closest upcoming) ─────────────────────────────── */}
          {featured && (
            <FeaturedPreview
              event={featured}
              lookupLogo={lookupLogo}
              displayTeamName={displayTeamName}
              lang={lang as 'he' | 'en'}
            />
          )}

          {/* ── Smaller cards for remaining previews ────────────────────── */}
          {secondary.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-black text-white font-heading">
                {T('משחקים נוספים')}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {secondary.map((ev) => (
                  <SecondaryPreview
                    key={ev.cupGame.id}
                    event={ev}
                    lookupLogo={lookupLogo}
                    displayTeamName={displayTeamName}
                    lang={lang as 'he' | 'en'}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FeaturedPreview({
  event, lookupLogo, displayTeamName, lang,
}: {
  event: Event;
  lookupLogo: (name: string) => string | null;
  displayTeamName: (name: string) => string;
  lang: 'he' | 'en';
}) {
  const { cupGame: g, preview, parsedDate, isFuture } = event;
  const en = lang === 'en';
  const final = g.round.trim() === 'גמר' || /\bfinal\b/i.test(g.round);
  const homeName = displayTeamName(g.home_team);
  const awayName = displayTeamName(g.away_team);

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border-2 ${
        final
          ? 'border-yellow-400/40 shadow-[0_0_40px_-12px_rgba(250,204,21,0.4)]'
          : 'border-amber-500/30'
      } bg-gradient-to-br ${
        final
          ? 'from-yellow-500/30 via-amber-600/15 to-orange-600/20'
          : 'from-amber-500/20 via-orange-500/[0.08] to-orange-600/15'
      }`}
    >
      <span aria-hidden className="pointer-events-none absolute -bottom-6 -left-6 select-none text-[12rem] leading-none opacity-[0.06]">
        🏆
      </span>

      <div className="relative p-6 sm:p-8 space-y-6">
        {/* Top row: round + date */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
            final
              ? 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/40'
              : 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
          }`}>
            🏆 {en ? `Cup · ${g.round}` : `גביע · ${g.round}`}
          </span>
          {parsedDate && (
            <p className="text-lg sm:text-xl font-black text-white tabular-nums font-stats leading-tight text-end">
              {fmtDay(parsedDate, lang)} · {fmtDate(parsedDate)}
            </p>
          )}
        </div>

        {/* Match-up — big logos */}
        <div className="flex items-center justify-around gap-3 sm:gap-6">
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <TeamLogo logo={lookupLogo(g.home_team)} name={homeName} big />
            <p className="text-sm sm:text-lg font-black text-white text-center truncate max-w-full font-heading">
              {homeName}
            </p>
          </div>
          <span className={`text-3xl sm:text-4xl font-black tabular-nums font-stats shrink-0 ${final ? 'text-yellow-300' : 'text-amber-300'}`}>
            VS
          </span>
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <TeamLogo logo={lookupLogo(g.away_team)} name={awayName} big />
            <p className="text-sm sm:text-lg font-black text-white text-center truncate max-w-full font-heading">
              {awayName}
            </p>
          </div>
        </div>

        {/* Reviews — side-by-side, each titled with its team */}
        <div className="grid gap-4 md:grid-cols-2">
          <ReviewBlock title={homeName} body={preview.home_review} />
          <ReviewBlock title={awayName} body={preview.away_review} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-bold text-[#5a7a9a]">
              {isFuture
                ? (en ? 'Upcoming match' : 'משחק קרוב')
                : (en ? 'Past match — preview from before the game' : 'משחק שעבר — פרשנות מלפני המשחק')}
            </p>
            <ArticleViewCounter previewId={preview.id} initialCount={preview.view_count} />
          </div>
          <Link href="/cup" className="text-xs font-bold text-amber-300 hover:text-amber-200 transition">
            {en ? 'View bracket →' : '← לבראקט המלא'}
          </Link>
        </div>
      </div>
    </article>
  );
}

function SecondaryPreview({
  event, lookupLogo, displayTeamName, lang,
}: {
  event: Event;
  lookupLogo: (name: string) => string | null;
  displayTeamName: (name: string) => string;
  lang: 'he' | 'en';
}) {
  const { cupGame: g, preview, parsedDate } = event;
  const en = lang === 'en';
  const homeName = displayTeamName(g.home_team);
  const awayName = displayTeamName(g.away_team);

  return (
    <article className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
          🏆 {en ? `Cup · ${g.round}` : `גביע · ${g.round}`}
        </span>
        {parsedDate && (
          <p className="text-xs font-bold text-[#8aaac8] tabular-nums">
            {fmtDay(parsedDate, lang)} · {fmtDate(parsedDate)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <TeamLogo logo={lookupLogo(g.home_team)} name={homeName} />
        <span className="text-sm font-black text-white truncate">{homeName}</span>
        <span className="text-xs font-bold text-amber-400">VS</span>
        <TeamLogo logo={lookupLogo(g.away_team)} name={awayName} />
        <span className="text-sm font-black text-white truncate">{awayName}</span>
      </div>

      <details className="text-sm text-[#c0d4e8] leading-relaxed group">
        <summary className="cursor-pointer text-xs font-bold text-orange-300 group-open:mb-2">
          {en ? 'Read the preview ▾' : '▾ קרא את הפרשנות'}
        </summary>
        <div className="space-y-3 pt-1">
          <ReviewBlock title={homeName} body={preview.home_review} compact />
          <ReviewBlock title={awayName} body={preview.away_review} compact />
        </div>
      </details>

      {/* Footer */}
      <div className="flex items-center justify-end pt-2 border-t border-white/[0.05]">
        <ArticleViewCounter previewId={preview.id} initialCount={preview.view_count} compact />
      </div>
    </article>
  );
}

function ReviewBlock({ title, body, compact }: { title: string; body: string; compact?: boolean }) {
  if (!body?.trim()) {
    return (
      <div className={`rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 ${compact ? 'text-xs' : 'text-sm'} text-[#5a7a9a] italic text-center`}>
        — אין פרשנות —
      </div>
    );
  }
  return (
    <div className={`rounded-xl border border-white/[0.07] bg-white/[0.03] ${compact ? 'p-3' : 'p-4'} space-y-2`}>
      <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-black uppercase tracking-widest text-amber-300`}>
        {title}
      </p>
      <MarkdownLite text={body} compact={compact} />
    </div>
  );
}
