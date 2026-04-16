'use client';

// ── Hall of Fame Preview — NOT pushed, awaiting approval ──────────────────────

const historyData = {
  seasons: [
    {
      year: '2023-2024',
      champion: { name: 'ראשון "גפן" לציון', logo: null, captain: 'יוסף פיסחה' },
      mvp: { name: 'יוסף פיסחה', stats: '24.5 PPG' },
      isCurrent: false,
    },
    {
      year: '2022-2023',
      champion: { name: 'גוטלמן השרון', logo: null, captain: 'דוד כהן' },
      mvp: { name: 'דוד כהן', stats: '21.3 PPG' },
      isCurrent: false,
    },
    {
      year: '2021-2022',
      champion: { name: 'חולון', logo: null, captain: 'אבי לוי' },
      mvp: { name: 'אבי לוי', stats: '19.8 PPG' },
      isCurrent: false,
    },
  ],
  records: [
    { title: 'שיא נקודות למשחק', holder: 'ראשון "גפן" לציון', value: '99' },
    { title: 'שיא נקודות אישי', holder: 'יוסף פיסחה', value: '42' },
    { title: 'שיא ניצחונות רצופים', holder: 'גוטלמן השרון', value: '11' },
    { title: 'שיא ריבאונדים למשחק', holder: 'חולון', value: '54' },
    { title: 'שיא עזרות אישי', holder: 'דוד כהן', value: '17' },
  ],
};

export default function HallOfFamePreviewPage() {
  return (
    <div className="bg-slate-950 min-h-screen p-8 text-white font-body text-right" dir="rtl">

      {/* Preview label */}
      <div className="text-center mb-8 space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-500">
          תצוגה מקדימה בלבד · טרם הוגש לאישור
        </p>
        <p className="text-sm text-slate-400 font-body">Hall of Fame Preview</p>
      </div>

      <header className="mb-12 border-b border-orange-500/30 pb-6">
        <h1 className="font-heading font-black text-5xl mb-2 italic uppercase">היכל התהילה</h1>
        <p className="text-slate-400 text-lg font-body">מורשת הכדורסל של ליגת ליבי</p>
      </header>

      {/* קיר האלופות */}
      <section className="mb-16">
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-orange-500 inline-block"></span> אלופות הליגה
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {historyData.seasons.map((season) => (
            <div
              key={season.year}
              className="relative group overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 hover:border-orange-500 transition-all"
            >
              {/* Large year watermark */}
              <div className="absolute -left-4 -top-4 font-stats text-8xl text-white/5 group-hover:text-orange-500/10 transition-colors select-none">
                {season.year.split('-')[0]}
              </div>

              <p className="font-stats text-2xl text-orange-500">{season.year}</p>
              <h3 className="font-heading font-black text-3xl mb-4">{season.champion.name}</h3>

              <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-body">MVP של העונה</p>
                  <p className="font-heading font-bold">{season.mvp.name}</p>
                  <p className="font-stats text-lg text-orange-400">{season.mvp.stats}</p>
                </div>
                <div className="bg-orange-500 text-black px-3 py-1 rounded-full text-xs font-black font-heading">
                  CHAMPIONS
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* לוח שיאי כל הזמנים */}
      <section>
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-orange-500 inline-block"></span> שיאי כל הזמנים
        </h2>
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
              {historyData.records.map((record, i) => (
                <tr key={i} className="hover:bg-orange-500/5 transition-colors">
                  <td className="p-4 font-heading font-bold">{record.title}</td>
                  <td className="p-4 font-body text-slate-300">{record.holder}</td>
                  <td className="p-4 text-center font-stats text-3xl text-orange-500">{record.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-center text-xs text-slate-600 font-body mt-12">
        ⚠️ תצוגה מקדימה בלבד — לא הוגש לאישור עדיין
      </p>
    </div>
  );
}
