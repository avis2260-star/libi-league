export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLang, st } from '@/lib/get-lang';
import { resolveSeasonFromParams, listKnownSeasons } from '@/lib/current-season';
import SeasonPicker from '@/components/SeasonPicker';
import ArchiveBanner from '@/components/ArchiveBanner';
import MarkdownLite from '@/components/MarkdownLite';

type ReviewRow = {
  id: string;
  season: string;
  review_type: 'pre_season' | 'mid_season' | 'end_season' | 'custom';
  title: string;
  content: string;
  updated_at: string;
};

const TYPE_META: Record<ReviewRow['review_type'], { heLabel: string; enLabel: string; emoji: string; color: string }> = {
  pre_season: { heLabel: 'פתיחת עונה',  enLabel: 'Season Preview',  emoji: '🌱', color: 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10' },
  mid_season: { heLabel: 'מחצית עונה', enLabel: 'Mid-Season',       emoji: '⏸',  color: 'text-blue-200   border-blue-500/40   bg-blue-500/10'   },
  end_season: { heLabel: 'סיום עונה',   enLabel: 'Season Wrap-Up',  emoji: '🏆', color: 'text-amber-200  border-amber-500/40  bg-amber-500/10'  },
  custom:     { heLabel: 'סקירה',        enLabel: 'Review',          emoji: '📰', color: 'text-[#c0d4e8]  border-white/20      bg-white/[0.04]'  },
};

function fmtDate(s: string, lang: 'he' | 'en'): string {
  return new Date(s).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

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
      .order('created_at', { ascending: false }),
    getLang(),
    listKnownSeasons(),
  ]);

  const reviews = (reviewsData ?? []) as ReviewRow[];
  const T = (he: string, en?: string) => lang === 'en' ? (en ?? he) : he;

  return (
    <div dir={lang === 'en' ? 'ltr' : 'rtl'} className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-white font-heading">
            📰 {T('סקירות עונה', 'Season Reviews')}
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

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
          <p className="text-5xl mb-3">📭</p>
          <p className="text-base font-bold text-[#8aaac8]">
            {T('עדיין לא פורסמו סקירות לעונה זו.', 'No reviews published for this season yet.')}
          </p>
          <p className="mt-2 text-sm text-[#5a7a9a]">
            {T('בדוק שוב בהמשך העונה.', 'Check back later in the season.')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((r, idx) => {
            const meta  = TYPE_META[r.review_type];
            const label = lang === 'en' ? meta.enLabel : meta.heLabel;
            const isFeatured = idx === 0;

            return (
              <article
                key={r.id}
                className={`relative overflow-hidden rounded-3xl border ${
                  isFeatured
                    ? 'border-white/[0.1] bg-white/[0.03] p-6 sm:p-8'
                    : 'border-white/[0.06] bg-white/[0.015] p-5 sm:p-6'
                }`}
              >
                {/* Type badge + date */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${meta.color}`}>
                    {meta.emoji} {label}
                  </span>
                  <p className="text-xs font-bold text-[#5a7a9a]">
                    {fmtDate(r.updated_at, lang as 'he' | 'en')}
                  </p>
                </div>

                {/* Title */}
                {r.title && (
                  <h2 className={`font-black text-white font-heading leading-tight mb-4 ${isFeatured ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
                    {r.title}
                  </h2>
                )}

                {/* Content */}
                <div className={`text-[#c0d4e8] leading-relaxed ${isFeatured ? '' : 'text-sm'}`}>
                  <MarkdownLite text={r.content} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
