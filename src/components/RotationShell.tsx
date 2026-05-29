'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppRotation } from './AppRotationProvider';

export default function RotationShell({ children }: { children: React.ReactNode }) {
  const { rotated } = useAppRotation();
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Touch-scroll handler: phone rotated 90° CW → rightward swipe = scroll down
  useEffect(() => {
    if (!rotated || !scrollRef.current) return;
    const el = scrollRef.current;

    let startX = 0;
    let startScrollTop = 0;

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startScrollTop = el.scrollTop;
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - startX;
      // CW rotation: rightward swipe (positive deltaX) = swipe "up" in landscape = scroll down
      el.scrollTop = startScrollTop + deltaX;
      e.preventDefault(); // block native scroll
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [rotated]);

  // Not rotated or SSR — render normally, no rotation, navigation persists state
  if (!rotated || !mounted) return <>{children}</>;

  // Rotated — portal into <body> to escape all stacking contexts
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: '100vh',
        height: '100vw',
        transform: 'translate(-50%, -50%) rotate(90deg)',
        zIndex: 9000,
        overflow: 'hidden',
        // Theme-aware page background. Using the CSS var (not a hardcoded hex)
        // so the rotated overlay follows light/dark mode — React serializes
        // inline hex to rgb(), which defeats the globals.css [style*="#hex"]
        // light-mode override, leaving the overlay stuck dark.
        background: 'var(--bg-base)',
      }}
    >
      <div
        ref={scrollRef}
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'scroll',
          overflowX: 'hidden',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
