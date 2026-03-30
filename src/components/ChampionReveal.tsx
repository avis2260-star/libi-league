'use client';
import { useState, useEffect, useRef } from 'react';

interface Props {
  champion: string | null;       // null = no winner yet (plate is locked)
  division?: string;
  scoreWinner?: number | null;
  scoreLoser?: number | null;
  opponentName?: string;
  mvpName?: string;
  mvpStats?: string;
  date?: string;
  logoUrl?: string | null;
  season?: string;
}

const face: React.CSSProperties = {
  position: 'absolute', inset: 0, borderRadius: '50%',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden' as React.CSSProperties['WebkitBackfaceVisibility'],
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export default function ChampionReveal({
  champion,
  division = '',
  scoreWinner = null,
  scoreLoser = null,
  opponentName = '',
  mvpName = '',
  mvpStats = '',
  date = '',
  logoUrl = null,
  season = '2025–2026',
}: Props) {
  const [flipped, setFlipped]   = useState(false);
  const [revealed, setRevealed] = useState(false);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number | null>(null);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const piecesRef  = useRef<{
    x: number; y: number; pw: number; ph: number; color: string;
    rot: number; rs: number; vx: number; vy: number; life: number;
  }[]>([]);

  const COLORS = ['#F5C842','#FFE07A','#E8651A','#fff','#C9962A','#f0eadc'];
  const isLocked = !champion;

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

  function launchConfetti() {
    const c = canvasRef.current;
    if (!c) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    for (let i = 0; i < 160; i++)
      setTimeout(() => piecesRef.current.push(makePiece(c.width)), i * 18);
    trickleRef.current = setInterval(() => {
      for (let i = 0; i < 4; i++) piecesRef.current.push(makePiece(c.width));
    }, 300);
    drawLoop();
  }

  function drawLoop() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    piecesRef.current = piecesRef.current.filter(p => p.life > 0);
    piecesRef.current.forEach(p => {
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
    if (trickleRef.current) clearInterval(trickleRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    piecesRef.current = [];
    const c = canvasRef.current;
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }

  function handleClick() {
    if (isLocked || flipped) return;
    setFlipped(true);
    setTimeout(() => { setRevealed(true); launchConfetti(); }, 700);
  }

  function handleClose() {
    stopConfetti();
    setRevealed(false);
    setTimeout(() => setFlipped(false), 500);
  }

  useEffect(() => () => stopConfetti(), []);

  return (
    <>
      {/* ── PLATE ── */}
      <div style={{ perspective: '1200px', display: 'inline-block', position: 'relative' }}>
        <div
          onClick={handleClick}
          title={isLocked ? 'הגמר טרם שוחק' : 'לחץ לחשיפת האלוף'}
          style={{
            width: 220, height: 220, borderRadius: '50%',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 1.1s cubic-bezier(0.77,0,0.175,1)',
            cursor: isLocked ? 'default' : 'pointer',
            position: 'relative',
            filter: isLocked ? 'grayscale(40%)' : 'none',
            opacity: isLocked ? 0.7 : 1,
          }}
        >
          {/* FRONT */}
          <div style={{
            ...face,
            background: 'radial-gradient(circle at 35% 30%, #d4d4d4, #a0a0a0 40%, #787878)',
            boxShadow: isLocked
              ? '0 0 0 8px #888, 0 0 0 11px #666'
              : '0 0 0 8px #F5C842, 0 0 0 11px #C9962A, 0 0 50px 8px rgba(245,200,66,0.45)',
          }}>
            <div style={{
              width: 140, height: 140, borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 35%, #e8e8e8, #b0b0b0 60%, #888)',
              boxShadow: 'inset 0 4px 12px rgba(255,255,255,0.5), inset 0 -4px 12px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3,
            }}>
              {isLocked ? (
                /* Locked → trophy emoji */
                <>
                  <div style={{ fontSize: 28 }}>🏆</div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 8, letterSpacing: 3, color: '#444', textTransform: 'uppercase' }}>League</div>
                  <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: 17, color: '#222', letterSpacing: 2 }}>CHAMPIONS</div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 9, color: '#555', letterSpacing: 1 }}>{season}</div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 9, color: '#666' }}>ליגת ליבי</div>
                </>
              ) : (
                /* Unlocked → mini championship plate */
                <div style={{
                  width: 104, height: 104, borderRadius: '50%',
                  background: 'conic-gradient(from 0deg, #b8860b, #ffd700, #ffe066, #ffd700, #b8860b, #ffd700, #b8860b)',
                  padding: 4, boxSizing: 'border-box',
                  boxShadow: '0 0 12px rgba(255,200,0,0.5)',
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: 'conic-gradient(from 45deg, #888, #ddd, #fff, #ddd, #888, #ddd, #888)',
                    padding: 3, boxSizing: 'border-box',
                  }}>
                    <div style={{
                      width: '100%', height: '100%', borderRadius: '50%',
                      background: 'radial-gradient(ellipse at 35% 35%, #e8e8e8 0%, #b8b8b8 40%, #909090 100%)',
                      boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.45)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 1,
                    }}>
                      <span style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: 7, letterSpacing: 2, color: '#3a2a00', textTransform: 'uppercase' }}>LEAGUE</span>
                      <span style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: 11, letterSpacing: 1, color: '#2a1a00', textTransform: 'uppercase' }}>CHAMPIONS</span>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'radial-gradient(circle at 40% 35%, #f97316, #c2410c)',
                        border: '1.5px solid #b8860b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '2px 0',
                      }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1.8" style={{ width: '65%', height: '65%' }}>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
                          <path d="M2 12h20" />
                        </svg>
                      </div>
                      <span style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: 8, color: '#3a2a00' }}>{season}</span>
                      <span style={{ fontFamily: 'sans-serif', fontSize: 6, color: '#5a4500', letterSpacing: 1, textTransform: 'uppercase' }}>ליגת ליבי</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BACK (visible after flip) */}
          <div style={{
            ...face,
            transform: 'rotateY(180deg)',
            background: 'radial-gradient(circle at 40% 35%, #1a3a5c, #0d1b2a)',
            boxShadow: '0 0 0 8px #F5C842, 0 0 0 11px #C9962A, 0 0 50px 8px rgba(245,200,66,0.4)',
            flexDirection: 'column', gap: 6, padding: 20, textAlign: 'center',
            opacity: flipped ? 1 : 0, transition: 'opacity 0.4s 0.6s',
          }}>
            <div style={{ fontSize: 26 }}>🏆</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#F5C842', fontFamily: 'sans-serif', lineHeight: 1.2 }}>{champion}</div>
            {scoreWinner !== null && scoreLoser !== null && (
              <div style={{ fontSize: 11, color: '#f0eadc', fontFamily: 'sans-serif' }}>
                {scoreWinner} – {scoreLoser}
              </div>
            )}
            {mvpName && (
              <div style={{ fontSize: 10, color: 'rgba(240,234,220,0.6)', fontFamily: 'sans-serif' }}>
                MVP: {mvpName}
              </div>
            )}
          </div>
        </div>

        {/* hint label */}
        <div style={{
          position: 'absolute', bottom: -28, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'sans-serif', fontSize: 11,
          color: isLocked ? 'rgba(255,255,255,0.2)' : 'rgba(245,200,66,0.7)',
          whiteSpace: 'nowrap',
        }}>
          {isLocked ? 'הגמר טרם שוחק' : 'לחץ לחשיפת האלוף ✨'}
        </div>
      </div>

      {/* ── FULL REVEAL OVERLAY ── */}
      {revealed && (
        <div style={{
          position: 'fixed', inset: 0, background: '#0d1b2a',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', zIndex: 999, gap: 14,
          animation: 'fadeIn 0.5s ease forwards',
        }}>
          {/* spinning rays */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-conic-gradient(from 0deg, rgba(245,200,66,0.04) 0deg 10deg, transparent 10deg 20deg)',
            animation: 'spin 30s linear infinite',
          }} />

          <div style={{
            position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 14, textAlign: 'center', direction: 'rtl',
          }}>
            <div style={{ fontFamily: 'sans-serif', fontSize: 10, letterSpacing: 5, color: '#F5C842', textTransform: 'uppercase' }}>
              ליגת ליבי · {season}
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
                  : '🏀'}
              </div>
            </div>

            <div style={{ fontFamily: 'sans-serif', fontSize: 9, letterSpacing: 5, color: '#C9962A', textTransform: 'uppercase' }}>אלוף הליגה</div>
            <div style={{
              fontFamily: 'sans-serif', fontWeight: 900, fontSize: 48, color: '#F5C842',
              letterSpacing: 2, lineHeight: 1, textShadow: '0 0 40px rgba(245,200,66,0.6)',
            }}>
              {champion}
            </div>
            {division && (
              <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: 'rgba(240,234,220,0.5)' }}>{division}</div>
            )}

            <div style={{ width: 160, height: 1, background: 'linear-gradient(to right, transparent, #F5C842, transparent)' }} />

            {/* Score */}
            {scoreWinner !== null && scoreLoser !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, direction: 'ltr' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'rgba(240,234,220,0.6)', maxWidth: 100 }}>{champion}</div>
                  <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: 48, color: '#F5C842', lineHeight: 1 }}>{scoreWinner}</div>
                </div>
                <div style={{ fontFamily: 'sans-serif', fontSize: 32, color: 'rgba(240,234,220,0.3)' }}>:</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: 'rgba(240,234,220,0.6)', maxWidth: 100 }}>{opponentName}</div>
                  <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: 48, color: '#f0eadc', lineHeight: 1 }}>{scoreLoser}</div>
                </div>
              </div>
            )}

            {/* MVP */}
            {mvpName && (
              <div style={{
                background: 'rgba(245,200,66,0.07)', border: '1px solid rgba(245,200,66,0.2)',
                borderRadius: 12, padding: '12px 28px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <div style={{ fontFamily: 'sans-serif', fontSize: 9, letterSpacing: 4, color: '#C9962A', textTransform: 'uppercase' }}>🏅 MVP גמר</div>
                <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: 20, color: '#f0eadc' }}>{mvpName}</div>
                {mvpStats && <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#F5C842', opacity: 0.8 }}>{mvpStats}</div>}
              </div>
            )}

            {date && (
              <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: 'rgba(240,234,220,0.4)', letterSpacing: 2 }}>
                📅 {date} · גמר העונה
              </div>
            )}

            <button onClick={handleClose} style={{
              marginTop: 8, background: 'rgba(245,200,66,0.1)',
              border: '1px solid rgba(245,200,66,0.3)',
              color: '#F5C842', fontFamily: 'sans-serif', fontSize: 14,
              padding: '8px 24px', borderRadius: 30, cursor: 'pointer',
            }}>
              ← חזור
            </button>
          </div>
        </div>
      )}

      {/* confetti canvas */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }} />

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
