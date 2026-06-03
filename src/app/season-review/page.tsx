export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLang } from '@/lib/get-lang';
import { resolveSeasonFromParams, listKnownSeasons } from '@/lib/current-season';
import SeasonPicker from '@/components/SeasonPicker';
import ArchiveBanner from '@/components/ArchiveBanner';
import SeasonReviewCard, { type ReviewCardData } from '@/components/SeasonReviewCard';

type ReviewRow = ReviewCardData & { season: string };

/** The three milestones that happen every season, in chronological order. */
const MILESTONE_TYPES = ['pre_season', 'mid_season', 'end_season'] as const;
type MilestoneType = (typeof MILESTONE_TYPES)[number];

const MILESTONE_META: Record<MilestoneType, {
  heLabel: string; enLabel: string;
  heDesc: string;  enDesc: string;
  emoji: string;   badgeColor: string;
}> = {
  pre_season: {
    heLabel: 'פתיחת עונה',   enLabel: 'Season Preview',
    heDesc:  'סקירת ציפיות לפני תחילת העונה — מה לצפות?',
    enDesc:  'Pre-season expectations — what to watch for.',
    emoji: '🌱',
    badgeColor: 'text-emerald-300/50 border-emerald-500/20 bg-emerald-500/[0.05]',
  },
  mid_season: {
    heLabel: 'מחצית עונה',  enLabel: 'Mid-Season',
    heDesc:  'ניתוח מחצית — מי הפתיע, מי אכזב, ומה צפוי?',
    enDesc:  'Halfway check — surprises, disappointments, and what\'s ahead.',
    emoji: '⏸',
    badgeColor: 'text-blue-300/50 border-blue-500/20 bg-blue-500/[0.05]',
  },
  end_season: {
    heLabel: 'סיום עונה',    enLabel: 'Season Wrap-Up',
    heDesc:  'סיכום מלא — אלוף, מובילי ניקוד, רגעי השנה.',
    enDesc:  'Full wrap-up — champion, top scorers, moments of the year.',
    emoji: '🏆',
    badgeColor: 'text-amber-300/50 border-amber-500/20 bg-amber-500/[0.05]',
  },
};

export default async function SeasonReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { viewing, current, isArchive } = await resolveSeasonFromParams(params);

  const [{ data: reviewsData }, lang, seasons] = await Promise.all([
    supabaseAdmin
      .from('season_reviews')
      .select('id, season, review_type, title, content, updated_at')
      .eq('season', viewing)
      .eq('is_published', true)
      .order('created_at', { ascending: true }),   // oldest first = chronological
    getLang(),
    listKnownSeasons(),
  ]);

  const reviews = (reviewsData ?? []) as ReviewRow[];

  // View counts — fetched separately so a missing view_count column (before the
  // 20260529 migration runs) can't make the whole review list disappear.
  if (reviews.length > 0) {
    const { data: counts } = await supabaseAdmin
      .from('season_reviews')
      .select('id, view_count')
      .in('id', reviews.map(r => r.id));
    if (counts) {
      const byId = new Map((counts as { id: string; view_count: number | null }[]).map(c => [c.id, c.view_count]));
      for (const r of reviews) r.view_count = byId.get(r.id) ?? 0;
    }
  }
  const publishedTypes = new Set(reviews.map(r => r.review_type));

  const he = lang !== 'en';
  const T  = (heText: string, enText: string) => he ? heText : enText;

  // Separate "milestone" (pre/mid/end) and "custom" reviews.
  const milestoneReviews = reviews.filter(r =>
    (MILESTONE_TYPES as readonly string[]).includes(r.review_type)
  );
  const customReviews = reviews.filter(r => r.review_type === 'custom');

  // Upcoming placeholders = milestone types NOT yet published.
  const upcomingTypes = MILESTONE_TYPES.filter(t => !publishedTypes.has(t));

  const hasAny = reviews.length > 0;

  return (
    <div dir={he ? 'rtl' : 'ltr'} className="space-y-8">

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-white font-heading">
            📰 {T('סקירות הליגה', 'League Reviews')}
          </h1>
          <p className="mt-1 text-sm font-bold text-[#8aaac8] font-body">
            {T('ניתוח מעמיק על עונת הליגה', 'In-depth analysis of the league season')} · {viewing}
          </p>
        </div>
        <SeasonPicker current={current} viewing={viewing} seasons={seasons} />
      </div>

      {isArchive && (
        <ArchiveBanner viewing={viewing} current={current} pathname="/season-review" />
      )}

      {/* ── Milestone reviews (pre / mid / end) ────────────────────────── */}
      {milestoneReviews.length > 0 && (
        <section className="space-y-4">
          {milestoneReviews.map((r, idx) => (
            <SeasonReviewCard
              key={r.id}
              review={r}
              lang={lang as 'he' | 'en'}
              featured={idx === 0 && customReviews.length === 0}
            />
          ))}
        </section>
      )}

      {/* ── Custom / ad-hoc reviews ─────────────────────────────────────── */}
      {customReviews.length > 0 && (
        <section className="space-y-4">
          {milestoneReviews.length > 0 && (
            <h2 className="text-sm font-black text-[#8aaac8] uppercase tracking-widest">
              {T('סקירות נוספות', 'More Reviews')}
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {customReviews.map((r, idx) => (
              <SeasonReviewCard
                key={r.id}
                review={r}
                lang={lang as 'he' | 'en'}
                featured={!hasAny && idx === 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Upcoming / coming-soon placeholders ────────────────────────── */}
      {upcomingTypes.length > 0 && (
        <section className="space-y-3">
          {/* Only show "בקרוב" heading when there are also published reviews above */}
          {hasAny && (
            <h2 className="text-sm font-black text-[#5a7a9a] uppercase tracking-widest">
              {T('בקרוב', 'Coming Soon')}
            </h2>
          )}
          <div className={`grid gap-3 ${upcomingTypes.length >= 2 ? 'sm:grid-cols-2' : ''} ${upcomingTypes.length === 3 ? 'lg:grid-cols-3' : ''}`}>
            {upcomingTypes.map(type => {
              const meta = MILESTONE_META[type];
              return (
                <div
                  key={type}
                  className="rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.01] p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${meta.badgeColor}`}>
                      {meta.emoji} {he ? meta.heLabel : meta.enLabel}
                    </span>
                    <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#3a5a7a]">
                      {T('בקרוב', 'Coming Soon')}
                    </span>
                  </div>
                  <p className="text-xs text-[#4a6a8a] leading-relaxed">
                    {he ? meta.heDesc : meta.enDesc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
