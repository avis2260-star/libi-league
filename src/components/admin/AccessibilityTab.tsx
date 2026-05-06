'use client';

import { useState, useTransition } from 'react';
import { saveAccessibilitySetting, type AccessibilitySettingKey } from '@/app/admin/actions';

type Props = {
  coordinatorName: string;
  coordinatorEmail: string;
  updatedAt: string;
};

function FieldRow({
  title,
  subtitle,
  settingKey,
  initial,
  type = 'text',
  placeholder,
}: {
  title: string;
  subtitle: string;
  settingKey: AccessibilitySettingKey;
  initial: string;
  type?: 'text' | 'email';
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setErr(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveAccessibilitySetting(settingKey, value);
      if (result.error) {
        setErr(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const changed = value !== initial;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">{title}</h3>
          <p className="text-xs text-[#5a7a9a] mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && <span className="text-xs text-green-400 font-medium">✓ נשמר</span>}
          {err && <span className="text-xs text-red-400 font-medium">{err}</span>}
          <button
            onClick={handleSave}
            disabled={pending || !changed}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>

      <input
        dir="rtl"
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.08] bg-[#0a1525] px-4 py-2 text-sm text-[#c0d4e8] placeholder:text-[#3a5a7a] focus:border-orange-500/40 focus:outline-none focus:ring-1 focus:ring-orange-500/20"
      />
    </div>
  );
}

export default function AccessibilityTab({ coordinatorName, coordinatorEmail, updatedAt }: Props) {
  return (
    <div dir="rtl" className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-black text-white">♿ הצהרת נגישות</h2>
        <p className="text-sm text-[#5a7a9a] mt-1">
          השדות הניתנים לעריכה מופיעים בדף הציבורי{' '}
          <a href="/accessibility" target="_blank" className="text-orange-400 hover:underline">
            /accessibility ↗
          </a>
          . שאר תוכן ההצהרה (הנוסח החוקי) מקובע ולא ניתן לעריכה כדי לשמר עמידה ברגולציה.
        </p>
      </div>

      <FieldRow
        title="שם רכז הנגישות"
        subtitle="השם המלא שיוצג בדף ההצהרה"
        settingKey="accessibility_coordinator_name"
        initial={coordinatorName}
        placeholder="לדוגמה: ישראל ישראלי"
      />

      <FieldRow
        title="כתובת מייל של רכז הנגישות"
        subtitle="הופך לקישור mailto: בדף ההצהרה"
        settingKey="accessibility_coordinator_email"
        initial={coordinatorEmail}
        type="email"
        placeholder="example@libi-league.org"
      />

      <FieldRow
        title="תאריך עדכון ההצהרה"
        subtitle="טקסט חופשי — לדוגמה ״מאי 2026״"
        settingKey="accessibility_updated_at"
        initial={updatedAt}
        placeholder="מאי 2026"
      />
    </div>
  );
}
