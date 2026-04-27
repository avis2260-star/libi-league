'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from './TranslationProvider';
export default function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();
  if (pathname === '/') return null;
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1 text-xs font-bold text-[#5a7a9a] hover:text-orange-400 transition-colors shrink-0"
      aria-label={t('חזרה')}
    >
      <span className="text-base leading-none">‹</span>
      <span>{t('חזרה')}</span>
    </button>
  );
}
