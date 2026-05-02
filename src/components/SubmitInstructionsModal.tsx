'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'submit-instructions-dismissed';

const DESKTOP_CONTENT = {
  title: '🏀 דגשים קריטיים לעדכון סטטיסטיקה',
  intro: 'לפני שמתחילים, ודאו שטופס המשחק מולכם מולא לפי ההנחיות הבאות:',
  points: [
    {
      label: 'רישום ברור:',
      text: 'שמות השחקנים ומספרי החולצות חייבים להיכתב בצורה ברורה וקריאה.',
    },
    {
      label: 'תיעוד הנקודות:',
      text: 'ברישום השוטף, יש לוודא שמספר השחקן הקולע מופיע לצד התוצאה המעודכנת.',
    },
    {
      label: 'סיכומי ביניים וסוף:',
      text: 'ודאו שסיכמתם את תוצאות הרבעים ואת התוצאה הסופית בטופס.',
    },
    {
      label: 'סטטיסטיקה אישית:',
      text: 'יש לסכם את סך הסלים של כל שחקן בנפרד (בכל מקום פנוי בטופס).',
    },
  ],
  warning: '⚠️ שימו לב: נתונים מטופס לא קריא או חסר – לא יועלו לאתר.',
};

const MOBILE_CONTENT = {
  title: '🏀 דגשים להזנת נתונים',
  intro: 'ודאו שבטופס המצולם:',
  points: [
    { text: 'שמות ומספרים כתובים ברור.' },
    { text: 'מספר השחקן מופיע לצד כל סל.' },
    { text: 'יש סיכום רבעים, תוצאה סופית ונקודות אישיות.' },
  ],
  warning: '⚠️ שימו לב: נתונים לא ברורים לא יועלו לאתר.',
};

export default function SubmitInstructionsModal() {
  const [visible, setVisible]   = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Don't show if user already dismissed permanently
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    setVisible(true);

    // Detect screen size
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function handleConfirm() {
    if (dontShow) localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  }

  if (!visible) return null;

  const content = isMobile ? MOBILE_CONTENT : DESKTOP_CONTENT;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={handleConfirm}
    >
      {/* Card */}
      <div
        dir="rtl"
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1923] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Orange top accent bar */}
        <div className="h-1 w-full bg-gradient-to-l from-orange-500 via-orange-400 to-blue-500" />

        <div className="p-6 sm:p-8 space-y-5">

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-black text-white leading-snug">
            {content.title}
          </h2>

          {/* Intro */}
          <p className="text-sm text-[#c8d8e8] leading-relaxed">
            {content.intro}
          </p>

          {/* Bullet points */}
          <ul className="space-y-3">
            {content.points.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                {/* Orange bullet dot */}
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                <p className="text-sm text-[#c8d8e8] leading-relaxed">
                  {'label' in point && point.label && (
                    <span className="font-black text-white">{point.label} </span>
                  )}
                  {point.text}
                </p>
              </li>
            ))}
          </ul>

          {/* Warning box */}
          <div className="flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/[0.08] px-4 py-3">
            <p className="text-sm font-bold text-orange-300 leading-relaxed">
              {content.warning}
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06]" />

          {/* Don't show again checkbox */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={e => setDontShow(e.target.checked)}
              className="w-4 h-4 accent-orange-500 cursor-pointer shrink-0"
            />
            <span className="text-sm text-[#8aaac8] group-hover:text-white transition-colors">
              אל תציג לי את ההוראות האלו שוב
            </span>
          </label>

          {/* CTA Button */}
          <button
            onClick={handleConfirm}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-black text-white shadow-lg hover:bg-orange-400 active:scale-[0.98] transition-all"
          >
            הבנתי, בואו נתחיל 🏀
          </button>

        </div>
      </div>
    </div>
  );
}
