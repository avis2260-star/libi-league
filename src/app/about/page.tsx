export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ContactForm from '@/components/ContactForm';

async function getLogoUrl() {
  try {
    const { data } = await supabaseAdmin.from('league_settings').select('value').eq('key', 'league_logo_url').maybeSingle();
    return data?.value ?? '/logo.png';
  } catch { return '/logo.png'; }
}

export default async function AboutPage() {
  const logoUrl = await getLogoUrl();

  return (
    <div className="max-w-3xl mx-auto space-y-10">

      {/* Hero */}
      <div className="flex flex-col items-center gap-5 text-center py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="ליגת ליבי" className="h-24 w-24 rounded-full object-contain border-2 border-orange-500/30 shadow-[0_0_40px_rgba(249,115,22,0.2)]" />
        <div>
          <h1 className="text-4xl font-black text-white font-heading">ליגת ליבי</h1>
        </div>
        <p className="text-[#c8d8e8] text-base font-semibold leading-relaxed max-w-xl">
          ליגה קהילתית לכדורסל הפועלת משנת 2012 המאגדת קבוצות מרחבי הארץ, עם שני מחוזות — צפון ודרום — ומערכת גביע ופלייאוף מרגשת.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { value: '15', label: 'קבוצות משתתפות', icon: '🏀', href: '/teams' },
          { value: '14', label: 'מחזורי עונה',     icon: '📆', href: '/games' },
          { value: '2',  label: 'מחוזות',           icon: '🗂', href: '/standings' },
        ].map(({ value, label, icon, href }) => (
          <Link key={label} href={href}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4 text-center hover:border-orange-500/40 hover:bg-orange-500/[0.06] transition-all group">
            <div className="text-2xl mb-1">{icon}</div>
            <p className="text-2xl font-black text-orange-400 group-hover:text-orange-300 transition-colors font-stats">{value}</p>
            <p className="text-xs font-bold text-[#8aaac8] mt-0.5 group-hover:text-white transition-colors font-body">{label}</p>
          </Link>
        ))}
      </div>

      {/* Format */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-bold text-[#e0c97a] font-heading">📋 פורמט הליגה</h2>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {[
            { title: 'שלב הבית', desc: '14 מחזורים — כל קבוצה משחקת נגד כל קבוצה אחרת במחוזה פעמיים (בית וחוץ).' },
            { title: 'פלייאוף', desc: 'ארבעת המובילות מכל מחוז נפגשות בסדרות של הטוב מ-3 משחקים — רבע גמר, חצי גמר וגמר.' },
            { title: 'גביע', desc: 'טורניר גביע מקביל הפתוח לכל קבוצות הליגה, בפורמט נוקאאוט חד-שלבי.' },
            { title: 'כלל הבית', desc: 'הקבוצה המדורגת גבוה יותר מארחת את משחקים 1 ו-3. הקבוצה הנמוכה מארחת את משחק 2.' },
          ].map(({ title, desc }) => (
            <div key={title} className="px-5 py-4">
              <p className="font-bold text-white text-sm mb-1 font-heading">{title}</p>
              <p className="text-sm font-semibold text-[#c8d8e8] leading-relaxed font-body">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring system */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-bold text-[#e0c97a] font-heading">🏆 שיטת הניקוד</h2>
        </div>
        <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/[0.05]">
          <div className="p-5 text-center">
            <p className="text-3xl font-black text-green-400 font-stats">2</p>
            <p className="text-sm font-semibold text-white mt-1 font-body">נקודות לקבוצה המנצחת</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-3xl font-black text-red-400 font-stats">1</p>
            <p className="text-sm font-semibold text-white mt-1 font-body">נקודה לקבוצה המפסידה</p>
          </div>
        </div>
        <div className="border-t border-white/[0.05] px-5 py-3 text-xs font-bold text-[#8aaac8]">
          * קבוצה שלא מגיעה למשחק מקבלת 0 נקודות ועלולה להיקנס בניכוי נקודות.
        </div>
      </div>

      {/* Contact form */}
      <ContactForm />

    </div>
  );
}
