'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { useLang } from '@/components/TranslationProvider';

/**
 * Season picker — drops a dropdown that flips the `?season=` URL param.
 *
 * `seasons` comes from listKnownSeasons() on the server (every distinct
 * season the DB has data for). `current` is the live current_season value;
 * we badge it so the user can always see which is "now".
 *
 * Selecting "current" strips the param so the URL stays clean for the
 * default view. Selecting any other season keeps the param so the choice
 * is shareable and survives back/forward navigation.
 */
export default function SeasonPicker({
  current,
  viewing,
  seasons,
}: {
  current: string;
  viewing: string;
  seasons: string[];
}) {
  const router         = useRouter();
  const pathname       = usePathname();
  const searchParams   = useSearchParams();
  const [pending, startTransition] = useTransition();
  const { t, lang } = useLang();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next === current) {
      params.delete('season');
    } else {
      params.set('season', next);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-xs font-bold text-[#8aaac8]" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <span className="select-none">📅 {t('עונה:')}</span>
      <select
        value={viewing}
        onChange={onChange}
        disabled={pending}
        className="rounded-lg border border-white/[0.10] bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white focus:border-orange-500 focus:outline-none disabled:opacity-50"
        dir="ltr"
      >
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}{s === current ? ` · ${t('נוכחית')}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
