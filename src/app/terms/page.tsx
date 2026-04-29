export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';
import { getLang } from '@/lib/get-lang';

async function getSetting(key: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('league_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? '';
}

export default async function TermsPage() {
  const [termsOfUse, privacyPolicy, lang] = await Promise.all([
    getSetting('terms_of_use'),
    getSetting('privacy_policy'),
    getLang(),
  ]);
  const en = lang === 'en';

  const lastUpdated = new Date().toLocaleDateString(en ? 'en-US' : 'he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div dir={en ? 'ltr' : 'rtl'} className="mx-auto max-w-3xl space-y-12 py-4">

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[#5a7a9a] text-sm">
          <Link href="/" className="hover:text-orange-400 transition-colors">{en ? 'Home' : 'בית'}</Link>
          <span>/</span>
          <span>{en ? 'Terms of Use & Privacy Policy' : 'תנאי שימוש ומדיניות פרטיות'}</span>
        </div>
        <h1 className="text-3xl font-black text-white">{en ? 'Terms of Use & Privacy Policy' : 'תנאי שימוש ומדיניות פרטיות'}</h1>
        <p className="text-sm text-[#5a7a9a]">{en ? 'Last updated:' : 'עודכן לאחרונה:'} {lastUpdated}</p>
      </div>

      {/* Terms of Use */}
      {termsOfUse ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <h2 className="text-lg font-black text-orange-400 shrink-0">{en ? 'Terms of Use' : 'תנאי שימוש'}</h2>
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
            <h2 className="text-lg font-black text-orange-400 shrink-0">{en ? 'Privacy Policy' : 'מדיניות פרטיות'}</h2>
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
          <p className="text-[#5a7a9a]">{en ? 'Terms have not been uploaded yet. Contact the site admin.' : 'התנאים טרם הועלו. פנה למנהל האתר.'}</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-2xl border border-white/[0.06] bg-orange-500/[0.04] px-5 py-4 flex items-start gap-3">
        <span className="text-orange-400 text-lg shrink-0">ⓘ</span>
        <p className="text-sm text-[#8aaac8] leading-relaxed">
          {en
            ? 'Site data is for information purposes only. Photos are published with player consent. Found a mistake? '
            : 'הנתונים באתר הינם לידיעה בלבד. התמונות מועלות באישור השחקנים. נמצאה טעות? '}
          <Link href="/about" className="text-orange-400 hover:underline underline-offset-2">
            {en ? 'Contact us' : 'פנו אלינו'}
          </Link>.
        </p>
      </div>

    </div>
  );
}
