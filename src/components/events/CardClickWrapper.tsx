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

    // Open in a new tab reliably (a programmatic anchor click is treated as a
    // user-initiated navigation and avoids popup-blocker / new-window quirks).
    const a = document.createElement('a');
    a.href = href!;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <article
      className={`${className} cursor-pointer`}
      onClick={handleClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick(e as unknown as React.MouseEvent<HTMLElement>);
      }}
    >
      {children}
    </article>
  );
}
