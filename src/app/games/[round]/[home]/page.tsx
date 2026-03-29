export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import { getTeams } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ROUND_DATES: Record<number, string> = {
  1: '01.11.25', 2: '08.11.25', 3: '29.11.25', 4: '20.12.25',
  5: '10.01.26', 6: '17.01.26', 7: '07.02.26', 8: '21.02.26',
  9: '28.02.26', 10: '14.03.26', 11: '21.03.26',
  12: '10.04.26', 13: '17.04.26', 14: '24.04.26',
};

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function normalize(s: string) {
  return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim();
}

type StandingRow = {
  name: string; rank: number; wins: number; losses: number;
  diff: number; pts: number; games: number; pf: number; pa: number;
};

function findStat(standings: StandingRow[], name: string): StandingRow | undefined {
  const normName = normalize(name);
  return standings.find(s =>
    s.name === name || normalize(s.name) === normName ||
    normName.includes(normalize(s.name)) || normalize(s.name).includes(normName)
  );
}

export default async function GamePreviewPage({
  params,
}: {
  params: Promise<{ round: string; home: string }>;
}) {
  const { round: roundStr, home: homeEncoded } = await params;
  const round = parseInt(roundStr, 10);
  const homeTeam = decodeURIComponent(homeEncoded);

  const game = LIBI_SCHEDULE.find(
    (g) => g.round === round && normalize(g.homeTeam) === normalize(homeTeam)
  );
  if (!game) notFound();

  // Fetch logos + standings + Supabase game details in parallel
  const [teams, standingsRes, dbGamesRes] = await Promise.all([
    getTeams(),
    supabaseAdmin.from('standings').select('name,rank,wins,losses,diff,pts,games,pf,pa').order('rank'),
    supabaseAdmin
      .from('games')
      .select('game_time,location,home_team:teams!games_home_team_id_fkey(name)')
      .eq('game_date', game.date),
  ]);

  // Logo map
  const logoMap: Record<string, string | null> = {};
  for (const t of teams) logoMap[normalize(t.name)] = t.logo_url;
  const homeLogo = logoMap[normalize(game.homeTeam)] ?? null;
  const awayLogo = logoMap[normalize(game.awayTeam)] ?? null;

  // Standings
  const standings = (standingsRes.data ?? []) as StandingRow[];
  const homeStats = findStat(standings, game.homeTeam);
  const awayStats = findStat(standings, game.awayTeam);

  // Time + location from Supabase games table
  let gameTime: string | null = null;
  let gameLocation: string | null = null;
  const dbGames = (dbGamesRes.data ?? []) as { game_time: string; location: string; home_team: { name: string } }[];
  const dbMatch = dbGames.find(g => normalize((g.home_team as { name: string })?.name ?? '') === normalize(game.homeTeam));
  if (dbMatch) {
    gameTime     = dbMatch.game_time   || null;
    gameLocation = dbMatch.location    || null;
  }

  const dateStr    = ROUND_DATES[round] ?? game.date;
  const dayOfWeek  = game.date ? HE_DAYS[new Date(game.date).getDay()] : '';
  const divLabel   = game.division === 'North' ? 'מחוז צפון' : 'מחוז דרום';
  const divColor   = game.division === 'North' ? 'text-blue-400' : 'text-orange-400';
  const divBg      = game.division === 'North' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-orange-500/10 border-orange-500/30';

  const rankColor = (rank?: number) =>
    rank === 1 ? '#e0c97a' : rank === 2 ? '#b0b8c8' : rank === 3 ? '#c87d3a' : '#8aaac8';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#5a7a9a] hover:text-orange-400 transition-colors">
        ← חזרה לדף הבית
      </Link>

      {/* Badges */}
      <div className="flex items-center gap-3">
        <span className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-sm font-bold text-orange-400">
          מחזור {round}
        </span>
        <span className={`rounded-xl border px-3 py-1 text-sm font-bold ${divColor} ${divBg}`}>
          {divLabel}
        </span>
      </div>

      {/* Main matchup card */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-[#5a7a9a]">
            {dayOfWeek && <span className="font-bold text-[#8aaac8]">יום {dayOfWeek} · </span>}
            {dateStr}
          </p>
          <span className="rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-0.5 text-xs font-bold text-orange-400">
            קרוב
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-10 sm:py-12">
          {/* Home team */}
          <div className="flex flex-col items-center gap-3 flex-1">
            {homeStats?.rank && (
              <span className="text-xs font-black" style={{ color: rankColor(homeStats.rank) }}>
                #{homeStats.rank}
              </span>
            )}
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-white/10 bg-white/[0.05] overflow-hidden flex items-center justify-center shadow-lg">
              {homeLogo
                ? <img src={homeLogo} alt={game.homeTeam} className="h-full w-full object-cover" />
                : <span className="text-3xl font-black text-[#4a6a8a]">{[...game.homeTeam].find(c => c.trim()) ?? '?'}</span>
              }
            </div>
            <div className="text-center">
              <p className="text-base font-black text-white leading-tight">{game.homeTeam}</p>
              <p className="mt-0.5 text-xs text-[#5a7a9a]">קבוצת בית</p>
            </div>
          </div>

          <span className="text-2xl font-black text-[#2a4a6a] shrink-0">VS</span>

          {/* Away team */}
          <div className="flex flex-col items-center gap-3 flex-1">
            {awayStats?.rank && (
              <span className="text-xs font-black" style={{ color: rankColor(awayStats.rank) }}>
                #{awayStats.rank}
              </span>
            )}
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-white/10 bg-white/[0.05] overflow-hidden flex items-center justify-center shadow-lg">
              {awayLogo
                ? <img src={awayLogo} alt={game.awayTeam} className="h-full w-full object-cover" />
                : <span className="text-3xl font-black text-[#4a6a8a]">{[...game.awayTeam].find(c => c.trim()) ?? '?'}</span>
              }
            </div>
            <div className="text-center">
              <p className="text-base font-black text-white leading-tight">{game.awayTeam}</p>
              <p className="mt-0.5 text-xs text-[#5a7a9a]">קבוצת חוץ</p>
            </div>
          </div>
        </div>
      </div>

      {/* Game info row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#5a7a9a]">📅 תאריך</p>
          <p className="text-lg font-black text-white">{dateStr}</p>
          {dayOfWeek && <p className="mt-0.5 text-xs text-[#8aaac8]">יום {dayOfWeek}</p>}
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#5a7a9a]">⏰ שעה</p>
          {gameTime
            ? <p className="text-lg font-black text-white">{gameTime.slice(0, 5)}</p>
            : <p className="text-lg font-black text-[#3a5a7a]">TBD</p>
          }
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#5a7a9a]">📍 מיקום</p>
          {gameLocation
            ? <p className="text-lg font-black text-white">{gameLocation}</p>
            : <><p className="text-lg font-black text-[#3a5a7a]">יתווסף בקרוב</p><p className="mt-0.5 text-xs text-[#3a5a7a]">טרם נקבע</p></>
          }
        </div>
      </div>

      {/* Stats comparison */}
      {(homeStats || awayStats) && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-bold text-white">📊 השוואת קבוצות</h2>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-3 border-b border-white/[0.05] px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[#4a6a8a]">
            <span className="text-right">{game.homeTeam}</span>
            <span className="text-center">סטט</span>
            <span className="text-left">{game.awayTeam}</span>
          </div>

          {[
            { label: 'מ׳ (ניצחונות)', home: homeStats ? `${homeStats.wins}נ / ${homeStats.losses}ה` : '—', away: awayStats ? `${awayStats.wins}נ / ${awayStats.losses}ה` : '—' },
            { label: 'נקודות ליגה',   home: homeStats?.pts  != null ? String(homeStats.pts)  : '—', away: awayStats?.pts  != null ? String(awayStats.pts)  : '—' },
            { label: 'הפרש נקודות',  home: homeStats?.diff != null ? (homeStats.diff > 0 ? `+${homeStats.diff}` : String(homeStats.diff)) : '—', away: awayStats?.diff != null ? (awayStats.diff > 0 ? `+${awayStats.diff}` : String(awayStats.diff)) : '—' },
            { label: 'ממוצע נק׳ למשחק', home: homeStats?.games ? (homeStats.pf / homeStats.games).toFixed(1) : '—', away: awayStats?.games ? (awayStats.pf / awayStats.games).toFixed(1) : '—' },
            { label: 'ממוצע ספיגה',  home: homeStats?.games ? (homeStats.pa / homeStats.games).toFixed(1) : '—', away: awayStats?.games ? (awayStats.pa / awayStats.games).toFixed(1) : '—' },
          ].map(({ label, home, away }) => (
            <div key={label} className="grid grid-cols-3 border-b border-white/[0.04] px-5 py-3 text-sm last:border-0">
              <span className="font-bold text-[#e8edf5] text-right">{home}</span>
              <span className="text-center text-[10px] text-[#5a7a9a] self-center">{label}</span>
              <span className="font-semibold text-[#8aaac8] text-left">{away}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
