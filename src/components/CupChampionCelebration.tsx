'use client';

// Cup champion celebration — confetti + a full-screen reveal, in the same
// spirit as the playoff ChampionReveal, but AUTO-played when the cup page
// mounts (i.e. whenever the user arrives at /cup from the cup tab, the hero
// card's bracket link, or the home "גמר הגביע" card — they all land here).
// The overlay auto-dismisses after a few seconds, and a click anywhere / the
// close button / Esc dismiss it immediately, so it never blocks the bracket.

import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/components/TranslationProvider';

interface Props {
  champion: string;
  opponent?: string;
  scoreWinner?: number | null;
  scoreLoser?: number | null;
  date?: string;
  logoUrl?: string | null;
  season?: string;
}

const COLORS = ['#F5C842', '#FFE07A', '#E8651A', '#fff', '#C9962A', '#f0eadc'];
const AUTO_DISMISS_MS = 7000;

function formatDate(raw: string, lang: 'he' | 'en'): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  try {
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return raw;
  }
}

export default function CupChampionCelebration({
  champion,
  opponent = '',
  scoreWinner = null,
  scoreLoser = null,
  date = '',
  logoUrl = null,
  season = '2025–2026',
}: Props) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(true);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number | null>(null);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const piecesRef  = useRef<{
    x: number; y: number; pw: number; ph: number; color: string;
    rot: number; rs: number; vx: number; vy: number; life: number;
  }[]>([]);

  function makePiece(w: number) {
    return {
      x: Math.random() * w, y: -20,
      pw: Math.random() * 10 + 6, ph: Math.random() * 5 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      rs: (Math.random() - 0.5) * 0.15,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      life: 1,
    };
  }

  function drawLoop() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    piecesRef.current = piecesRef.current.filter((p) => p.life > 0);
    piecesRef.current.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rs;
      if (p.y > c.height - 60) p.life -= 0.03;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.pw / 2, -p.ph / 2, p.pw, p.ph);
      ctx.restore();
    });
    animRef.current = requestAnimationFrame(drawLoop);
  }

  function stopConfetti() {
    if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null; }
    if (animRef.current)    { cancelAnimationFrame(animRef.current); animRef.current = null; }
    piecesRef.current = [];
    const c = canvasRef.current;
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }

  function dismiss() {
    if (dismissRef.current) { clearTimeout(dismissRef.current); dismissRef.current = null; }
    if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null; }
    setOpen(false);
  }

  // Auto-play on mount: confetti rain + the reveal overlay.
  useEffect(() => {
    const c = canvasRef.current;
    if (c) {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      for (let i = 0; i < 160; i++) {
        setTimeout(() => piecesRef.current.push(makePiece(c.width)), i * 18);
      }
      trickleRef.current = setInterval(() => {
        for (let i = 0; i < 4; i++) piecesRef.current.push(makePiece(c.width));
      }, 300);
      drawLoop();
    }
    // Stop spawning new confetti shortly before auto-dismiss, then close.
    dismissRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (dismissRef.current) clearTimeout(dismissRef.current);
      stopConfetti();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the overlay closes, let the last confetti fall, then clear the canvas.
  useEffect(() => {
    if (open) return;
    const id = setTimeout(stopConfetti, 1500);
    return () => clearTimeout(id);
  }, [open]);

  return (
    <>
      {open && (
        <div
          onClick={dismiss}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(13,27,42,0.94)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', zIndex: 999, gap: 14,
            animation: 'fadeIn 0.5s ease forwards',
          }}
        >
          {/* spinning rays */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-conic-gradient(from 0deg, rgba(245,200,66,0.04) 0deg 10deg, transparent 10deg 20deg)',
            animation: 'spin 30s linear infinite',
          }} />

          <div style={{
            position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 14, textAlign: 'center', direction: lang === 'en' ? 'ltr' : 'rtl',
          }}>
            <div style={{ fontFamily: 'sans-serif', fontSize: 10, letterSpacing: 5, color: '#F5C842', textTransform: 'uppercase' }}>
              {lang === 'en' ? 'LIBI LEAGUE CUP' : 'גביע ליגת ליבי'} · {season}
            </div>

            {/* spinning gold ring logo */}
            <div style={{ position: 'relative', width: 140, height: 140 }}>
              <div style={{
                position: 'absolute', inset: -8, borderRadius: '50%',
                background: 'conic-gradient(#F5C842, #FFE07A, #C9962A, #F5C842)',
                animation: 'spin 3s linear infinite',
              }} />
              <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', background: '#0d1b2a' }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: '#112240', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 56, overflow: 'hidden',
              }}>
                {logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '🏆'}
              </div>
            </div>

            <div style={{ fontFamily: 'sans-serif', fontSize: 9, letterSpacing: 5, color: '#C9962A', textTransform: 'uppercase' }}>
              {lang === 'en' ? 'Cup Holder' : 'מחזיקת הגביע'}
            </div>
            <div style={{
              fontFamily: 'sans-serif', fontWeight: 900, fontSize: 44, color: '#F5C842',
              letterSpacing: 2, lineHeight: 1.05, textShadow: '0 0 40px rgba(245,200,66,0.6)', padding: '0 16px',
            }}>
              {t(champion)}
            </div>

            <div style={{ width: 160, height: 1, background: 'linear-gradient(to right, transparent, #F5C842, transparent)' }} />

            {/* Score */}
            {scoreWinner !== null && scoreLoser !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, direction: 'ltr' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'rgba(240,234,220,0.6)', maxWidth: 120 }}>{t(champion)}</div>
                  <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: 48, color: '#F5C842', lineHeight: 1 }}>{scoreWinner}</div>
                </div>
                <div style={{ fontFamily: 'sans-serif', fontSize: 32, color: 'rgba(240,234,220,0.3)' }}>:</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'rgba(240,234,220,0.6)', maxWidth: 120 }}>{t(opponent)}</div>
                  <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: 48, color: '#f0eadc', lineHeight: 1 }}>{scoreLoser}</div>
                </div>
              </div>
            )}

            {date && (
              <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'rgba(240,234,220,0.4)', letterSpacing: 2 }}>
                📅 {formatDate(date, lang as 'he' | 'en')} · {lang === 'en' ? 'Cup Final' : 'גמר הגביע'}
              </div>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              style={{
                marginTop: 8, background: 'rgba(245,200,66,0.1)',
                border: '1px solid rgba(245,200,66,0.3)',
                color: '#F5C842', fontFamily: 'sans-serif', fontSize: 14,
                padding: '8px 24px', borderRadius: 30, cursor: 'pointer',
              }}
            >
              {lang === 'en' ? '← Back to bracket' : '← חזרה לעץ הגביע'}
            </button>
          </div>
        </div>
      )}

      {/* confetti canvas — always mounted so it can keep falling after the overlay closes */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }} />

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
