export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_COORDINATOR_NAME = '[להשלים]';
const DEFAULT_COORDINATOR_EMAIL = '[להשלים]';
const DEFAULT_UPDATED_AT = 'מאי 2026';

async function getAccessibilityContent() {
  try {
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('key,value')
      .in('key', [
        'accessibility_coordinator_name',
        'accessibility_coordinator_email',
        'accessibility_updated_at',
      ]);
    const map = new Map<string, string>((data ?? []).map((r) => [r.key, r.value]));
    return {
      coordinatorName:  map.get('accessibility_coordinator_name')?.trim()  || DEFAULT_COORDINATOR_NAME,
      coordinatorEmail: map.get('accessibility_coordinator_email')?.trim() || DEFAULT_COORDINATOR_EMAIL,
      updatedAt:        map.get('accessibility_updated_at')?.trim()        || DEFAULT_UPDATED_AT,
    };
  } catch {
    return {
      coordinatorName:  DEFAULT_COORDINATOR_NAME,
      coordinatorEmail: DEFAULT_COORDINATOR_EMAIL,
      updatedAt:        DEFAULT_UPDATED_AT,
    };
  }
}

export default async function AccessibilityPage() {
  const { coordinatorName, coordinatorEmail, updatedAt } = await getAccessibilityContent();

  return (
    <main dir="rtl" className="mx-auto max-w-3xl px-4 py-10 sm:py-14 text-right">
      {/* Header */}
      <header className="mb-8 flex flex-col items-center gap-3 text-center sm:items-start sm:text-right">
        <span className="text-4xl" aria-hidden="true">♿</span>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-heading leading-tight">
          הצהרת נגישות — ליגת ליבי
        </h1>
        <p className="text-sm font-semibold text-[#8aaac8]">
          תאריך עדכון ההצהרה: <span className="text-white">{updatedAt}</span>
        </p>
      </header>

      {/* Intro */}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 sm:p-6 mb-6">
        <p className="text-base font-semibold text-[#c8d8e8] leading-relaxed">
          אנו בליגת ליבי רואים חשיבות רבה במתן שירות שוויוני לכלל הגולשים.
          האתר נבנה בהתנדבות מלאה לטובת הקהילה ובמטרה להנגיש את נתוני הכדורסל בצורה נוחה ופשוטה.
        </p>
      </section>

      {/* Site accessibility info */}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 sm:p-6 mb-6 space-y-4">
        <h2 className="text-lg font-bold text-[#e0c97a] font-heading">📋 מידע על נגישות האתר</h2>
        <p className="text-sm font-semibold text-[#c8d8e8] leading-relaxed">
          אתר זה פטור מחובת הנגשה לפי תקנה 35(ו) לתקנות שוויון זכויות לאנשים עם מוגבלות
          (התאמות נגישות לשירות), תשע&quot;ג-2013, בשל מחזור הכנסות שנתי הנמוך מ-100,000 ש&quot;ח.
        </p>
        <p className="text-sm font-semibold text-[#c8d8e8] leading-relaxed">
          עם זאת, אנו משתדלים להקפיד על מבנה אתר תקני ושימוש בשפה פשוטה ככל הניתן לרווחת כלל המשתמשים.
        </p>
      </section>

      {/* Help section */}
      <section className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-5 sm:p-6 mb-6 space-y-4">
        <h2 className="text-lg font-bold text-orange-300 font-heading">🤝 נתקלתם בבעיה? אנחנו כאן כדי לעזור!</h2>
        <p className="text-sm font-semibold text-[#c8d8e8] leading-relaxed">
          אם במהלך הגלישה באתר נתקלתם בקושי בנגישות או במידע שאינו נגיש עבורכם,
          נשמח לעמוד לרשותכם ולספק את המידע באמצעים חלופיים.
        </p>
      </section>

      {/* Coordinator details */}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[#e0c97a] font-heading mb-4">👤 פרטי רכז הנגישות</h2>
        <ul className="space-y-3 text-sm font-semibold">
          <li className="flex flex-wrap items-baseline gap-2">
            <span className="text-[#8aaac8]">שם:</span>
            <span className="text-white">{coordinatorName}</span>
          </li>
          <li className="flex flex-wrap items-baseline gap-2">
            <span className="text-[#8aaac8]">מייל:</span>
            {coordinatorEmail && coordinatorEmail !== '[להשלים]' ? (
              <a
                href={`mailto:${coordinatorEmail}`}
                className="text-orange-400 hover:text-orange-300 underline underline-offset-2 break-all"
              >
                {coordinatorEmail}
              </a>
            ) : (
              <span className="text-white">{coordinatorEmail}</span>
            )}
          </li>
        </ul>
      </section>
    </main>
  );
}
