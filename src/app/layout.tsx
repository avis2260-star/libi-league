export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';
import { supabaseAdmin } from '@/lib/supabase-admin';
import MobileNav from '@/components/MobileNav';

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

const NAV_LINKS = [
  { href: '/',          label: 'בית'       },
  { href: '/games',     label: 'משחקים'    },
  { href: '/results',   label: 'תוצאות'    },
  { href: '/standings', label: 'טבלאות'    },
  { href: '/teams',     label: 'קבוצות'    },
  { href: '/cup',       label: 'גביע 🏆'   },
  { href: '/takanon',  label: 'תקנון 📋'  },
  { href: '/playoff',  label: 'פלייאוף'   },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const logoUrl = await getLogoUrl();
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} min-h-screen bg-[#0b1520] text-[#e8edf5]`}>

        {/* ── Top navigation ───────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0f1e30]/95 backdrop-blur-sm">
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

            {/* Desktop nav */}
            <ul className="hidden sm:flex gap-1 text-sm font-semibold">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="rounded-lg px-3 py-2 text-[#6b8aaa] transition hover:bg-white/5 hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Mobile nav */}
            <MobileNav />
          </nav>
        </header>

        {/* ── Page content ─────────────────────────────────────────────── */}
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="mt-16 border-t border-white/5 py-6 text-center text-xs text-[#3a5a7a]">
          © {new Date().getFullYear()} ליגת ליבי · כל הזכויות שמורות
        </footer>

      </body>
    </html>
  );
}
