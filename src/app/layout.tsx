export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { supabaseAdmin } from '@/lib/supabase-admin';
import GroupedNav from '@/components/GroupedNav';
import BottomNav from '@/components/BottomNav';
import CollapsibleHeader from '@/components/CollapsibleHeader';
import ThemeProvider from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import TranslationProvider from '@/components/TranslationProvider';
import LangToggle from '@/components/LangToggle';
import SearchButton from '@/components/SearchButton';
import CourtBackground from '@/components/CourtBackground';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import AppRotationProvider from '@/components/AppRotationProvider';
import RotationShell from '@/components/RotationShell';
import Footer from '@/components/Footer';
import BackButton from '@/components/BackButton';
import ReportErrorButton from '@/components/ReportErrorButton';
import { getLang, st } from '@/lib/get-lang';

// Self-hosted (src/app/fonts) so builds never depend on downloading from
// Google Fonts. Variable fonts trimmed to the same Hebrew/Latin subsets the
// site used from Google; the weight ranges cover every weight used before.
const heebo     = localFont({ src: './fonts/Heebo-Variable.woff2',     weight: '100 900', display: 'swap', variable: '--font-heebo' });
const teko      = localFont({ src: './fonts/Teko-Variable.woff2',      weight: '300 700', display: 'swap', variable: '--font-teko' });
const assistant = localFont({ src: './fonts/Assistant-Variable.woff2', weight: '200 800', display: 'swap', variable: '--font-assistant' });

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
  const [logoUrl, lang] = await Promise.all([getLogoUrl(), getLang()]);
  const T = (he: string) => st(he, lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0b1520" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ליגת ליבי" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${heebo.className} ${teko.variable} ${assistant.variable} min-h-screen bg-[#060810] text-[#e8edf5]`}>
        <CourtBackground />
        <AppRotationProvider>
        <RotationShell>
        <TranslationProvider initialLang={lang}>
        <ThemeProvider>

          {/* ── Top navigation ───────────────────────────────────────────── */}
          <div className="sticky top-0 z-50">
            <CollapsibleHeader>
              <header className="border-b border-white/5 bg-[#0f1e30]/95 backdrop-blur-sm sm:overflow-visible">
                <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

                  {/* Left: Grouped nav pills + theme toggle */}
                  <div className="flex items-center gap-2">
                    <GroupedNav />
                    <SearchButton />
                    <LangToggle />
                    <ThemeToggle />
                  </div>

                  <BackButton />

                  {/* Right: Logo + title */}
                  <a href="/" className="flex items-center gap-2">
                    <span className="text-lg font-black text-white leading-tight text-right">
                      {T('ליגת ליבי')}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt={T('ליגת ליבי')} className="h-10 w-10 object-contain rounded-full" />
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

          {/* ── Floating error report button ──────────────────────────────── */}
          <ReportErrorButton />

        </ThemeProvider>
        </TranslationProvider>
        </RotationShell>
        </AppRotationProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
