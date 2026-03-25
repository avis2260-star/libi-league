'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import imageCompression from 'browser-image-compression';

type Props = {
  player: { id: string; name: string; team_id: string | null; photo_url: string | null };
  teamLogoUrl?: string | null;
  onClose: () => void;
  onSuccess: (playerId: string, newUrl: string) => void;
};

/* ─── helpers ─────────────────────────────────────────────────────────── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

async function buildComposite(
  imageSrc: string,
  cropArea: Area,
  teamLogoUrl: string | null | undefined,
): Promise<Blob> {
  const base = await loadImage(imageSrc);
  const SIZE = 600;
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // 1 — Draw cropped base
  ctx.drawImage(base, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, SIZE, SIZE);

  const LOGO = Math.round(SIZE * 0.18); // 18 % of image side

  // 2 — League logo — bottom-right, 80 % opacity
  try {
    const ll = await loadImage('/images/league-logo.png');
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.drawImage(ll, SIZE - LOGO - 12, SIZE - LOGO - 12, LOGO, LOGO);
    ctx.restore();
  } catch { /* no league logo in /public — skip silently */ }

  // 3 — Team logo — top-left, 90 % opacity
  if (teamLogoUrl) {
    try {
      const tl = await loadImage(teamLogoUrl);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(tl, 12, 12, LOGO, LOGO);
      ctx.restore();
    } catch { /* team logo unavailable — skip silently */ }
  }

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('Canvas→Blob failed'))),
      'image/jpeg',
      0.92,
    );
  });
}

/* ─── component ──────────────────────────────────────────────────────── */

export default function PlayerImageModal({ player, teamLogoUrl, onClose, onSuccess }: Props) {
  const [srcDataUrl, setSrcDataUrl] = useState<string | null>(null);
  const [crop,       setCrop      ] = useState<Point>({ x: 0, y: 0 });
  const [zoom,       setZoom      ] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const [step,    setStep   ] = useState<'pick' | 'crop' | 'preview'>('pick');
  const [preview, setPreview] = useState<string | null>(null);
  const [blob,    setBlob   ] = useState<Blob | null>(null);

  const [busy,  setBusy ] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  /* pick file */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    const compressed = await imageCompression(raw, { maxSizeMB: 0.5, maxWidthOrHeight: 1200 });
    const reader = new FileReader();
    reader.onload = () => {
      setSrcDataUrl(reader.result as string);
      setStep('crop');
    };
    reader.readAsDataURL(compressed);
  }

  const onCropComplete = useCallback((_: Area, px: Area) => {
    setCroppedArea(px);
  }, []);

  /* build composite after crop confirm */
  async function handleCropConfirm() {
    if (!srcDataUrl || !croppedArea) return;
    setBusy(true);
    try {
      const b = await buildComposite(srcDataUrl, croppedArea, teamLogoUrl);
      const url = URL.createObjectURL(b);
      setPreview(url);
      setBlob(b);
      setStep('preview');
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setBusy(false);
    }
  }

  /* upload composite + update DB */
  async function handleUpload() {
    if (!blob) return;
    setBusy(true);
    setToast(null);
    try {
      // 1 — upload file
      const fd = new FormData();
      fd.append('file', blob, `player-${player.id}.jpg`);
      const upRes  = await fetch('/api/admin/players/upload', { method: 'POST', body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error ?? 'Upload failed');

      // 2 — update photo_url in players table
      const patchRes = await fetch('/api/admin/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: player.id, photo_url: upData.url }),
      });
      if (!patchRes.ok) throw new Error('DB update failed');

      setToast({ ok: true, msg: '✅ תמונה עודכנה בהצלחה!' });
      setTimeout(() => {
        onSuccess(player.id, upData.url);
        onClose();
      }, 1000);
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setBusy(false);
    }
  }

  /* ── render ── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="font-bold text-white text-lg" dir="rtl">
            עדכון תמונה — {player.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4" dir="rtl">

          {/* ── STEP 1: Pick file ── */}
          {step === 'pick' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="text-5xl">🖼️</div>
              <p className="text-gray-400 text-sm text-center">בחר תמונה מהמכשיר שלך (עד 500KB)</p>
              <label className="cursor-pointer rounded-xl bg-orange-500 hover:bg-orange-600 transition px-6 py-2.5 text-sm font-bold text-white">
                בחר תמונה
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </label>
            </div>
          )}

          {/* ── STEP 2: Crop ── */}
          {step === 'crop' && srcDataUrl && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">גרור וגזור את התמונה (יחס 1:1)</p>
              {/* Crop area */}
              <div className="relative w-full" style={{ height: 300, background: '#111' }}>
                <Cropper
                  image={srcDataUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              {/* Zoom slider */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">זום</span>
                <input
                  type="range" min={1} max={3} step={0.05}
                  value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-orange-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setStep('pick')} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">
                  חזור
                </button>
                <button
                  onClick={handleCropConfirm}
                  disabled={busy}
                  className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {busy && <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {busy ? 'מעבד...' : 'אשר חיתוך'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview & Upload ── */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 text-center">תצוגה מקדימה עם לוגואים</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="preview" className="mx-auto rounded-xl border border-gray-700 w-64 h-64 object-cover" />
              <div className="text-xs text-gray-500 text-center space-y-0.5">
                <p>✦ לוגו ליגה — פינה ימנית תחתית (80% שקיפות)</p>
                <p>✦ לוגו קבוצה — פינה שמאלית עליונה (90% שקיפות)</p>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setStep('crop')} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">
                  חזור לחיתוך
                </button>
                <button
                  onClick={handleUpload}
                  disabled={busy}
                  className="rounded-lg bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {busy && <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {busy ? 'מעלה...' : '⬆️ שמור תמונה'}
                </button>
              </div>
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div className={`rounded-lg px-4 py-2 text-sm font-medium ${toast.ok ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
              {toast.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
