'use client';

import { useState, useTransition } from 'react';
import { saveTermsSetting } from '@/app/admin/actions';

type Props = {
  termsOfUse: string;
  privacyPolicy: string;
};

function TextSection({
  title,
  subtitle,
  settingKey,
  initial,
}: {
  title: string;
  subtitle: string;
  settingKey: 'terms_of_use' | 'privacy_policy';
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setErr(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveTermsSetting(settingKey, text);
      if (result.error) {
        setErr(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const changed = text !== initial;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-white">{title}</h3>
          <p className="text-xs text-[#5a7a9a] mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="text-xs text-green-400 font-medium">✓ נשמר</span>
          )}
          {err && (
            <span className="text-xs text-red-400 font-medium">{err}</span>
          )}
          <button
            onClick={handleSave}
            disabled={pending || !changed}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>

      <textarea
        dir="rtl"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={14}
        placeholder={`הדבק כאן את תוכן ${title}...`}
        className="w-full rounded-xl border border-white/[0.08] bg-[#0a1525] px-4 py-3 text-sm text-[#c0d4e8] placeholder:text-[#3a5a7a] focus:border-orange-500/40 focus:outline-none focus:ring-1 focus:ring-orange-500/20 resize-y leading-relaxed font-mono"
      />

      <p className="text-[11px] text-[#3a5a7a]">
        {text.length.toLocaleString('he-IL')} תווים · הטקסט יוצג בדף{' '}
        <a href="/terms" target="_blank" className="text-orange-400/70 hover:text-orange-400 underline underline-offset-2">
          /terms ↗
        </a>
      </p>
    </div>
  );
}

export default function TermsTab({ termsOfUse, privacyPolicy }: Props) {
  return (
    <div dir="rtl" className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-black text-white">📋 תנאי שימוש ומדיניות פרטיות</h2>
        <p className="text-sm text-[#5a7a9a] mt-1">
          הטקסט שתכתוב כאן יוצג בדף הציבורי{' '}
          <a href="/terms" target="_blank" className="text-orange-400 hover:underline">/terms</a>.
          ניתן להדביק טקסט חופשי, כולל שורות ריקות.
        </p>
      </div>

      <TextSection
        title="תנאי שימוש"
        subtitle="כללים ותנאים לשימוש באתר"
        settingKey="terms_of_use"
        initial={termsOfUse}
      />

      <TextSection
        title="מדיניות פרטיות"
        subtitle="איך האתר מטפל בנתוני המשתמשים"
        settingKey="privacy_policy"
        initial={privacyPolicy}
      />
    </div>
  );
}
