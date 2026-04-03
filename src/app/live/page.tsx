'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const SCOREBOARD_URL = 'https://game-scoreboard-libi.vercel.app';

export default function LivePage() {
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const [fsActive, setFsActive] = useState(false);
  const [loaded,   setLoaded]   = useState(false);

  /* Track native fullscreen changes (e.g. user presses Esc) */
  useEffect(() => {
    function onFsChange() {
      setFsActive(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      iframeRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.07] bg-[#0a1628]/90 backdrop-blur-md px-4 py-3">

        {/* Back */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-[#5a7a9a] hover:text-white transition-colors shrink-0"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
          חזרה
        </Link>

        <div className="h-5 w-px bg-white/10 shrink-0" />

        {/* Live badge */}
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-red-400">חי</span>
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-white truncate">
            🏀 ניהול משחק חי
          </h1>
          <p className="text-[10px] text-[#5a7a9a] truncate hidden sm:block">
            ליגת ליבי 2025–2026 · לוח תוצאות בזמן אמת
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Reload */}
          <button
            onClick={() => {
              setLoaded(false);
              if (iframeRef.current) {
                iframeRef.current.src = SCOREBOARD_URL;
              }
            }}
            title="רענן"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#8aaac8] hover:bg-white/[0.08] hover:text-white transition-all"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={fsActive ? 'צא ממסך מלא' : 'מסך מלא'}
            className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 transition-all"
          >
            {fsActive ? (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M3.28 2.22a.75.75 0 00-1.06 1.06L5.44 6.5H2.75a.75.75 0 000 1.5h4.5A.75.75 0 008 7.25v-4.5a.75.75 0 00-1.5 0v2.69L3.28 2.22zM13.5 2.75a.75.75 0 00-1.5 0v4.5c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-2.69l3.22-3.22a.75.75 0 00-1.06-1.06L13.5 5.44V2.75zM3.28 17.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 101.06 1.06zM13.5 14.56l3.22 3.22a.75.75 0 101.06-1.06l-3.22-3.22h2.69a.75.75 0 000-1.5h-4.5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-2.69z" />
                </svg>
                צמצם
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM2 17.25v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 1.06L4.56 16.5h2.69a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM12.22 13.28l3.22 3.22h-2.69a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-1.5 0v2.69l-3.22-3.22a.75.75 0 10-1.06 1.06zM3.5 4.56l3.22 3.22a.75.75 0 001.06-1.06L4.56 3.5h2.69a.75.75 0 000-1.5h-4.5A.75.75 0 002 2.75v4.5a.75.75 0 001.5 0V4.56z" />
                </svg>
                מסך מלא
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Iframe area ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 bg-[#060810]">

        {/* Loading skeleton */}
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🏀</div>
            </div>
            <p className="text-sm font-bold text-[#5a7a9a] animate-pulse">טוען לוח תוצאות...</p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={SCOREBOARD_URL}
          className={`w-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={{
            height: 'calc(100vh - 53px)',
            border: 'none',
            display: 'block',
          }}
          allow="fullscreen"
          onLoad={() => setLoaded(true)}
          title="לוח תוצאות חי"
        />
      </div>
    </div>
  );
}
