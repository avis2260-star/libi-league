export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';

/* ── page ────────────────────────────────────────────────────────────────── */
export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const decodedYear = decodeURIComponent(year);

  /* 1 — fetch the season record */
  const { data: season } = await supabaseAdmin
    .from('league_history_seasons')
    .select('*')
    .eq('year', decodedYear)
    .maybeSingle();

  if (!season) notFound();

  return (
    <div className="min-h-screen bg-slate-950 text-white font-body" dir="rtl">
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-10">

        {/* Back */}
        <Link href="/hall-of-fame" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-orange-400 transition">
          ← חזרה להיכל התהילה
        </Link>

        {/* Season hero */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8">
          <div className="absolute -left-6 -top-6 font-stats text-[10rem] leading-none text-white/[0.04] select-none">
            {season.year.split('-')[0]}
          </div>
          <div className="relative">
            <p className="font-stats text-3xl text-orange-500 mb-1">{season.year}</p>
            <h1 className="font-heading font-black text-4xl sm:text-5xl mb-4 leading-tight">
              {season.champion_name ?? '—'}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm">
              {season.champion_captain && (
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-orange-400">👤</span> קפטן: <strong>{season.champion_captain}</strong>
                </span>
              )}
              {season.mvp_name && (
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-orange-400">⭐</span> MVP: <strong>{season.mvp_name}</strong>
                  {season.mvp_stats && <span className="font-stats text-lg text-orange-400 ml-1">{season.mvp_stats}</span>}
                </span>
              )}
            </div>
          </div>
          <div className="absolute top-6 left-6 bg-orange-500 text-black px-4 py-1.5 rounded-full text-xs font-black font-heading tracking-wider">
            CHAMPIONS
          </div>
        </header>

      </div>
    </div>
  );
}
