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
        <Link href="/hall-of-fame" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-orange-400 transition">
          ← חזרה להיכל התהילה
        </Link>

        {/* Season hero */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8">
          <div className="absolute -left-6 -top-6 font-stats text-[10rem] leading-none text-white/[0.04] select-none">
            {season.year.split('-')[0]}
          </div>
          <div className="relative">
            <p className="font-stats text-3xl text-orange-500 mb-1">{season.year}</p>
            <h1 className="font-heading font-black text-4xl sm:text-5xl mb-2 leading-tight">
              {season.champion_name ?? '—'}
            </h1>
            {season.runner_up_name && (
              <p className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-300">
                <span>🥈</span>
                <span className="text-slate-400">סגנית אלופה:</span>
                <span className="text-white">{season.runner_up_name}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              {season.champion_captain && (
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <span className="text-orange-400">👤</span> קפטן: <strong>{season.champion_captain}</strong>
                </span>
              )}
              {season.mvp_name && (
                <span className="flex items-center gap-1.5 font-semibold text-white">
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

        {/* ── Finals details (score / date / location) ──────────────────── */}
        {(season.final_score || season.final_date || season.final_location) && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
            <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
              <span className="w-8 h-px bg-orange-500 inline-block" /> פרטי הגמר
            </h2>

            {/* Big score banner */}
            {season.final_score && (season.champion_name || season.runner_up_name) && (
              <div className="mb-6 flex items-center justify-center gap-6 rounded-2xl bg-gradient-to-r from-orange-500/10 via-slate-900 to-slate-900 border border-orange-500/20 p-6">
                <div className="flex-1 text-center">
                  <p className="font-heading font-black text-lg sm:text-xl text-white">
                    {season.champion_name ?? '—'}
                  </p>
                  <p className="text-[11px] font-black uppercase tracking-[2px] text-orange-400 mt-1">
                    אלופה
                  </p>
                </div>
                <div className="font-stats text-4xl sm:text-5xl font-black text-orange-500 shrink-0" dir="ltr">
                  {season.final_score}
                </div>
                <div className="flex-1 text-center">
                  <p className="font-heading font-black text-lg sm:text-xl text-slate-200">
                    {season.runner_up_name ?? '—'}
                  </p>
                  <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-400 mt-1">
                    סגנית
                  </p>
                </div>
              </div>
            )}

            {/* Meta rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {season.final_date && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-400">תאריך / שעה</p>
                    <p className="font-bold text-white text-sm">{season.final_date}</p>
                  </div>
                </div>
              )}
              {season.final_location && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <span className="text-2xl">📍</span>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-400">מיקום</p>
                    <p className="font-bold text-white text-sm">{season.final_location}</p>
                  </div>
                </div>
              )}
              {season.final_score && !(season.champion_name || season.runner_up_name) && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:col-span-2">
                  <span className="text-2xl">📋</span>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[2px] text-slate-400">תוצאה</p>
                    <p className="font-stats text-2xl font-black text-orange-400" dir="ltr">{season.final_score}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
