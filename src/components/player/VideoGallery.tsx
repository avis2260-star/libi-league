'use client';

import { useState } from 'react';

interface VideoEntry {
  url: string;
  label: string;   // e.g. "vs Lakers"
  date: string;    // ISO date
}

interface Props {
  videos: VideoEntry[];
}

// ── YouTube URL parser ────────────────────────────────────────────────────────

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);

    // youtu.be/VIDEO_ID
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('?')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (u.hostname.includes('youtube.com')) {
      // Already an embed URL
      if (u.pathname.startsWith('/embed/')) return url;

      // watch?v=VIDEO_ID
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;

      // /shorts/VIDEO_ID
      const shortMatch = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
    }
  } catch {
    // Invalid URL — fall through
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VideoGallery({ videos }: Props) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {videos.map((video, i) => {
        const embedUrl = getYouTubeEmbedUrl(video.url);
        const dateStr = new Date(video.date).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        });

        return (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900"
          >
            {/* Video / placeholder */}
            {embedUrl ? (
              active === i ? (
                // Active embed — show iframe
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={`${embedUrl}?autoplay=1&rel=0`}
                    title={video.label}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              ) : (
                // Thumbnail placeholder with play button
                <button
                  onClick={() => setActive(i)}
                  className="group relative flex w-full items-center justify-center bg-gray-800"
                  style={{ paddingBottom: '56.25%' }}
                  aria-label={`Play ${video.label}`}
                >
                  {/* YouTube thumbnail attempt */}
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-950" />

                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 shadow-2xl transition-transform group-hover:scale-110">
                      <svg
                        className="ml-1 h-7 w-7 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </button>
              )
            ) : (
              // Non-YouTube URL — show a "Watch" link
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center bg-gray-800/60"
                style={{ paddingBottom: '56.25%', position: 'relative', display: 'block' }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl">🎥</span>
                  <span className="text-sm font-semibold text-orange-400 group-hover:underline">
                    Watch Highlight ↗
                  </span>
                </div>
              </a>
            )}

            {/* Caption */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-semibold text-white">{video.label}</p>
                <p className="text-xs text-gray-500">{dateStr}</p>
              </div>

              {/* External link */}
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-500 hover:text-white"
                title="Open in new tab"
              >
                ↗
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
