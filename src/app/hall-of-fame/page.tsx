export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';

type Season = {
  id: string;
  year: string;
  champion_name: string | null;
  champion_logo: string | null;
  champion_captain: string | null;
  mvp_name: string | null;
  mvp_stats: string | null;
  is_current: boolean | null;
  sort_order: number | null;
};

type Record = {
  id: string;
  title: string;
  holder: string | null;
  value: string | null;
  record_date: string | null;
  sort_order: number | null;
};

export default async function HallOfFamePage() {
  let seasons: Season[] = [];
  let records: Record[] = [];

  try {
    const [{ data: s }, { data: r }] = await Promise.all([
      supabaseAdmin.from('league_history_seasons').select('*').order('sort_order'),
      supabaseAdmin.from('league_history_records').select('*').order('sort_order'),
    ]);
    seasons = (s ?? []) as Season[];
    records = (r ?? []) as Record[];
  } catch {
    seasons = [];
    records = [];
  }

  return (
    <div className="bg-slate-950 min-h-screen p-8 text-white font-body text-right" dir="rtl">

      <header className="mb-12 border-b border-orange-500/30 pb-6">
        <h1 className="font-heading font-black text-5xl mb-2 italic uppercase">היכל התהילה</h1>
        <p className="text-slate-400 text-lg font-body">מורשת הכדורסל של ליגת ליבי</p>
      </header>

      {/* קיר האלופות */}
      <section className="mb-16">
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-orange-500 inline-block"></span> אלופות הליגה
        </h2>
        {seasons.length === 0 ? (
          <p className="text-slate-500 text-center py-12">אין עונות להצגה עדיין</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {seasons.map((season) => (
              <div
                key={season.id}
                className="relative group overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 hover:border-orange-500 transition-all"
              >
                {/* Large year watermark */}
                <div className="absolute -left-4 -top-4 font-stats text-8xl text-white/5 group-hover:text-orange-500/10 transition-colors select-none">
                  {season.year.split('-')[0]}
                </div>

                <p className="font-stats text-2xl text-orange-500">{season.year}</p>
                <h3 className="font-heading font-black text-3xl mb-4">{season.champion_name ?? '—'}</h3>

                <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-body">MVP של העונה</p>
                    <p className="font-heading font-bold">{season.mvp_name ?? '—'}</p>
                    <p className="font-stats text-lg text-orange-400">{season.mvp_stats ?? ''}</p>
                  </div>
                  <div className="bg-orange-500 text-black px-3 py-1 rounded-full text-xs font-black font-heading">
                    CHAMPIONS
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* לוח שיאי כל הזמנים */}
      <section>
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-orange-500 inline-block"></span> שיאי כל הזמנים
        </h2>
        {records.length === 0 ? (
          <p className="text-slate-500 text-center py-12">אין שיאים להצגה עדיין</p>
        ) : (
          <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800">
            <table className="w-full">
              <thead className="bg-slate-800/50 font-heading text-orange-500 text-sm italic">
                <tr>
                  <th className="p-4 text-right">קטגוריה</th>
                  <th className="p-4 text-right">בעל השיא</th>
                  <th className="p-4 text-center">נתון</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-orange-500/5 transition-colors">
                    <td className="p-4 font-heading font-bold">{record.title}</td>
                    <td className="p-4 font-body text-slate-300">{record.holder ?? '—'}</td>
                    <td className="p-4 text-center font-stats text-3xl text-orange-500">{record.value ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
