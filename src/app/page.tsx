import {
  NORTH_TABLE, SOUTH_TABLE, UPCOMING_GAMES,
  SEASON_RECORDS, CURRENT_ROUND, TOTAL_ROUNDS, TOTAL_TEAMS, GAMES_PLAYED,
} from '@/lib/league-data';

// ── Tiny shared primitives ────────────────────────────────────────────────────

function StatCard({ value, label, icon, colorClass }: {
  value: string; label: string; icon: string; colorClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
      <div className={`absolute top-0 right-0 left-0 h-0.5 ${colorClass}`} />
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#5a7a9a]">
        {icon} {label}
      </p>
      <p className="text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function RecordCard({ icon, label, value, sub, detail, color }: {
  icon: string; label: string; value: string;
  sub: string; detail: string; color: string;
}) {
  return (
    <div
      className="relative rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5"
      style={{ borderRightWidth: 4, borderRightColor: color }}
    >
      <div className="mb-2 text-2xl">{icon}</div>
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-[#5a7a9a]">{label}</p>
      <p dir="ltr" className="text-3xl font-black leading-none text-right" style={{ color }}>{value}</p>
      <p className="mt-2 text-sm font-semibold text-[#c8d8e8]">{sub}</p>
      <p className="mt-1 text-xs text-[#5a7a9a]">{detail}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const northLeader = NORTH_TABLE[0];
  const southLeader = SOUTH_TABLE[0];

  const { highScore, highCombined, biggestWin, closestCount } = SEASON_RECORDS;
  const biggestMargin = Math.abs(biggestWin.sh - biggestWin.sa);
  const biggestWinner = biggestWin.sh > biggestWin.sa ? biggestWin.home : biggestWin.away;
  const biggestLoser  = biggestWin.sh > biggestWin.sa ? biggestWin.away : biggestWin.home;

  const northUpcoming = UPCOMING_GAMES.filter((g) => g.division === 'North');
  const southUpcoming = UPCOMING_GAMES.filter((g) => g.division === 'South');
  const nextRound = UPCOMING_GAMES[0]?.round ?? CURRENT_ROUND + 1;
  const nextDate  = UPCOMING_GAMES[0]?.date  ?? '';

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-3xl font-black text-white">סקירה כללית</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">עונת 2025–2026 · עד מחזור {CURRENT_ROUND}</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard value={String(TOTAL_TEAMS)}   label="קבוצות"        icon="🏀" colorClass="bg-gradient-to-l from-transparent to-orange-500" />
        <StatCard value={String(GAMES_PLAYED)}  label="משחקי ליגה"    icon="📊" colorClass="bg-gradient-to-l from-transparent to-green-500"  />
        <StatCard value={String(CURRENT_ROUND)} label="מחזורים עד כה" icon="📆" colorClass="bg-gradient-to-l from-transparent to-yellow-400" />
        <StatCard value={String(TOTAL_ROUNDS)}  label="מחזורי עונה"   icon="🗓" colorClass="bg-gradient-to-l from-transparent to-blue-500"   />
      </div>

      {/* District leaders */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[
          { label: '🥇 מוביל צפון', team: northLeader },
          { label: '🥇 מוביל דרום', team: southLeader },
        ].map(({ label, team }) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.04]"
               style={{ borderTop: '3px solid #e0c97a' }}>
            <div className="p-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#5a7a9a]">{label}</p>
              <p className="text-xl font-black text-[#e0c97a]">{team.name}</p>
              <p className="mt-1 text-sm text-[#8aaac8]">
                {team.wins}נ / {team.losses}ה ·{' '}
                <span className="font-bold text-orange-400">{team.pts} נקודות</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Season performance records */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
          <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">🏆</span>
          ביצועי שיא עונה
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RecordCard
            icon="🏀" label="שיא סלים במשחק" value={String(highScore.score)}
            sub={`${highScore.team} נגד ${highScore.opp}`}
            detail={`מחזור ${highScore.round} · ${highScore.date}`}
            color="#FF6B1A"
          />
          <RecordCard
            icon="🔢" label="שיא סלים משני הצדדים" value={String(highCombined.sh + highCombined.sa)}
            sub={`${highCombined.home} ${highCombined.sh} – ${highCombined.sa} ${highCombined.away}`}
            detail={`מחזור ${highCombined.round} · ${highCombined.date}`}
            color="#e0c97a"
          />
          <RecordCard
            icon="💥" label="הפרש גדול ביותר" value={`+${biggestMargin}`}
            sub={`${biggestWinner} נגד ${biggestLoser}`}
            detail={`מחזור ${biggestWin.round} · ${biggestWin.date}`}
            color="#4ec97a"
          />
          <RecordCard
            icon="📉" label="משחקים שהוכרעו בסל אחד" value={String(closestCount)}
            sub="הפרש של נקודה אחת בלבד"
            detail="כל עונה עד כה"
            color="#e05a5a"
          />
        </div>
      </section>

      {/* Season facts */}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-bold text-[#e0c97a]">📋 עובדות עונה</h2>
        </div>
        <div className="grid grid-cols-1 divide-y divide-white/[0.05] sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
          <div className="p-5">
            <p className="mb-1 text-xs text-[#5a7a9a]">קבוצה עם הכי הרבה סלים</p>
            <p className="text-base font-black text-green-400">ראשון &quot;גפן&quot; לציון</p>
            <p className="text-xs text-[#5a7a9a]">589 סלים · ממוצע 73.6</p>
          </div>
          <div className="p-5">
            <p className="mb-1 text-xs text-[#5a7a9a]">גמר הגביע</p>
            <p className="text-base font-black text-[#e0c97a]">21.03.26</p>
            <p className="text-xs text-[#5a7a9a]">ראשון &quot;גפן&quot; vs גוטלמן</p>
          </div>
          <div className="p-5">
            <p className="mb-1 text-xs text-[#5a7a9a]">מחזורים שנותרו</p>
            <p className="text-3xl font-black text-blue-400">{TOTAL_ROUNDS - CURRENT_ROUND}</p>
            <p className="text-xs text-[#5a7a9a]">מתוך {TOTAL_ROUNDS} מחזורים</p>
          </div>
        </div>
      </section>

      {/* Next round preview */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-lg font-black text-white">
          <span className="rounded-xl border border-orange-500/30 bg-orange-500/15 px-3 py-1 text-sm font-bold text-orange-400">
            מחזור {nextRound}
          </span>
          המחזור הבא · {nextDate}
        </h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5">
            <div className="border-b border-white/[0.06] px-5 py-3">
              <h3 className="text-sm font-bold text-blue-400">🏀 מחוז צפון</h3>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {northUpcoming.map((g, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <span className="font-semibold text-white">{g.home}</span>
                  <span className="mx-auto text-xs font-bold text-[#4a6a8a]">VS</span>
                  <span className="font-semibold text-white">{g.away}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5">
            <div className="border-b border-white/[0.06] px-5 py-3">
              <h3 className="text-sm font-bold text-orange-400">🏀 מחוז דרום</h3>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {southUpcoming.map((g, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <span className="font-semibold text-white">{g.home}</span>
                  <span className="mx-auto text-xs font-bold text-[#4a6a8a]">VS</span>
                  <span className="font-semibold text-white">{g.away}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
