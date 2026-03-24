export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';

const ALL_ROUND_DATES: Record<number, string> = {
  1: '01.11.25', 2: '08.11.25', 3: '29.11.25', 4: '20.12.25',
  5: '10.01.26', 6: '17.01.26', 7: '07.02.26', 8: '21.02.26',
  9: '28.02.26', 10: '14.03.26', 11: '21.03.26',
  12: '10.04.26', 13: '17.04.26', 14: '24.04.26',
};

type PlayedGame = {
  round: number; date: string; division: 'North' | 'South';
  home: string; away: string; home_score: number; away_score: number; techni: boolean;
};

async function getData(): Promise<{ played: PlayedGame[]; currentRound: number }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('game_results')
      .select('round,date,division,home_team,away_team,home_score,away_score,techni')
      .order('round');
    if (error || !data) throw new Error('no data');
    const played = data.map((r) => ({
      round: r.round, date: r.date,
      division: r.division as 'North' | 'South',
      home: r.home_team, away: r.away_team,
      home_score: r.home_score, away_score: r.away_score,
      techni: r.techni,
    }));
    const currentRound = played.length > 0 ? Math.max(...played.map((g) => g.round)) : 0;
    return { played, currentRound };
  } catch {
    return { played: [], currentRound: 8 };
  }
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function PlayedRow({ game }: { game: PlayedGame }) {
  const homeWins = game.home_score > game.away_score;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2">
      <span className={`text-right text-sm font-semibold ${homeWins ? 'text-white' : 'text-[#4a6a8a]'}`}>{game.home}</span>
      <div className="flex items-center gap-1 rounded-lg bg-black/40 px-2.5 py-1.5 text-center">
        <span className={`text-sm font-black ${homeWins ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>{game.home_score}</span>
        <span className="text-[10px] text-[#2a4a6a]">:</span>
        <span className={`text-sm font-black ${!homeWins ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>{game.away_score}</span>
        {game.techni && <span className="mr-1 text-[8px] text-red-400">טכ׳</span>}
      </div>
      <span className={`text-left text-sm font-semibold ${!homeWins ? 'text-white' : 'text-[#4a6a8a]'}`}>{game.away}</span>
    </div>
  );
}

function UpcomingRow({ home, away }: { home: string; away: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
      <span className="flex-1 text-right text-sm font-semibold text-white">{home}</span>
      <span className="shrink-0 rounded-lg bg-black/30 px-3 py-1.5 text-xs font-bold text-[#4a6a8a]">VS</span>
      <span className="flex-1 text-left text-sm font-semibold text-white">{away}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function GamesPage() {
  const { played, currentRound } = await getData();
  const nextRound = currentRound + 1;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-black text-white">לוח משחקים</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">מחזורים 1–14 · עונת 2025–2026</p>
      </div>

      {Array.from({ length: 14 }, (_, i) => i + 1).map((round) => {
        const isPlayed  = round <= currentRound;
        const isNext    = round === nextRound;
        const date      = ALL_ROUND_DATES[round] ?? '';

        // Played: show results from Supabase
        const northPlayed = played.filter((g) => g.round === round && g.division === 'North');
        const southPlayed = played.filter((g) => g.round === round && g.division === 'South');

        // Upcoming: show schedule
        const northUpcoming = LIBI_SCHEDULE.filter((g) => g.round === round && g.division === 'North');
        const southUpcoming = LIBI_SCHEDULE.filter((g) => g.round === round && g.division === 'South');

        return (
          <section key={round}>
            {/* Round header */}
            <div className="mb-4 flex items-center gap-3">
              <div className={`rounded-2xl border px-4 py-1.5 text-sm font-bold ${
                isNext    ? 'border-orange-500/50 bg-orange-500/15 text-orange-400' :
                isPlayed  ? 'border-green-500/20 bg-green-500/10 text-green-400' :
                            'border-white/10 bg-white/5 text-[#8aaac8]'
              }`}>
                מחזור {round}
                {isNext   ? ' ← הבא' : ''}
                {isPlayed ? ' ✓' : ''}
              </div>
              <span className="text-sm text-[#4a6a8a]">{date}</span>
              <div className="h-px flex-1 bg-white/[0.05]" />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* South (right) */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400">
                  <span className="h-2 w-2 rounded-full bg-orange-400" /> מחוז דרום
                </h3>
                {isPlayed ? (
                  southPlayed.length > 0
                    ? southPlayed.map((g, i) => <PlayedRow key={i} game={g} />)
                    : <p className="text-xs text-[#4a6a8a]">אין תוצאות</p>
                ) : (
                  southUpcoming.length > 0
                    ? southUpcoming.map((g, i) => <UpcomingRow key={i} home={g.homeTeam} away={g.awayTeam} />)
                    : <p className="text-xs text-[#4a6a8a]">אין משחקים</p>
                )}
              </div>

              {/* North (left) */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400">
                  <span className="h-2 w-2 rounded-full bg-blue-400" /> מחוז צפון
                </h3>
                {isPlayed ? (
                  northPlayed.length > 0
                    ? northPlayed.map((g, i) => <PlayedRow key={i} game={g} />)
                    : <p className="text-xs text-[#4a6a8a]">אין תוצאות</p>
                ) : (
                  northUpcoming.length > 0
                    ? northUpcoming.map((g, i) => <UpcomingRow key={i} home={g.homeTeam} away={g.awayTeam} />)
                    : <p className="text-xs text-[#4a6a8a]">אין משחקים</p>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
