export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';

interface Series {
  series_number: number;
  team_a: string;
  team_a_label: string;
  team_b: string;
  team_b_label: string;
}

interface Game {
  series_number: number;
  game_number: number;
  home_score: number | null;
  away_score: number | null;
  played: boolean;
  game_date: string | null;
}

function homeForGame(series: Series, gameNum: number): string {
  // Game 1 & 3: team_a (higher seed) is home. Game 2: team_b is home.
  return gameNum === 2 ? series.team_b : series.team_a;
}
function awayForGame(series: Series, gameNum: number): string {
  return gameNum === 2 ? series.team_a : series.team_b;
}

function seriesScore(series: Series, games: Game[]): { winsA: number; winsB: number; winner: string | null } {
  let winsA = 0; let winsB = 0;
  for (const g of games.filter(g => g.series_number === series.series_number && g.played)) {
    const home = homeForGame(series, g.game_number);
    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
    if (homeWon && home === series.team_a) winsA++;
    else if (!homeWon && home !== series.team_a) winsA++;
    else winsB++;
  }
  const winner = winsA >= 2 ? series.team_a : winsB >= 2 ? series.team_b : null;
  return { winsA, winsB, winner };
}

function SeriesCard({ series, allGames }: { series: Series; allGames: Game[] }) {
  const seriesGames = allGames.filter(g => g.series_number === series.series_number);
  const { winsA, winsB, winner } = seriesScore(series, allGames);
  const hasTeams = series.team_a && series.team_b;

  return (
    <div className={`rounded-2xl border bg-white/[0.03] overflow-hidden ${
      winner ? 'border-yellow-400/30' : 'border-white/[0.07]'
    }`}>
      {/* Series header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <span className={`text-xs font-black uppercase tracking-widest ${winner ? 'text-yellow-400' : 'text-orange-400'}`}>
          {winner ? '🏆 הסתיים' : '🔥 פעיל'}
        </span>
        <span className="text-xs text-[#4a6a8a] font-semibold">סדרה {series.series_number}</span>
      </div>

      {/* Teams */}
      <div className="px-5 py-5 space-y-3">
        {/* Team A */}
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${
          winner === series.team_a ? 'bg-yellow-400/10 border border-yellow-400/30' :
          winsA > winsB ? 'bg-orange-500/10 border border-orange-500/20' :
          'bg-white/[0.03] border border-white/[0.05]'
        }`}>
          <div className={`text-2xl font-black tabular-nums ${winner === series.team_a ? 'text-yellow-400' : winsA > winsB ? 'text-orange-400' : 'text-white'}`}>
            {winsA}
          </div>
          <div className="text-right">
            <p className={`font-bold text-sm ${winner === series.team_a ? 'text-yellow-400' : 'text-white'}`}>
              {hasTeams ? series.team_a : '—'}
            </p>
            <p className="text-[11px] text-[#5a7a9a]">{series.team_a_label} · ביתי G1 + G3</p>
          </div>
        </div>

        <div className="text-center text-[11px] font-black text-[#3a5a7a] tracking-widest">VS</div>

        {/* Team B */}
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${
          winner === series.team_b ? 'bg-yellow-400/10 border border-yellow-400/30' :
          winsB > winsA ? 'bg-orange-500/10 border border-orange-500/20' :
          'bg-white/[0.03] border border-white/[0.05]'
        }`}>
          <div className={`text-2xl font-black tabular-nums ${winner === series.team_b ? 'text-yellow-400' : winsB > winsA ? 'text-orange-400' : 'text-white'}`}>
            {winsB}
          </div>
          <div className="text-right">
            <p className={`font-bold text-sm ${winner === series.team_b ? 'text-yellow-400' : 'text-white'}`}>
              {hasTeams ? series.team_b : '—'}
            </p>
            <p className="text-[11px] text-[#5a7a9a]">{series.team_b_label} · ביתי G2</p>
          </div>
        </div>
      </div>

      {/* Games */}
      <div className="px-5 pb-5 space-y-2">
        {[1, 2, 3].map((gNum) => {
          const g = seriesGames.find(g => g.game_number === gNum);
          const home = hasTeams ? homeForGame(series, gNum) : `ביתי`;
          const away = hasTeams ? awayForGame(series, gNum) : `אורח`;
          const isG3 = gNum === 3;
          const seriesOver = winsA >= 2 || winsB >= 2;
          const skip = isG3 && seriesOver;
          if (skip) return null;

          return (
            <div key={gNum} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
              g?.played ? 'bg-white/[0.04]' : 'bg-white/[0.02] border border-dashed border-white/[0.06]'
            }`}>
              <span className="shrink-0 font-black text-[#3a5a7a]">G{gNum}</span>
              {g?.played && g.home_score !== null && g.away_score !== null ? (
                <>
                  <span className="flex-1 text-right text-white font-semibold truncate">{home}</span>
                  <span className="font-black text-white tabular-nums">{g.home_score}</span>
                  <span className="text-[#3a5a7a]">–</span>
                  <span className="font-black text-white tabular-nums">{g.away_score}</span>
                  <span className="flex-1 text-left text-white font-semibold truncate">{away}</span>
                  <span className="text-green-400">✓</span>
                </>
              ) : (
                <>
                  <span className="flex-1 text-right text-[#5a7a9a] truncate">{home}</span>
                  <span className="border border-[#1e3a5f] rounded px-2 py-0.5 text-[#3a5a7a]">VS</span>
                  <span className="flex-1 text-left text-[#5a7a9a] truncate">{away}</span>
                  {isG3 && <span className="text-[10px] text-[#3a5a7a]">(אם נדרש)</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function PlayoffPage() {
  const [{ data: seriesData }, { data: gamesData }] = await Promise.all([
    supabaseAdmin.from('playoff_series').select('*').order('series_number'),
    supabaseAdmin.from('playoff_games').select('*').order('series_number').order('game_number'),
  ]);

  const series: Series[] = (seriesData ?? []) as Series[];
  const games: Game[]   = (gamesData  ?? []) as Game[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-right">
        <h1 className="text-3xl font-black text-white">פלייאוף הליגה</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">
          מיטב מ-3 · הקבוצה הגבוהה יותר מארחת משחק 1 ומשחק 3
        </p>
      </div>

      {series.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] py-20 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-[#5a7a9a]">פלייאוף טרם הוגדר</p>
          <p className="text-xs text-[#3a5a7a] mt-1">נא לחכות לפתיחת שלב הפלייאוף</p>
        </div>
      ) : (
        <>
          {/* Bracket rule note */}
          <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628]/60 px-4 py-3 text-xs text-[#5a7a9a] text-right">
            <span className="font-bold text-[#8aaac8]">כלל הבית:</span> הקבוצה המדורגת גבוה יותר מארחת את משחק 1 ומשחק 3.
            הקבוצה המדורגת נמוך יותר מארחת את משחק 2.
          </div>

          {/* Series cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {series.map((s) => (
              <SeriesCard key={s.series_number} series={s} allGames={games} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
