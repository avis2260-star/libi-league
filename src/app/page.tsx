export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NORTH_TABLE, SOUTH_TABLE, CURRENT_ROUND, TOTAL_ROUNDS } from '@/lib/league-data';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import { getTeams } from '@/lib/supabase';
import ScoreboardStrip from '@/components/ScoreboardStrip';

const ROUND_DATES: Record<number, string> = {
  1: '01.11.25', 2: '08.11.25', 3: '29.11.25', 4:  '20.12.25',
  5: '10.01.26', 6: '17.01.26', 7: '07.02.26', 8:  '21.02.26',
  9: '28.02.26', 10: '14.03.26', 11: '21.03.26',
  12: '10.04.26', 13: '17.04.26', 14: '24.04.26',
};

type Standing = { rank: number; name: string; wins: number; losses: number; pts: number; division: string };
type GameRow  = { round: number; date: string; home_team: string; away_team: string; home_score: number; away_score: number; techni: boolean };

type ActiveAnnouncement = { id: string; message: string; type: string; bg_color: string };

const BG_COLOR_CLASSES: Record<string, string> = {
  orange: 'bg-orange-500',
  red: 'bg-red-600',
  blue: 'bg-blue-600',
  green: 'bg-green-600',
};

async function getActiveAnnouncements(): Promise<ActiveAnnouncement[]> {
  try {
    const { data } = await supabaseAdmin
      .from('announcements')
      .select('id,message,type,bg_color')
      .eq('active', true)
      .order('created_at', { ascending: false });
    return (data ?? []) as ActiveAnnouncement[];
  } catch {
    return [];
  }
}

type TopPlayer = {
  id: string;
  name: string;
  photo_url: string | null;
  jersey_number: number | null;
  team_name: string | null;
  points: number;
  three_pointers: number;
  fouls: number;
};

async function getTopScorers(): Promise<TopPlayer[]> {
  try {
    const { data } = await supabaseAdmin
      .from('players')
      .select('id, name, photo_url, jersey_number, points, three_pointers, fouls, team:teams(name)')
      .eq('is_active', true)
      .gt('points', 0)
      .order('points', { ascending: false })
      .limit(5);

    return ((data ?? []) as unknown as {
      id: string; name: string; photo_url: string | null; jersey_number: number | null;
      points: number; three_pointers: number; fouls: number;
      team: { name: string } | null;
    }[]).map(p => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      jersey_number: p.jersey_number,
      team_name: p.team?.name ?? null,
      points: p.points,
      three_pointers: p.three_pointers,
      fouls: p.fouls,
    }));
  } catch {
    return [];
  }
}

async function getTickerSpeed(): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('value')
      .eq('key', 'ticker_speed')
      .maybeSingle();
    return data?.value ? parseInt(data.value, 10) : 25;
  } catch {
    return 25;
  }
}

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
  const [liveData, activeAnnouncements, teams, tickerSpeed, topScorers] = await Promise.all([
    getLiveData(),
    getActiveAnnouncements(),
    getTeams(),
    getTickerSpeed(),
    getTopScorers(),
  ]);

  // Build logo lookup (normalize quotes/spaces like teams page does)
  function norm(s: string) { return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim(); }
  const logoMap: Record<string, string | null> = {};
  for (const t of teams) logoMap[norm(t.name)] = t.logo_url;

  const {
    northLeader, southLeader,
    gamesPlayed, currentRound,
    highScore, highCombined, biggestWin, closestCount,
  } = liveData;

  const biggestMargin = Math.abs(biggestWin.sh - biggestWin.sa);
  const biggestWinner = biggestWin.sh > biggestWin.sa ? biggestWin.home : biggestWin.away;
  const biggestLoser  = biggestWin.sh > biggestWin.sa ? biggestWin.away : biggestWin.home;

  const nextRound = currentRound + 1;
  const nextDate  = ROUND_DATES[nextRound] ?? '';
  const northUpcoming = LIBI_SCHEDULE.filter((g) => g.round === nextRound && g.division === 'North').map(g => ({ home: g.homeTeam, away: g.awayTeam }));
  const southUpcoming = LIBI_SCHEDULE.filter((g) => g.round === nextRound && g.division === 'South').map(g => ({ home: g.homeTeam, away: g.awayTeam }));

  // Scoreboard strip — all games for next round combined
  const allNextGames: { home: string; away: string; div: 'North' | 'South'; homeLogo: string | null; awayLogo: string | null }[] = [
    ...southUpcoming.map(g => ({ ...g, div: 'South' as const, homeLogo: logoMap[norm(g.home)] ?? null, awayLogo: logoMap[norm(g.away)] ?? null })),
    ...northUpcoming.map(g => ({ ...g, div: 'North' as const, homeLogo: logoMap[norm(g.home)] ?? null, awayLogo: logoMap[norm(g.away)] ?? null })),
  ];
  const nextDateRaw = LIBI_SCHEDULE.find(g => g.round === nextRound)?.date ?? '';
  const heDay = nextDateRaw
    ? ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][new Date(nextDateRaw).getDay()]
    : '';

  const banners   = activeAnnouncements.filter((a) => a.type === 'banner');
  const tickers   = activeAnnouncements.filter((a) => a.type === 'ticker');

  return (
    <div className="space-y-8">
      {/* Banners */}
      {banners.map((ann) => (
        <div
          key={ann.id}
          className={`w-full px-4 py-3 text-center text-sm font-bold text-white ${BG_COLOR_CLASSES[ann.bg_color] ?? 'bg-orange-500'}`}
        >
          {ann.message}
        </div>
      ))}

      {/* Tickers */}
      {tickers.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-[#0d1a28] border border-white/[0.07] py-2">
          {/* Two identical groups — pr-16 on each ensures seam gap == inter-item gap */}
          <div
            className="flex w-max"
            style={{ animation: `marquee ${tickerSpeed}s linear infinite` }}
          >
            {[0, 1].map(copy => (
              <div key={copy} className="flex items-center gap-16 pr-16">
                {tickers.map(ann => (
                  <span key={ann.id} className="inline-flex items-center gap-2 text-sm font-medium text-[#e8edf5] whitespace-nowrap">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${BG_COLOR_CLASSES[ann.bg_color] ?? 'bg-orange-500'}`} />
                    {ann.message}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NBA-style Scoreboard Strip ── */}
      {allNextGames.length > 0 && nextRound <= TOTAL_ROUNDS && (
        <ScoreboardStrip
          games={allNextGames}
          nextRound={nextRound}
          nextDate={nextDate}
          heDay={heDay}
        />
      )}

      <div>
        <h1 className="text-3xl font-black text-white">סקירה כללית</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">עונת 2025–2026 · עד מחזור {currentRound}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <a href="/teams" className="block hover:opacity-80 transition-opacity">
          <StatCard value="15"                    label="קבוצות"        icon="🏀" colorClass="bg-gradient-to-l from-transparent to-orange-500" />
        </a>
        <a href="/games" className="block hover:opacity-80 transition-opacity">
          <StatCard value={String(gamesPlayed)}   label="משחקי ליגה"    icon="📊" colorClass="bg-gradient-to-l from-transparent to-green-500"  />
        </a>
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
              <Link href={`/team/${encodeURIComponent(team.name)}`} className="text-xl font-black text-[#e0c97a] hover:underline underline-offset-2 transition-colors">{team.name}</Link>
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

      {/* ── Top Scorers ────────────────────────────────────────────────── */}
      {topScorers.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">🏅</span>
            קלעי הליגה
          </h2>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] sm:grid-cols-[2.5rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-2 border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-widest text-[#3a5a7a]">
              <span>#</span>
              <span>שחקן</span>
              <span className="text-center">נק׳</span>
              <span className="text-center">3נק׳</span>
              <span className="text-center">פאולים</span>
            </div>
            {topScorers.map((p, i) => {
              const MEDAL = ['🥇', '🥈', '🥉'];
              const medal = MEDAL[i] ?? null;
              const rankColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
              const maxPts = topScorers[0].points || 1;
              return (
                <a
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] sm:grid-cols-[2.5rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-3 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Rank */}
                  <span className={`text-sm font-black text-center ${rankColors[i] ?? 'text-[#5a7a9a]'}`}>
                    {medal ?? <span className="text-xs text-[#3a5a7a]">{i + 1}</span>}
                  </span>

                  {/* Player info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-black text-[#4a6a8a]">
                          {p.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white group-hover:text-orange-300 transition-colors">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.jersey_number !== null && (
                          <span className="text-[10px] font-bold text-orange-400/70">#{p.jersey_number}</span>
                        )}
                        {p.team_name && (
                          <span className="truncate text-[10px] text-[#3a5a7a]">{p.team_name}</span>
                        )}
                      </div>
                      {/* Points bar */}
                      <div className="mt-1 h-0.5 w-full rounded-full bg-white/[0.06]">
                        <div
                          className="h-0.5 rounded-full bg-gradient-to-l from-orange-500 to-orange-700 transition-all"
                          style={{ width: `${Math.round((p.points / maxPts) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <span className="text-center text-base font-black text-orange-400">{p.points}</span>
                  <span className="text-center text-sm font-semibold text-sky-400">{p.three_pointers}</span>
                  <span className="text-center text-sm text-rose-400">{p.fouls}</span>
                </a>
              );
            })}
          </div>
          <div className="mt-2 text-right">
            <a href="/players" className="text-xs text-[#5a7a9a] hover:text-orange-400 transition-colors">
              כל השחקנים ←
            </a>
          </div>
        </section>
      )}

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

    </div>
  );
}
