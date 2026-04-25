'use client';

// ── Preview page — NOT pushed, awaiting approval ─────────────────────────────
// Fonts: Teko (stats), Heebo (headings), Assistant (body)

export default function DesignPreviewPage() {
  const teams = [
    { id: 1, name: 'ראשון "גפן" לציון', played: 8, wins: 7, losses: 1, pointsFor: 542, pointsAgainst: 461 },
    { id: 2, name: 'גוטלמן השרון',       played: 8, wins: 6, losses: 2, pointsFor: 511, pointsAgainst: 478 },
    { id: 3, name: 'חולון',              played: 8, wins: 5, losses: 3, pointsFor: 498, pointsAgainst: 480 },
    { id: 4, name: 'ידרסל חדרה',         played: 8, wins: 4, losses: 4, pointsFor: 476, pointsAgainst: 489 },
    { id: 5, name: 'בני נתניה',          played: 8, wins: 3, losses: 5, pointsFor: 455, pointsAgainst: 501 },
  ];

  const player = {
    name: 'יוסף פיסחה',
    team: 'ראשון לציון',
    number: 34,
    image: 'https://ui-avatars.com/api/?name=יוסף+פיסחה&background=FF6B00&color=fff&size=128',
    ppg: 18.4,
    rpg: 6.2,
    eff: 22,
  };

  return (
    <>
      {/* Load fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Teko:wght@400;600;700&family=Heebo:wght@400;700;800;900&family=Assistant:wght@400;600;700&display=swap');
        .font-stats   { font-family: 'Teko', sans-serif; }
        .font-heading { font-family: 'Heebo', sans-serif; }
        .font-body    { font-family: 'Assistant', sans-serif; }
        .bg-brand-dark   { background-color: #0F172A; }
        .bg-brand-accent { background-color: #1E293B; }
        .text-brand-orange { color: #FF6B00; }
        .border-brand-orange { border-color: #FF6B00; }
        .border-brand-accent { border-color: #1E293B; }
        .from-brand-accent { --tw-gradient-from: #1E293B; }
        .to-brand-dark     { --tw-gradient-to: #0F172A; }
      `}</style>

      <div className="min-h-screen bg-[#0F172A] text-white py-12 px-4" dir="rtl">
        <div className="max-w-3xl mx-auto space-y-14">

          {/* Label */}
          <div className="text-center space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500">תצוגה מקדימה בלבד · טרם הוגש לאישור</p>
            <h1 className="text-2xl font-black text-white font-heading">Design Preview</h1>
            <p className="text-sm text-slate-400 font-body">Teko · Heebo · Assistant + Brand Colors</p>
          </div>

          {/* ── StandingsTable ── */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-slate-400 uppercase tracking-widest font-body">
              טבלת דירוג — StandingsTable
            </h2>
            <div className="overflow-x-auto rounded-lg border border-[#1E293B]">
              <table className="w-full text-right font-body">
                <thead className="bg-[#0F172A] text-[#FF6B00] uppercase font-heading font-bold text-sm tracking-widest">
                  <tr>
                    <th className="p-4">#</th>
                    <th className="p-4 text-right">קבוצה</th>
                    <th className="p-4 text-center">משחקים</th>
                    <th className="p-4 text-center font-black">נ&apos;</th>
                    <th className="p-4 text-center">ה&apos;</th>
                    <th className="p-4 text-center">סלים</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B] bg-slate-900/50">
                  {teams.map((team, index) => (
                    <tr key={team.id} className="hover:bg-[#1E293B]/50 transition-colors">
                      <td className="p-4 font-stats text-xl text-slate-400">{index + 1}</td>
                      <td className="p-4 font-heading font-bold text-lg text-white">{team.name}</td>
                      <td className="p-4 text-center font-stats text-xl text-white">{team.played}</td>
                      <td className="p-4 text-center font-stats text-2xl text-green-400">{team.wins}</td>
                      <td className="p-4 text-center font-stats text-2xl text-red-400">{team.losses}</td>
                      <td className="p-4 text-center font-stats text-lg tracking-tighter text-slate-300">
                        {team.pointsFor}-{team.pointsAgainst}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── PlayerCard ── */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-slate-400 uppercase tracking-widest font-body">
              כרטיס שחקן — PlayerCard
            </h2>
            <div className="flex justify-center">
              <div className="max-w-md w-full bg-gradient-to-b from-[#1E293B] to-[#0F172A] p-6 rounded-2xl border-t-4 border-[#FF6B00] shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-20 h-20 rounded-full bg-slate-700 overflow-hidden border-2 border-[#FF6B00] shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={player.image} alt={player.name} className="object-cover w-full h-full" />
                  </div>
                  <div>
                    <h2 className="font-heading font-black text-3xl text-white leading-none">{player.name}</h2>
                    <p className="font-body text-[#FF6B00] font-bold uppercase tracking-widest text-sm">
                      {player.team} | #{player.number}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-slate-700 pt-6">
                  <div className="text-center">
                    <p className="font-body text-xs text-slate-400 uppercase">נק&apos; למשחק</p>
                    <p className="font-stats text-4xl text-white font-bold">{player.ppg}</p>
                  </div>
                  <div className="text-center border-x border-slate-700">
                    <p className="font-body text-xs text-slate-400 uppercase">ריבאונד</p>
                    <p className="font-stats text-4xl text-white font-bold">{player.rpg}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-body text-xs text-slate-400 uppercase">מדד יעילות</p>
                    <p className="font-stats text-4xl text-[#FF6B00] font-bold">{player.eff}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Font showcase */}
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-base font-bold text-slate-400 uppercase tracking-widest font-body">פלטת גופנים</h2>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Teko — font-stats (מספרים ונתונים)</p>
                <p className="font-stats text-4xl text-white">54 : 67 · מחזור 9 · 24.04.26</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Heebo — font-heading (כותרות ושמות)</p>
                <p className="font-heading font-black text-2xl text-white">ראשון &quot;גפן&quot; לציון נגד גוטלמן השרון</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Assistant — font-body (טקסט רגיל)</p>
                <p className="font-body text-base text-slate-300">ליגה קהילתית לכדורסל המאגדת קבוצות מרחבי הארץ, עם שני מחוזות — צפון ודרום — ומערכת גביע ופלייאוף מרגשת.</p>
              </div>
            </div>
          </section>

          {/* Color palette */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-slate-400 uppercase tracking-widest font-body">פלטת צבעים</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { color: '#FF6B00', label: 'brand.orange', text: 'text-white' },
                { color: '#0F172A', label: 'brand.dark',   text: 'text-white', border: true },
                { color: '#1E293B', label: 'brand.accent', text: 'text-white' },
              ].map(({ color, label, text, border }) => (
                <div key={label} className={`rounded-xl p-4 text-center ${border ? 'border border-slate-700' : ''}`}
                  style={{ backgroundColor: color }}>
                  <div className={`text-xs font-bold font-body ${text}`}>{label}</div>
                  <div className={`text-[10px] font-body ${text} opacity-60 mt-0.5`}>{color}</div>
                </div>
              ))}
            </div>
          </section>

          <p className="text-center text-xs text-slate-600 font-body">
            ⚠️ תצוגה מקדימה בלבד — לא הוגש לאישור עדיין
          </p>
        </div>
      </div>
    </>
  );
}
