import { createSupabaseServerClient } from '@/lib/supabase-server';
import { logoutAction } from '@/app/login/actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: 'Admin — LIBI League' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware handles the redirect, but guard here too in case it's bypassed.
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-gray-800 bg-gray-900 px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏀</span>
          <span className="font-bold text-orange-400">Admin</span>
          <span className="hidden text-sm text-gray-500 sm:inline">— LIBI League</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[180px] truncate text-xs text-gray-400 sm:inline">
            {user.email}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition hover:border-red-500 hover:text-red-400"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/"
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition hover:border-gray-500"
          >
            ← Site
          </Link>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="flex overflow-x-auto border-b border-gray-800 bg-gray-900">
        {[
          { href: '/admin?tab=games',        label: '🎮 Games' },
          { href: '/admin?tab=boxscore',     label: '📊 Box Score' },
          { href: '/admin?tab=media',        label: '🎥 Media' },
          { href: '/admin?tab=players',      label: '👤 שחקנים' },
          { href: '/admin?tab=sync',         label: '📋 Sync' },
          { href: '/admin?tab=seasons',      label: '📅 עונות' },
          { href: '/admin?tab=officials',    label: '🦺 שופטים' },
          { href: '/admin?tab=disciplinary', label: '⚠️ משמעת' },
          { href: '/admin?tab=settings',     label: '⚙️ הגדרות' },
          { href: '/admin?tab=announcements',label: '📢 הודעות' },
          { href: '/admin?tab=synclog',      label: '📜 לוג' },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="flex h-12 shrink-0 items-center justify-center gap-1.5 border-b-2 border-transparent px-4 text-sm font-medium text-gray-400 transition hover:border-orange-500 hover:text-white sm:px-6"
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Page content */}
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
