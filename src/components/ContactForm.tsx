'use client';

import { useState } from 'react';
import { useLang } from './TranslationProvider';

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function ContactForm() {
  const { lang, t } = useLang();
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [message, setMessage] = useState('');
  const [status,  setStatus]  = useState<Status>('idle');
  const [errMsg,  setErrMsg]  = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrMsg(data.error ?? t('שגיאה לא ידועה'));
        setStatus('error');
      } else {
        setStatus('success');
        setName(''); setEmail(''); setMessage('');
      }
    } catch {
      setErrMsg(t('בעיית חיבור לשרת'));
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 px-5 py-8 text-center space-y-3">
        <div className="text-4xl">✅</div>
        <h3 className="text-lg font-bold text-white">{t('ההודעה נשלחה בהצלחה!')}</h3>
        <p className="text-sm text-[#8aaac8]">{t('נחזור אליך בהקדם.')}</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-2 text-xs text-orange-400 hover:text-orange-300 underline"
        >
          {t('שלח הודעה נוספת')}
        </button>
      </div>
    );
  }

  const inputCls = 'w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-[#4a6a8a] focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.06] transition';

  return (
    <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 px-5 py-6 space-y-4">
      <div className="text-center space-y-1">
        <div className="text-3xl">📬</div>
        <h2 className="text-lg font-bold text-white">{t('צור קשר')}</h2>
        <p className="text-sm text-[#8aaac8]">{t('לשאלות, עדכונים ומידע נוסף על הליגה')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" dir={dir}>
        <input
          type="text"
          placeholder={t('שם מלא')}
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className={inputCls}
        />
        <input
          type="email"
          placeholder={t('כתובת אימייל')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className={inputCls}
        />
        <textarea
          placeholder={t('ההודעה שלך...')}
          value={message}
          onChange={e => setMessage(e.target.value)}
          required
          rows={4}
          className={inputCls + ' resize-none'}
        />

        {status === 'error' && (
          <p className="text-xs text-red-400 text-center">{errMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:cursor-not-allowed transition px-5 py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2"
        >
          {status === 'sending' ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
              </svg>
              {t('שולח...')}
            </>
          ) : t('שלח הודעה')}
        </button>
      </form>
    </div>
  );
}
