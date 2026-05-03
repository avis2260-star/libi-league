'use client';

import { useState, useTransition } from 'react';
import { saveAboutSetting, type AboutSettingKey } from '@/app/admin/actions';

type Props = {
  heroSubtitle: string;
  story: string;
  association: string;
  chairmanName: string;
};

function FieldSection({
  title,
  subtitle,
  settingKey,
  initial,
  rows,
  multiParagraphHint,
}: {
  title: string;
  subtitle: string;
  settingKey: AboutSettingKey;
  initial: string;
  rows: number;
  multiParagraphHint?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setErr(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveAboutSetting(settingKey, text);
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

      <textarea
        dir="rtl"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={rows}
        placeholder={`הקלד כאן את ${title}...`}
        className="w-full rounded-xl border border-white/[0.08] bg-[#0a1525] px-4 py-3 text-sm text-[#c0d4e8] placeholder:text-[#3a5a7a] focus:border-orange-500/40 focus:outline-none focus:ring-1 focus:ring-orange-500/20 resize-y leading-relaxed"
      />

      <p className="text-[11px] text-[#3a5a7a]">
        {text.length.toLocaleString('he-IL')} תווים
        {multiParagraphHint && ' · הפרד בין פסקאות בשורה ריקה (Enter פעמיים)'}
      </p>
    </div>
  );
}

export default function AboutTab({ heroSubtitle, story, association, chairmanName }: Props) {
  return (
    <div dir="rtl" className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-black text-white">📖 עריכת דף אודות</h2>
        <p className="text-sm text-[#5a7a9a] mt-1">
          הטקסטים שתערוך כאן יוצגו בדף הציבורי{' '}
          <a href="/about" target="_blank" className="text-orange-400 hover:underline">
            /about ↗
          </a>
          . שינויים נשמרים פר-שדה בנפרד.
        </p>
      </div>

      <FieldSection
        title="כותרת משנה (Hero)"
        subtitle="המשפט הקצר שמופיע מתחת ללוגו ולשם הליגה"
        settingKey="about_hero_subtitle"
        initial={heroSubtitle}
        rows={3}
      />

      <FieldSection
        title="הסיפור שלנו"
        subtitle="ההיסטוריה של הליגה — איך הוקמה, איך גדלה, מי החברים בה"
        settingKey="about_story"
        initial={story}
        rows={10}
        multiParagraphHint
      />

      <FieldSection
        title="עמותת עוצמת ליב״י"
        subtitle="רקע על העמותה והקשר לקהילת ביתא ישראל"
        settingKey="about_association"
        initial={association}
        rows={8}
        multiParagraphHint
      />

      <FieldSection
        title="שם יו״ר העמותה"
        subtitle="מוצג בתחתית סקשן העמותה"
        settingKey="about_chairman_name"
        initial={chairmanName}
        rows={1}
      />
    </div>
  );
}
