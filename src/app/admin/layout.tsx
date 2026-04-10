import { createSupabaseServerClient } from '@/lib/supabase-server';
import { logoutAction } from '@/app/login/actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import AdminNav from '@/components/admin/AdminNav';

export const metadata = { title: 'Admin — LIBI League' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware handles the redirect, but guard here too in case it's bypassed.
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-[#060810] text-white">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0f1e30] px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏀</span>
          <span className="font-bold text-orange-400">Admin</span>
          <span className="hidden text-sm text-gray-500 sm:inline">— LIBI League</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[180px] truncate text-xs text-[#5a7a9a] sm:inline">
            {user.email}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-sm text-[#6b8aaa] transition hover:border-red-500 hover:text-red-400"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/"
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-sm text-[#6b8aaa] transition hover:border-white/20 hover:text-white"
          >
            ← Site
          </Link>
        </div>
      </header>

      {/* Tab nav — grouped dropdowns */}
      <Suspense fallback={<div className="h-12 border-b border-white/[0.06] bg-[#0f1e30]" />}>
        <AdminNav />
      </Suspense>

      {/* Page content */}
      <main className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:pb-6">{children}</main>
    </div>
  );
}
