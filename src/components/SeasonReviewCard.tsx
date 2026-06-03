'use client';

import { useEffect, useState } from 'react';
import MarkdownLite from '@/components/MarkdownLite';
import ArticleViewCounter from '@/components/ArticleViewCounter';

export type ReviewCardData = {
  id: string;
  review_type: 'pre_season' | 'mid_season' | 'end_season' | 'custom';
  title: string;
  content: string;
  updated_at: string;
  view_count?: number | null;
};

const TYPE_META = {
  pre_season: { heLabel: 'פתיחת עונה',  enLabel: 'Season Preview',  emoji: '🌱', badge: 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10', glow: 'hover:border-emerald-500/30' },
  mid_season: { heLabel: 'מחצית עונה', enLabel: 'Mid-Season',       emoji: '⏸',  badge: 'text-blue-200   border-blue-500/40   bg-blue-500/10',   glow: 'hover:border-blue-500/30'    },
  end_season: { heLabel: 'סיום עונה',   enLabel: 'Season Wrap-Up',  emoji: '🏆', badge: 'text-amber-200  border-amber-500/40  bg-amber-500/10',  glow: 'hover:border-amber-500/30'   },
  custom:     { heLabel: 'סקירה',        enLabel: 'Review',          emoji: '📰', badge: 'text-[#c0d4e8]  border-white/20      bg-white/[0.04]',  glow: 'hover:border-white/[0.15]'   },
} as const;

/** Strip markdown symbols to produce plain-text excerpt. */
function plainExcerpt(text: string, max = 180): string {
  const plain = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
  return plain.length > max ? plain.slice(0, max).trimEnd() + '…' : plain;
}

function fmtDate(s: string, lang: 'he' | 'en'): string {
  return new Date(s).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

interface Props {
  review: ReviewCardData;
  lang: 'he' | 'en';
  featured?: boolean;
}

export default function SeasonReviewCard({ review, lang, featured = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Deep link from elsewhere (e.g. the cup hero card): /season-review#review-<id>
  // auto-expands this card and scrolls it into view.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === `#review-${review.id}`) {
      setExpanded(true);
      const el = document.getElementById(`review-${review.id}`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }, [review.id]);

  const meta  = TYPE_META[review.review_type];
  const label = lang === 'en' ? meta.enLabel : meta.heLabel;
  const excerpt = plainExcerpt(review.content);

  return (
    <article
      id={`review-${review.id}`}
      className={`scroll-mt-24 rounded-3xl border transition-all duration-200 ${meta.glow} ${
        featured
          ? 'border-white/[0.1] bg-white/[0.03]'
          : 'border-white/[0.06] bg-white/[0.02]'
      }`}
    >
      <div className={featured ? 'p-6 sm:p-8' : 'p-5 sm:p-6'}>

        {/* Top row — badge + date */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${meta.badge}`}>
            {meta.emoji} {label}
          </span>
          <div className="flex items-center gap-3">
            <ArticleViewCounter
              previewId={review.id}
              initialCount={review.view_count}
              endpoint="/api/season-reviews/view"
            />
            <p className="text-xs font-bold text-[#5a7a9a]">
              {fmtDate(review.updated_at, lang)}
            </p>
          </div>
        </div>

        {/* Title */}
        {review.title && (
          <h2 className={`font-black text-white font-heading leading-snug mb-3 ${featured ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
            {review.title}
          </h2>
        )}

        {/* Body — excerpt or full content */}
        {expanded ? (
          <div className={`text-[#c0d4e8] leading-relaxed ${featured ? '' : 'text-sm'}`}>
            <MarkdownLite text={review.content} />
          </div>
        ) : (
          <p className={`text-[#8aaac8] leading-relaxed ${featured ? 'text-sm' : 'text-xs'}`}>
            {excerpt}
          </p>
        )}

        {/* Expand / collapse toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-black transition-all hover:scale-[1.02] ${
            expanded
              ? 'border-white/[0.1] bg-white/[0.04] text-[#8aaac8] hover:bg-white/[0.08]'
              : `${meta.badge} hover:opacity-90`
          }`}
        >
          {expanded
            ? (lang === 'en' ? '▴ Collapse' : '▴ סגור')
            : (lang === 'en' ? '▾ Read full review' : '▾ קרא את הסקירה המלאה')}
        </button>
      </div>
    </article>
  );
}
