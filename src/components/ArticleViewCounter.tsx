'use client';

import { useEffect, useState } from 'react';

/**
 * Inline eye-shaped SVG icon — no external icon library needed.
 */
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

interface ArticleViewCounterProps {
  /** match_previews.id — used to POST an increment and as the dedup key. */
  previewId: string;
  /**
   * Initial count read from the server so it renders immediately.
   * Accept null/undefined defensively — Supabase PostgREST schema cache can
   * lag after a new column is added, briefly returning null even with NOT NULL DEFAULT 0.
   */
  initialCount: number | null | undefined;
  /** Optional size variant for secondary (compact) cards. */
  compact?: boolean;
}

/**
 * Client component that:
 *  1. Renders the current view count immediately (from SSR data).
 *  2. On mount, fires POST /api/events/view to atomically increment the DB
 *     counter, then updates the displayed number to the fresh value.
 *
 * Each mount = one view. If the user navigates away and back the counter
 * fires again — intentional (page impression, not unique-user).
 */
export default function ArticleViewCounter({
  previewId,
  initialCount,
  compact = false,
}: ArticleViewCounterProps) {
  const [count, setCount] = useState(initialCount ?? 0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/events/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: previewId }),
    })
      .then((r) => r.json())
      .then((data: { view_count?: number | null }) => {
        if (!cancelled && typeof data.view_count === 'number') {
          setCount(data.view_count);
        }
      })
      .catch(() => {
        // Silently ignore — a failed view-count call must never break the UI.
      });

    return () => {
      cancelled = true;
    };
  }, [previewId]);

  const iconSize  = compact ? 'w-3 h-3'   : 'w-3.5 h-3.5';
  const textSize  = compact ? 'text-[9px]' : 'text-[10px]';
  const gapClass  = compact ? 'gap-1'      : 'gap-1.5';

  return (
    <span
      className={`inline-flex items-center ${gapClass} ${textSize} font-bold text-[#5a7a9a] select-none`}
      title={`${(count ?? 0).toLocaleString()} צפיות`}
    >
      <EyeIcon className={`${iconSize} shrink-0`} />
      <span className="tabular-nums">{(count ?? 0).toLocaleString()}</span>
    </span>
  );
}
