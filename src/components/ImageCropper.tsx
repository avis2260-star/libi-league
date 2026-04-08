'use client';

import { useState, useRef, useEffect } from 'react';

type Rect = { x: number; y: number; w: number; h: number };

async function cropToBase64(
  imageSrc: string,
  rectPct: Rect,
  mimeType: string,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  // Convert percentage rect → pixel rect on the natural image
  const sx = Math.max(0, Math.round((rectPct.x / 100) * img.naturalWidth));
  const sy = Math.max(0, Math.round((rectPct.y / 100) * img.naturalHeight));
  const sw = Math.max(1, Math.round((rectPct.w / 100) * img.naturalWidth));
  const sh = Math.max(1, Math.round((rectPct.h / 100) * img.naturalHeight));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const dataUrl = canvas.toDataURL(mimeType || 'image/jpeg', 0.92);
  return dataUrl.split(',')[1];
}

export default function ImageCropper({
  imageSrc,
  mimeType,
  onConfirm,
  onSkip,
}: {
  imageSrc: string;
  mimeType: string;
  onConfirm: (base64: string) => void;
  onSkip: () => void;
}) {
  // Rect is stored as percentages of the displayed image (0–100)
  const [rect, setRect] = useState<Rect>({ x: 5, y: 5, w: 90, h: 90 });
  const [busy, setBusy] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: 'draw' | 'move' | 'resize';
    handle?: 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    startRect: Rect;
  } | null>(null);

  function getPct(e: React.PointerEvent | PointerEvent): { x: number; y: number } {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }

  function startDraw(e: React.PointerEvent) {
    e.preventDefault();
    const p = getPct(e);
    drag.current = {
      mode: 'draw',
      startX: p.x,
      startY: p.y,
      startRect: rect,
    };
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function startMove(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const p = getPct(e);
    drag.current = {
      mode: 'move',
      startX: p.x,
      startY: p.y,
      startRect: rect,
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  function startResize(e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') {
    e.preventDefault();
    e.stopPropagation();
    const p = getPct(e);
    drag.current = {
      mode: 'resize',
      handle,
      startX: p.x,
      startY: p.y,
      startRect: rect,
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!drag.current) return;
      const p = getPct(e);
      const d = drag.current;
      if (d.mode === 'draw') {
        const x = Math.min(d.startX, p.x);
        const y = Math.min(d.startY, p.y);
        const w = Math.abs(p.x - d.startX);
        const h = Math.abs(p.y - d.startY);
        setRect({ x, y, w, h });
      } else if (d.mode === 'move') {
        const dx = p.x - d.startX;
        const dy = p.y - d.startY;
        const nx = Math.max(0, Math.min(100 - d.startRect.w, d.startRect.x + dx));
        const ny = Math.max(0, Math.min(100 - d.startRect.h, d.startRect.y + dy));
        setRect({ ...d.startRect, x: nx, y: ny });
      } else if (d.mode === 'resize' && d.handle) {
        const sr = d.startRect;
        let x1 = sr.x;
        let y1 = sr.y;
        let x2 = sr.x + sr.w;
        let y2 = sr.y + sr.h;
        if (d.handle === 'nw') { x1 = p.x; y1 = p.y; }
        if (d.handle === 'ne') { x2 = p.x; y1 = p.y; }
        if (d.handle === 'sw') { x1 = p.x; y2 = p.y; }
        if (d.handle === 'se') { x2 = p.x; y2 = p.y; }
        const nx = Math.max(0, Math.min(x1, x2));
        const ny = Math.max(0, Math.min(y1, y2));
        const nw = Math.min(100 - nx, Math.abs(x2 - x1));
        const nh = Math.min(100 - ny, Math.abs(y2 - y1));
        setRect({ x: nx, y: ny, w: nw, h: nh });
      }
    }
    function onUp() {
      drag.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  async function handleConfirm() {
    if (rect.w < 2 || rect.h < 2) {
      alert('בחר אזור גדול יותר');
      return;
    }
    setBusy(true);
    try {
      const b64 = await cropToBase64(imageSrc, rect, mimeType);
      onConfirm(b64);
    } catch {
      setBusy(false);
      alert('שגיאה בחיתוך התמונה. נסה שוב.');
    }
  }

  function handleReset() {
    setRect({ x: 5, y: 5, w: 90, h: 90 });
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="text-center">
        <p className="text-sm font-bold text-white">✂️ סמן את אזור הטופס</p>
        <p className="text-[11px] text-[#5a7a9a] mt-0.5">
          גרור על התמונה כדי לסמן מלבן חדש, או הזז את הפינות של המלבן הקיים. שמור רק את אזור הטופס.
        </p>
      </div>

      <div
        ref={wrapRef}
        onPointerDown={startDraw}
        className="relative w-full select-none touch-none rounded-xl overflow-hidden border border-white/10 bg-black"
        style={{ minHeight: 200 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt="חיתוך"
          draggable={false}
          className="block w-full h-auto pointer-events-none select-none"
        />

        {/* Dim overlay outside the rect */}
        <div className="absolute inset-0 pointer-events-none">
          {/* top */}
          <div
            className="absolute bg-black/60"
            style={{ left: 0, top: 0, width: '100%', height: `${rect.y}%` }}
          />
          {/* bottom */}
          <div
            className="absolute bg-black/60"
            style={{
              left: 0,
              top: `${rect.y + rect.h}%`,
              width: '100%',
              height: `${Math.max(0, 100 - rect.y - rect.h)}%`,
            }}
          />
          {/* left */}
          <div
            className="absolute bg-black/60"
            style={{ left: 0, top: `${rect.y}%`, width: `${rect.x}%`, height: `${rect.h}%` }}
          />
          {/* right */}
          <div
            className="absolute bg-black/60"
            style={{
              left: `${rect.x + rect.w}%`,
              top: `${rect.y}%`,
              width: `${Math.max(0, 100 - rect.x - rect.w)}%`,
              height: `${rect.h}%`,
            }}
          />
        </div>

        {/* Selection rectangle */}
        {rect.w > 0 && rect.h > 0 && (
          <div
            onPointerDown={startMove}
            className="absolute border-2 border-orange-400 cursor-move"
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
            }}
          >
            {/* Corner handles */}
            {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
              <div
                key={h}
                onPointerDown={(e) => startResize(e, h)}
                className="absolute w-4 h-4 bg-orange-500 border-2 border-white rounded-sm"
                style={{
                  left: h.includes('w') ? -8 : undefined,
                  right: h.includes('e') ? -8 : undefined,
                  top: h.includes('n') ? -8 : undefined,
                  bottom: h.includes('s') ? -8 : undefined,
                  cursor:
                    h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={busy || rect.w < 2 || rect.h < 2}
          className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm transition-all"
        >
          {busy ? '...חותך' : '✂️ חתוך והמשך'}
        </button>
        <button
          onClick={handleReset}
          disabled={busy}
          className="px-4 border border-white/10 text-[#8aaac8] hover:text-white font-medium py-2.5 rounded-xl text-sm hover:bg-white/5 transition-all"
        >
          איפוס
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          className="px-4 border border-white/10 text-[#8aaac8] hover:text-white font-medium py-2.5 rounded-xl text-sm hover:bg-white/5 transition-all"
        >
          דלג
        </button>
      </div>
    </div>
  );
}
