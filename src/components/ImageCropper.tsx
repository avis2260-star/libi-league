'use client';

import { useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

async function getCroppedBase64(
  imageSrc: string,
  area: Area,
  mimeType: string,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    0, 0, area.width, area.height,
  );
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
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  async function handleConfirm() {
    if (!area) return;
    setBusy(true);
    try {
      const b64 = await getCroppedBase64(imageSrc, area, mimeType);
      onConfirm(b64);
    } catch {
      setBusy(false);
      alert('שגיאה בחיתוך התמונה. נסה שוב.');
    }
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="text-center">
        <p className="text-sm font-bold text-white">✂️ חתוך לגודל הטופס</p>
        <p className="text-[11px] text-[#5a7a9a] mt-0.5">
          גרור כדי למקם, צבוט/זום לגודל המתאים. השאר רק את הטופס בלי רקע מיותר.
        </p>
      </div>

      <div className="relative w-full h-80 bg-black rounded-xl overflow-hidden border border-white/10">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={undefined}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="contain"
          showGrid={true}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-[#8aaac8] w-10">זום</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="flex-1 accent-orange-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={busy || !area}
          className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm transition-all"
        >
          {busy ? '...חותך' : '✂️ חתוך והמשך'}
        </button>
        <button
          onClick={onSkip}
          disabled={busy}
          className="px-4 border border-white/10 text-[#8aaac8] hover:text-white font-medium py-2.5 rounded-xl text-sm hover:bg-white/5 transition-all"
        >
          השתמש כפי שהיא
        </button>
      </div>
    </div>
  );
}
