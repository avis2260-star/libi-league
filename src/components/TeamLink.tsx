'use client';

import Link from 'next/link';
import { useLang } from '@/components/TranslationProvider';

export default function TeamLink({
  name,
  className = '',
  children,
}: {
  name: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useLang();
  return (
    <Link
      href={`/team/${encodeURIComponent(name)}`}
      className={`hover:text-orange-400 hover:underline underline-offset-2 transition-colors cursor-pointer ${className}`}
    >
      {children ?? t(name)}
    </Link>
  );
}
