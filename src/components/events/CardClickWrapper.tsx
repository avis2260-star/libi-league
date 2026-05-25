'use client';

/**
 * Wraps the FeaturedPreview article so clicking anywhere on the card
 * (except inside <a> / <button> elements or elements with data-no-card-link)
 * opens `statsUrl` in a new tab.
 */
import type { ReactNode } from 'react';

export default function CardClickWrapper({
  statsUrl,
  className,
  children,
}: {
  statsUrl?: string;
  className?: string;
  children: ReactNode;
}) {
  if (!statsUrl) {
    return <article className={className}>{children}</article>;
  }

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    const target = e.target as HTMLElement;
    // Let real links and buttons handle their own navigation.
    if (target.closest('a, button')) return;
    // Skip elements explicitly opted out (e.g. team name text).
    if (target.closest('[data-no-card-link]')) return;
    window.open(statsUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <article
      className={`${className} cursor-pointer`}
      onClick={handleClick}
    >
      {children}
    </article>
  );
}
