'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/components/TranslationProvider';

export default function ReportErrorButton() {
  const pathname = usePathname();
  const { t, lang } = useLang();
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
      {/* Floating button — clears mobile bottom nav on small screens. On
          mobile we collapse to an icon-only 44×44 circle so it doesn't
          eclipse bottom-right CTAs on cards (e.g. the cup hero); on sm+
          it expands back to a pill with the full label. */}
      <button
        onClick={() => setOpen(true)}
        aria-label={t('דווח על שגיאה')}
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 flex h-11 w-11 sm:h-auto sm:w-auto items-center justify-center sm:gap-2 rounded-full border border-white/10 bg-[#1a2a3a] sm:px-4 sm:py-2.5 text-sm font-bold text-[#8aaac8] shadow-lg transition-all hover:border-orange-500/40 hover:text-orange-400"
      >
        <span className="text-base leading-none">⚠</span>
        <span className="hidden sm:inline">{t('דווח על שגיאה')}</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            dir={lang === 'en' ? 'ltr' : 'rtl'}
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f1923] p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">{t('דיווח על שגיאה')}</h2>
              <button
                onClick={handleClose}
                aria-label={t('סגור')}
                className="text-xl leading-none text-[#5a7a9a] transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>

            {status === 'success' ? (
              <div className="py-6 text-center">
                <p className="mb-3 text-4xl">✅</p>
                <p className="font-bold text-white">{t('תודה! הדיווח נשלח בהצלחה.')}</p>
                <button
                  onClick={handleClose}
                  className="mt-4 text-sm text-orange-400 hover:underline"
                >
                  {t('סגור')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5a7a9a]">{t('כתובת הדף')}</label>
                  <input
                    type="text"
                    value={pageUrl}
                    readOnly
                    className="w-full select-all cursor-default rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-[#8aaac8]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#5a7a9a]">
                    {t('תיאור השגיאה')} <span className="text-orange-400">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={t('תאר בקצרה מה לא עובד...')}
                    rows={4}
                    required
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-[#3a5a7a] transition-colors focus:border-orange-500/40 focus:outline-none"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-sm text-red-400">{t('שגיאה בשליחה. נסה שוב.')}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending' || !description.trim()}
                  className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-black text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === 'sending' ? t('שולח...') : t('שלח דיווח')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
