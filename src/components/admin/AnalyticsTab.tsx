'use client';

// Vercel doesn't expose a public Web Analytics REST API — their dashboard
// uses cookie-authenticated internal endpoints. Rather than ship a tab
// that always shows "אין נתונים", we link out to the real dashboard.

const DASHBOARD_URL = 'https://vercel.com/avis2260-6714s-projects/libi-league/analytics';

export default function AnalyticsTab() {
  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">📊 אנליטיקה</h2>
        <p className="text-sm font-bold text-[#8aaac8]">
          נתוני המבקרים מתארחים אצל Vercel Web Analytics
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#0c1825] p-6 space-y-4">
        <p className="text-sm font-bold text-[#c0d4e8] leading-relaxed">
          מבקרים ייחודיים, צפיות עמוד, שיעור נטישה, עמודים פופולריים ומקורות
          תנועה — הכל זמין בלוח הניהול של Vercel. נדרשת הזדהות לחשבון
          Vercel של הליגה כדי לצפות בנתונים.
        </p>

        <a
          href={DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-5 py-2.5 text-sm font-black text-white transition"
        >
          <span>פתח לוח Vercel</span>
          <span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  );
}
