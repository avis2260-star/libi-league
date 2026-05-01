'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ReportErrorButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [pageUrl, setPageUrl] = useState('');

  useEffect(() => {
    setPageUrl(window.location.href);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl, description: description.trim() }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
      setDescription('');
    } catch {
      setStatus('error');
    }
  }

  function handleClose() {
    setOpen(false);
    setStatus('idle');
    setDescription('');
  }

  return (
    <>
      {/* Floating button — clears mobile bottom nav on small screens */}
      <button
        onClick={() => setOpen(true)}
        aria-label="דווח על שגיאה"
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-[#1a2a3a] px-4 py-2.5 text-sm font-bold text-[#8aaac8] shadow-lg transition-all hover:border-orange-500/40 hover:text-orange-400"
      >
        <span className="text-base leading-none">⚠</span>
        <span>דווח על שגיאה</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            dir="rtl"
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f1923] p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">דיווח על שגיאה</h2>
              <button
                onClick={handleClose}
                aria-label="סגור"
                className="text-xl leading-none text-[#5a7a9a] transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>

            {status === 'success' ? (
              <div className="py-6 text-center">
                <p className="mb-3 text-4xl">✅</p>
                <p className="font-bold text-white">תודה! הדיווח נשלח בהצלחה.</p>
                <button
                  onClick={handleClose}
                  className="mt-4 text-sm text-orange-400 hover:underline"
                >
                  סגור
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5a7a9a]">כתובת הדף</label>
                  <input
                    type="text"
                    value={pageUrl}
                    readOnly
                    className="w-full select-all cursor-default rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-[#8aaac8]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5a7a9a]">
                    תיאור השגיאה <span className="text-orange-400">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="תאר בקצרה מה לא עובד..."
                    rows={4}
                    required
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-[#3a5a7a] transition-colors focus:border-orange-500/40 focus:outline-none"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-sm text-red-400">שגיאה בשליחה. נסה שוב.</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending' || !description.trim()}
                  className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-black text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === 'sending' ? 'שולח...' : 'שלח דיווח'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
