export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';
import { supabaseAdmin } from '@/lib/supabase-admin';
import GroupedNav from '@/components/GroupedNav';
import BottomNav from '@/components/BottomNav';
import CollapsibleHeader from '@/components/CollapsibleHeader';
import ThemeProvider from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import TranslationProvider from '@/components/TranslationProvider';
import LangToggle from '@/components/LangToggle';
import CourtBackground from '@/components/CourtBackground';
import { SpeedInsights } from '@vercel/speed-insights/next';
import AppRotationProvider from '@/components/AppRotationProvider';
import RotationShell from '@/components/RotationShell';
import Footer from '@/components/Footer';
import BackButton from '@/components/BackButton';

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
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0b1520" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ליגת ליבי" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${heebo.className} min-h-screen bg-[#060810] text-[#e8edf5]`}>
        <CourtBackground />
        <AppRotationProvider>
        <RotationShell>
        <TranslationProvider>
        <ThemeProvider>

          {/* ── Top navigation ───────────────────────────────────────────── */}
          <div className="sticky top-0 z-50">
            <CollapsibleHeader>
              <header className="border-b border-white/5 bg-[#0f1e30]/95 backdrop-blur-sm sm:overflow-visible">
                <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

                  {/* Left: Grouped nav pills + theme toggle */}
                  <div className="flex items-center gap-2">
                    <GroupedNav />
                    <LangToggle />
                    <ThemeToggle />
                  </div>

                  <BackButton />

                  {/* Right: Logo + title */}
                  <a href="/" className="flex items-center gap-2">
                    <span className="text-lg font-black text-white leading-tight text-right">
                      ליגת ליבי
                      <span className="block text-[10px] font-medium tracking-widest text-[#5a7a9a] uppercase">
                        2025 – 2026
                      </span>
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="ליגת ליבי" className="h-10 w-10 object-contain rounded-full" />
                  </a>
                </nav>
              </header>
            </CollapsibleHeader>
          </div>

          {/* ── Page content ─────────────────────────────────────────────── */}
          <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:pb-8">{children}</main>

          {/* ── Footer (desktop only) ─────────────────────────────────────── */}
          <Footer />

          {/* ── Mobile bottom nav ─────────────────────────────────────────── */}
          <BottomNav />

        </ThemeProvider>
        </TranslationProvider>
        </RotationShell>
        </AppRotationProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
