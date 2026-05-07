'use client';

import { useState, useRef, useEffect } from 'react';

type Setting = { key: string; value: string };

const SETTING_LABELS: Record<string, string> = {
  points_per_win: 'נקודות לניצחון',
  points_per_loss: 'נקודות להפסד',
  max_fouls_per_player: 'עבירות מקסימום לשחקן',
  period_length_minutes: 'אורך רבע (דקות)',
  periods_per_game: 'מספר רבעים',
  tiebreaker: 'שיטת שוויון',
  technical_suspension_threshold: 'ספף טכניות להשעיה',
};

const CATEGORIES = [
  { label: 'ניקוד', keys: ['points_per_win', 'points_per_loss'] },
  { label: 'חוקים', keys: ['max_fouls_per_player', 'period_length_minutes', 'periods_per_game'] },
  { label: 'מיון', keys: ['tiebreaker'] },
  { label: 'משמעת', keys: ['technical_suspension_threshold'] },
];

export default function LeagueSettingsTab({ settings: initial }: { settings: Setting[] }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(initial.map((s) => [s.key, s.value]))
  );
  const [status, setStatus] = useState<Record<string, { ok: boolean; text: string } | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  /* ── Logo upload state ── */
  const [logoUrl, setLogoUrl]         = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load current logo URL on mount
  useEffect(() => {
    fetch('/api/admin/logo')
      .then(r => r.json())
      .then(d => { if (d.url) setLogoUrl(d.url); })
      .catch(() => {});
  }, []);

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setLogoUploading(true);
    setLogoMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', logoFile);
      const res = await fetch('/api/admin/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setLogoUrl(data.url);
      setLogoFile(null);
      setLogoPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      setLogoMsg({ ok: true, text: '✅ הלוגו עודכן בהצלחה! ייתכן שיידרש רענון' });
    } catch (err) {
      setLogoMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setLogoUploading(false);
    }
  }

  async function revertLogo() {
    if (!confirm('להחזיר את הלוגו המקורי?')) return;
    try {
      await fetch('/api/admin/logo', { method: 'DELETE' });
      setLogoUrl(null);
      setLogoMsg({ ok: true, text: '✅ הלוגו המקורי שוחזר' });
    } catch {
      setLogoMsg({ ok: false, text: 'שגיאה בשחזור' });
    }
  }

  async function handleSave(key: string) {
    setSaving((prev) => ({ ...prev, [key]: true }));
    setStatus((prev) => ({ ...prev, [key]: null }));
    try {
      const res = await fetch('/api/admin/league-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: values[key] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setStatus((prev) => ({ ...prev, [key]: { ok: true, text: '✅ נשמר' } }));
      setTimeout(() => setStatus((prev) => ({ ...prev, [key]: null })), 2000);
    } catch (err: unknown) {
      setStatus((prev) => ({ ...prev, [key]: { ok: false, text: err instanceof Error ? err.message : 'שגיאה' } }));
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">הגדרות ליגה</h2>
        <p className="text-sm text-gray-400">ניהול פרמטרים של הליגה</p>
      </div>

      {/* ── League Logo Upload ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-700 bg-gray-900/60 overflow-hidden">
        <div className="bg-gray-800/70 px-4 py-3 border-b border-gray-700 sm:px-5">
          <h3 className="font-semibold text-orange-400">🏀 לוגו הליגה</h3>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Current logo preview */}
            <div className="relative h-24 w-24 shrink-0 rounded-full border-2 border-gray-600 bg-gray-800 overflow-hidden flex items-center justify-center">
              {(logoPreview ?? logoUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview ?? logoUrl ?? ''}
                  alt="לוגו הליגה"
                  className="h-full w-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/logo.png" alt="לוגו ברירת מחדל" className="h-full w-full object-contain" />
              )}
            </div>

            {/* Controls */}
            <div className="flex-1 min-w-0 space-y-3">
              <p className="text-sm text-gray-400">
                {logoUrl ? '✅ לוגו מותאם אישית פעיל' : '📁 משתמש בלוגו ברירת המחדל'}
              </p>

              {/* Hidden file input */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoFileChange}
              />

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 transition"
                >
                  📂 בחר תמונה חדשה
                </button>

                {logoFile && (
                  <button
                    type="button"
                    onClick={uploadLogo}
                    disabled={logoUploading}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {logoUploading ? 'מעלה...' : '⬆️ העלה לוגו'}
                  </button>
                )}

                {logoFile && (
                  <button
                    type="button"
                    onClick={() => { setLogoFile(null); setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = ''; }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    ✕ בטל
                  </button>
                )}

                {logoUrl && !logoFile && (
                  <button
                    type="button"
                    onClick={revertLogo}
                    className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition"
                  >
                    🔄 החזר לוגו מקורי
                  </button>
                )}
              </div>

              {logoFile && (
                <p className="text-xs text-gray-500">קובץ נבחר: {logoFile.name}</p>
              )}
            </div>
          </div>

          {logoMsg && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${logoMsg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
              {logoMsg.text}
            </p>
          )}
        </div>
      </div>

      {CATEGORIES.map((cat) => (
        <div key={cat.label} className="rounded-xl border border-gray-700 bg-gray-900/60 overflow-hidden">
          <div className="bg-gray-800/70 px-4 py-3 border-b border-gray-700 sm:px-5">
            <h3 className="font-semibold text-orange-400">{cat.label}</h3>
          </div>
          <div className="p-4 space-y-5 sm:p-5 sm:space-y-4">
            {cat.keys.map((key) => (
              <div
                key={key}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
              >
                {/* Label — full width on mobile, fixed width on desktop */}
                <label className="text-sm text-gray-300 sm:w-48 sm:shrink-0">
                  {SETTING_LABELS[key] ?? key}
                </label>

                {/* Input + save button row — wraps together on mobile */}
                <div className="flex items-center gap-2 sm:flex-1 sm:gap-3">
                  {key === 'tiebreaker' ? (
                    <select
                      value={values[key] ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    >
                      <option value="head_to_head">יתרון ישיר (head_to_head)</option>
                      <option value="point_differential">הפרש נקודות (point_differential)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={values[key] ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  )}
                  <button
                    onClick={() => handleSave(key)}
                    disabled={saving[key]}
                    className="shrink-0 rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 sm:px-4"
                  >
                    {saving[key] ? '...' : 'שמור'}
                  </button>
                  {status[key] && (
                    <span className={`shrink-0 text-xs font-medium ${status[key]!.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {status[key]!.text}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
