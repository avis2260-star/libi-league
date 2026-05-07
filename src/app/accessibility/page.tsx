export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLang } from '@/lib/get-lang';

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

type CopyKey =
  | 'pageTitle' | 'updatedAt' | 'intro' | 'siteInfoHeader'
  | 'exemption' | 'commitment' | 'helpHeader' | 'helpBody'
  | 'coordinatorHeader' | 'name' | 'email' | 'updatedAtFallback';

const COPY: Record<'he' | 'en', Record<CopyKey, string>> = {
  he: {
    pageTitle: 'הצהרת נגישות — ליגת ליבי',
    updatedAt: 'תאריך עדכון ההצהרה:',
    intro:
      'אנו בליגת ליבי רואים חשיבות רבה במתן שירות שוויוני לכלל הגולשים. האתר נבנה בהתנדבות מלאה לטובת הקהילה ובמטרה להנגיש את נתוני הכדורסל בצורה נוחה ופשוטה.',
    siteInfoHeader: '📋 מידע על נגישות האתר',
    exemption:
      'אתר זה פטור מחובת הנגשה לפי תקנה 35(ו) לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013, בשל מחזור הכנסות שנתי הנמוך מ-100,000 ש"ח.',
    commitment:
      'עם זאת, אנו משתדלים להקפיד על מבנה אתר תקני ושימוש בשפה פשוטה ככל הניתן לרווחת כלל המשתמשים.',
    helpHeader: '🤝 נתקלתם בבעיה? אנחנו כאן כדי לעזור!',
    helpBody:
      'אם במהלך הגלישה באתר נתקלתם בקושי בנגישות או במידע שאינו נגיש עבורכם, נשמח לעמוד לרשותכם ולספק את המידע באמצעים חלופיים.',
    coordinatorHeader: '👤 פרטי רכז הנגישות',
    name: 'שם:',
    email: 'מייל:',
    updatedAtFallback: 'מאי 2026',
  },
  en: {
    pageTitle: 'Accessibility Statement — Ligat Libi',
    updatedAt: 'Statement last updated:',
    intro:
      'At Ligat Libi we believe strongly in providing equal service to every visitor. This site was built entirely by volunteers for the community, with the goal of making basketball data convenient and easy to access.',
    siteInfoHeader: '📋 Site accessibility information',
    exemption:
      'This website is exempt from the accessibility requirement under Regulation 35(ו) of the Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations, 5773-2013, due to an annual revenue lower than NIS 100,000.',
    commitment:
      'Even so, we strive to maintain a standards-compliant site structure and use language as plain as possible for the benefit of all users.',
    helpHeader: '🤝 Run into a problem? We\'re here to help!',
    helpBody:
      'If you encounter an accessibility difficulty or information that isn\'t accessible to you while browsing the site, we\'ll be glad to assist and to provide the information through alternative means.',
    coordinatorHeader: '👤 Accessibility coordinator details',
    name: 'Name:',
    email: 'Email:',
    updatedAtFallback: 'May 2026',
  },
};

export default async function AccessibilityPage() {
  const [{ coordinatorName, coordinatorEmail, updatedAt }, lang] = await Promise.all([
    getAccessibilityContent(),
    getLang(),
  ]);
  const t = COPY[lang];
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const align = lang === 'he' ? 'text-right' : 'text-left';
  const startAlign = lang === 'he' ? 'sm:text-right' : 'sm:text-left';
  const startItems = lang === 'he' ? 'sm:items-start' : 'sm:items-start';
  // If user hasn't customized the date, show the locale-appropriate default.
  const displayUpdatedAt =
    updatedAt && updatedAt !== DEFAULT_UPDATED_AT ? updatedAt : t.updatedAtFallback;

  return (
    <main dir={dir} className={`mx-auto max-w-3xl px-4 py-10 sm:py-14 ${align}`}>
      {/* Header */}
      <header className={`mb-8 flex flex-col items-center gap-3 text-center ${startItems} ${startAlign}`}>
        <span className="text-4xl" aria-hidden="true">♿</span>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-heading leading-tight">
          {t.pageTitle}
        </h1>
        <p className="text-sm font-semibold text-[#8aaac8]">
          {t.updatedAt} <span className="text-white">{displayUpdatedAt}</span>
        </p>
      </header>

      {/* Intro */}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 sm:p-6 mb-6">
        <p className="text-base font-semibold text-[#c8d8e8] leading-relaxed">{t.intro}</p>
      </section>

      {/* Site accessibility info */}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 sm:p-6 mb-6 space-y-4">
        <h2 className="text-lg font-bold text-[#e0c97a] font-heading">{t.siteInfoHeader}</h2>
        <p className="text-sm font-semibold text-[#c8d8e8] leading-relaxed">{t.exemption}</p>
        <p className="text-sm font-semibold text-[#c8d8e8] leading-relaxed">{t.commitment}</p>
      </section>

      {/* Help section */}
      <section className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-5 sm:p-6 mb-6 space-y-4">
        <h2 className="text-lg font-bold text-orange-300 font-heading">{t.helpHeader}</h2>
        <p className="text-sm font-semibold text-[#c8d8e8] leading-relaxed">{t.helpBody}</p>
      </section>

      {/* Coordinator details */}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[#e0c97a] font-heading mb-4">{t.coordinatorHeader}</h2>
        <ul className="space-y-3 text-sm font-semibold">
          <li className="flex flex-wrap items-baseline gap-2">
            <span className="text-[#8aaac8]">{t.name}</span>
            <span className="text-white">{coordinatorName}</span>
          </li>
          <li className="flex flex-wrap items-baseline gap-2">
            <span className="text-[#8aaac8]">{t.email}</span>
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
