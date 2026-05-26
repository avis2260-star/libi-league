'use client';

/**
 * Wraps the FeaturedPreview article so clicking anywhere on the card
 * (except inside <a> / <button> elements or elements with data-no-card-link)
 * opens `href` in a new tab.
 */
import type { ReactNode } from 'react';

export default function CardClickWrapper({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  if (!href) {
    return <article className={className}>{children}</article>;
  }

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    const target = e.target as HTMLElement;
    // Let real links and buttons handle their own navigation.
    if (target.closest('a, button')) return;
    // Skip elements explicitly opted out (e.g. team name text).
    if (target.closest('[data-no-card-link]')) return;

    // window.open is the most reliable way to open a new tab from a
    // user-gesture handler — browsers won't block it as a popup.
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  return (
    <article
      className={`${className} cursor-pointer`}
      onClick={handleClick}
      role="link"
      tabIndex={0}
      title="לחץ לצפייה בגיליון המשחק"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      {children}
    </article>
  );
}
