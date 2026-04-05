export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';

async function getSetting(key: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('league_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? '';
}

export default async function TermsPage() {
  const [termsOfUse, privacyPolicy] = await Promise.all([
    getSetting('terms_of_use'),
    getSetting('privacy_policy'),
  ]);

  const lastUpdated = new Date().toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-12 py-4">

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[#5a7a9a] text-sm">
          <Link href="/" className="hover:text-orange-400 transition-colors">בית</Link>
          <span>/</span>
          <span>תנאי שימוש ומדיניות פרטיות</span>
        </div>
        <h1 className="text-3xl font-black text-white">תנאי שימוש ומדיניות פרטיות</h1>
        <p className="text-sm text-[#5a7a9a]">עודכן לאחרונה: {lastUpdated}</p>
      </div>

      {/* Terms of Use */}
      {termsOfUse ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <h2 className="text-lg font-black text-orange-400 shrink-0">תנאי שימוש</h2>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-6">
            <pre className="text-sm text-[#c0d4e8] whitespace-pre-wrap leading-relaxed font-sans">
              {termsOfUse}
            </pre>
          </div>
        </section>
      ) : null}

      {/* Privacy Policy */}
      {privacyPolicy ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <h2 className="text-lg font-black text-orange-400 shrink-0">מדיניות פרטיות</h2>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-6">
            <pre className="text-sm text-[#c0d4e8] whitespace-pre-wrap leading-relaxed font-sans">
              {privacyPolicy}
            </pre>
          </div>
        </section>
      ) : null}

      {/* Empty state */}
      {!termsOfUse && !privacyPolicy && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-[#5a7a9a]">התנאים טרם הועלו. פנה למנהל האתר.</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-2xl border border-white/[0.06] bg-orange-500/[0.04] px-5 py-4 flex items-start gap-3">
        <span className="text-orange-400 text-lg shrink-0">ⓘ</span>
        <p className="text-sm text-[#8aaac8] leading-relaxed">
          הנתונים באתר הינם לידיעה בלבד. התמונות מועלות באישור השחקנים.{' '}
          נמצאה טעות?{' '}
          <Link href="/about" className="text-orange-400 hover:underline underline-offset-2">
            פנו אלינו
          </Link>.
        </p>
      </div>

    </div>
  );
}
