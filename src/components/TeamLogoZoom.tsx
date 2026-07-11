'use client';

// ── TeamLogoZoom — team logo that opens full-size in a lightbox when tapped ──
// Used inside result cards that are themselves <Link>s, so the tap must not
// navigate: the click is stopped before it reaches the anchor, and the overlay
// is portaled to <body> so it never renders inside the card's <a>.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export default function TeamLogoZoom({ src, alt, className = '' }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        role="button"
        tabIndex={0}
        className={`${className} cursor-zoom-in`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
      />
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/85 p-6 backdrop-blur-sm"
            // Portal events still bubble through the React tree to the card's
            // <Link>, so every click inside the overlay must stop propagation.
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            <button
              type="button"
              aria-label="✕"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white transition hover:bg-white/20"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[70vh] max-w-[85vw] rounded-2xl bg-white/5 object-contain shadow-2xl"
            />
            <p dir="auto" className="text-center text-lg font-bold text-white font-heading">
              {alt}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
