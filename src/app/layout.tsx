export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';
import { supabaseAdmin } from '@/lib/supabase-admin';
import GroupedNav from '@/components/GroupedNav';
import BottomNav from '@/components/BottomNav';
import CollapsibleHeader from '@/components/CollapsibleHeader';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], weight: ['300','400','500','600','700','800','900'] });

export const metadata: Metadata = {
  title: 'ליגת ליבי',
  description: 'ניהול ליגת כדורסל קהילתית — לוח משחקים, טבלאות ותוצאות.',
};

async function getLogoUrl(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('value')
      .eq('key', 'league_logo_url')
      .maybeSingle();
    return data?.value ?? '/logo.png';
  } catch {
    return '/logo.png';
  }
}


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const logoUrl = await getLogoUrl();
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0b1520" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ליגת ליבי" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${heebo.className} min-h-screen bg-[#0b1520] text-[#e8edf5]`}>

        {/* ── Top navigation ───────────────────────────────────────────── */}
        <div className="sticky top-0 z-50">
          <CollapsibleHeader>
            <header className="border-b border-white/5 bg-[#0f1e30]/95 backdrop-blur-sm sm:overflow-visible">
              <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

                <a href="/" className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="ליגת ליבי" className="h-10 w-10 object-contain rounded-full" />
                  <span className="text-lg font-black text-white leading-tight">
                    ליגת ליבי
                    <span className="block text-[10px] font-medium tracking-widest text-[#5a7a9a] uppercase">
                      2025 – 2026
                    </span>
                  </span>
                </a>

                {/* Grouped nav — pills on desktop, hamburger+grid on mobile */}
                <GroupedNav />
              </nav>
            </header>
          </CollapsibleHeader>
        </div>

        {/* ── Page content ─────────────────────────────────────────────── */}
        {/* pb-20 on mobile to clear the bottom nav bar */}
        <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:pb-8">{children}</main>

        {/* ── Footer (desktop only) ─────────────────────────────────────── */}
        <footer className="hidden sm:block mt-16 border-t border-white/5 py-6 text-center text-xs text-[#3a5a7a]">
          © {new Date().getFullYear()} ליגת ליבי · כל הזכויות שמורות
        </footer>

        {/* ── Mobile bottom nav ─────────────────────────────────────────── */}
        <BottomNav />

      </body>
    </html>
  );
}
