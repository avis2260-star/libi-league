export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { NORTH_TABLE, SOUTH_TABLE, CURRENT_ROUND, TOTAL_ROUNDS } from '@/lib/league-data';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';

const ROUND_DATES: Record<number, string> = {
  9: '28.02.26', 10: '14.03.26', 11: '21.03.26',
  12: '10.04.26', 13: '17.04.26', 14: '24.04.26',
};

type Standing = { rank: number; name: string; wins: number; losses: number; pts: number; division: string };
type GameRow  = { round: number; date: string; home_team: string; away_team: string; home_score: number; away_score: number; techni: boolean };

async function getLiveData() {
  try {
    const [{ data: standings }, { data: results }] = await Promise.all([
      supabaseAdmin.from('standings').select('rank,name,wins,losses,pts,division').order('rank'),
      supabaseAdmin.from('game_results').select('round,date,home_team,away_team,home_score,away_score,techni').order('round'),
    ]);

    if (!standings || standings.length === 0) throw new Error('no standings');

    const north = (standings as Standing[]).filter((s) => s.division === 'North');
    const south = (standings as Standing[]).filter((s) => s.division === 'South');
    const northLeader = north[0] ?? NORTH_TABLE[0];
    const southLeader = south[0] ?? SOUTH_TABLE[0];

    const games = (results ?? []) as GameRow[];
    const gamesPlayed  = games.filter((g) => !g.techni).length;
    const currentRound = games.length > 0 ? Math.max(...games.map((g) => g.round)) : CURRENT_ROUND;

    // Season records
    let highScore   = { score: 0, team: '', opp: '', round: 0, date: '' };
    let highCombined = { sh: 0, sa: 0, home: '', away: '', round: 0, date: '' };
    let biggestWin  = { sh: 0, sa: 0, home: '', away: '', round: 0, date: '' };
    let closestCount = 0;

    for (const g of games) {
      if (g.techni) continue;
      const combined = g.home_score + g.away_score;
      const margin   = Math.abs(g.home_score - g.away_score);

      if (g.home_score > highScore.score) highScore = { score: g.home_score, team: g.home_team, opp: g.away_team, round: g.round, date: g.date };
      if (g.away_score > highScore.score) highScore = { score: g.away_score, team: g.away_team, opp: g.home_team, round: g.round, date: g.date };
      if (combined > highCombined.sh + highCombined.sa) highCombined = { sh: g.home_score, sa: g.away_score, home: g.home_team, away: g.away_team, round: g.round, date: g.date };
      if (margin > Math.abs(biggestWin.sh - biggestWin.sa)) biggestWin = { sh: g.home_score, sa: g.away_score, home: g.home_team, away: g.away_team, round: g.round, date: g.date };
      if (margin <= 3) closestCount++;
    }

    return { northLeader, southLeader, gamesPlayed, currentRound, highScore, highCombined, biggestWin, closestCount };
  } catch {
    // fallback to static data
    return {
      northLeader: NORTH_TABLE[0],
      southLeader: SOUTH_TABLE[0],
      gamesPlayed: 56,
      currentRound: CURRENT_ROUND,
      highScore:    { score: 81, team: 'חולון', opp: 'כ.ע. בת-ים', round: 7, date: '07.02.26' },
      highCombined: { sh: 75, sa: 57, home: 'גוטלמן השרון', away: 'כ.ע. בת-ים', round: 4, date: '20.12.25' },
      biggestWin:   { sh: 75, sa: 57, home: 'גוטלמן השרון', away: 'כ.ע. בת-ים', round: 4, date: '20.12.25' },
      closestCount: 4,
    };
  }
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon, colorClass }: { value: string; label: string; icon: string; colorClass: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
      <div className={`absolute top-0 right-0 left-0 h-0.5 ${colorClass}`} />
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#5a7a9a]">{icon} {label}</p>
      <p className="text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function RecordCard({ icon, label, value, sub, detail, color }: { icon: string; label: string; value: string; sub: string; detail: string; color: string }) {
  return (
    <div className="relative rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5" style={{ borderRightWidth: 4, borderRightColor: color }}>
      <div className="mb-2 text-2xl">{icon}</div>
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-[#5a7a9a]">{label}</p>
      <p dir="ltr" className="text-3xl font-black leading-none text-right" style={{ color }}>{value}</p>
      <p className="mt-2 text-sm font-semibold text-[#c8d8e8]">{sub}</p>
      <p className="mt-1 text-xs text-[#5a7a9a]">{detail}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const {
    northLeader, southLeader,
    gamesPlayed, currentRound,
    highScore, highCombined, biggestWin, closestCount,
  } = await getLiveData();

  const biggestMargin = Math.abs(biggestWin.sh - biggestWin.sa);
  const biggestWinner = biggestWin.sh > biggestWin.sa ? biggestWin.home : biggestWin.away;
  const biggestLoser  = biggestWin.sh > biggestWin.sa ? biggestWin.away : biggestWin.home;

  const nextRound = currentRound + 1;
  const nextDate  = ROUND_DATES[nextRound] ?? '';
  const northUpcoming = LIBI_SCHEDULE.filter((g) => g.round === nextRound && g.division === 'North').map(g => ({ home: g.homeTeam, away: g.awayTeam }));
  const southUpcoming = LIBI_SCHEDULE.filter((g) => g.round === nextRound && g.division === 'South').map(g => ({ home: g.homeTeam, away: g.awayTeam }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">סקירה כללית</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">עונת 2025–2026 · עד מחזור {currentRound}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard value="15"                    label="קבוצות"        icon="🏀" colorClass="bg-gradient-to-l from-transparent to-orange-500" />
        <StatCard value={String(gamesPlayed)}   label="משחקי ליגה"    icon="📊" colorClass="bg-gradient-to-l from-transparent to-green-500"  />
        <StatCard value={String(currentRound)}  label="מחזורים עד כה" icon="📆" colorClass="bg-gradient-to-l from-transparent to-yellow-400" />
        <StatCard value={String(TOTAL_ROUNDS)}  label="מחזורי עונה"   icon="🗓" colorClass="bg-gradient-to-l from-transparent to-blue-500"   />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[
          { label: '🥇 מוביל צפון', team: northLeader },
          { label: '🥇 מוביל דרום', team: southLeader },
        ].map(({ label, team }) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.04]" style={{ borderTop: '3px solid #e0c97a' }}>
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

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
          <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">🏆</span>
          ביצועי שיא עונה
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RecordCard icon="🏀" label="שיא סלים במשחק" value={String(highScore.score)}
            sub={`${highScore.team} נגד ${highScore.opp}`}
            detail={`מחזור ${highScore.round} · ${highScore.date}`} color="#FF6B1A" />
          <RecordCard icon="🔢" label="שיא סלים משני הצדדים" value={String(highCombined.sh + highCombined.sa)}
            sub={`${highCombined.home} ${highCombined.sh} – ${highCombined.sa} ${highCombined.away}`}
            detail={`מחזור ${highCombined.round} · ${highCombined.date}`} color="#e0c97a" />
          <RecordCard icon="💥" label="הפרש גדול ביותר" value={`+${biggestMargin}`}
            sub={`${biggestWinner} נגד ${biggestLoser}`}
            detail={`מחזור ${biggestWin.round} · ${biggestWin.date}`} color="#4ec97a" />
          <RecordCard icon="📉" label="משחקים שהוכרעו ב-3 נקודות או פחות" value={String(closestCount)}
            sub="הפרש קטן" detail="כל עונה עד כה" color="#e05a5a" />
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-bold text-[#e0c97a]">📋 עובדות עונה</h2>
        </div>
        <div className="grid grid-cols-1 divide-y divide-white/[0.05] sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
          <div className="p-5">
            <p className="mb-1 text-xs text-[#5a7a9a]">מוביל סלים בדרום</p>
            <p className="text-base font-black text-green-400">{southLeader.name}</p>
            <p className="text-xs text-[#5a7a9a]">{southLeader.pts} נקודות</p>
          </div>
          <div className="p-5">
            <p className="mb-1 text-xs text-[#5a7a9a]">גמר הגביע</p>
            <p className="text-base font-black text-[#e0c97a]">21.03.26</p>
            <p className="text-xs text-[#5a7a9a]">ראשון &quot;גפן&quot; vs גוטלמן</p>
          </div>
          <div className="p-5">
            <p className="mb-1 text-xs text-[#5a7a9a]">מחזורים שנותרו</p>
            <p className="text-3xl font-black text-blue-400">{TOTAL_ROUNDS - currentRound}</p>
            <p className="text-xs text-[#5a7a9a]">מתוך {TOTAL_ROUNDS} מחזורים</p>
          </div>
        </div>
      </section>

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
