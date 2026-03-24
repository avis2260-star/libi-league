import { LIBI_SCHEDULE } from '@/lib/libi-schedule';

// Group all future rounds from the full schedule (rounds 9-14)
const FUTURE_ROUND_DATES: Record<number, string> = {
  9:  '28.02.26',
  10: '14.03.26',
  11: '21.03.26',
  12: '10.04.26',
  13: '17.04.26',
  14: '24.04.26',
};

type ScheduledGame = {
  round: number;
  date: string;
  home: string;
  away: string;
  division: 'North' | 'South';
};

// Build upcoming games from full schedule for rounds 9–14
function buildUpcoming(): ScheduledGame[] {
  const upcoming: ScheduledGame[] = [];
  for (let r = 9; r <= 14; r++) {
    const date = FUTURE_ROUND_DATES[r] ?? '';
    const entries = LIBI_SCHEDULE.filter((e) => e.round === r);
    entries.forEach((e) =>
      upcoming.push({ round: r, date, home: e.homeTeam, away: e.awayTeam, division: e.division })
    );
  }
  return upcoming;
}

const ALL_UPCOMING = buildUpcoming();
const ROUNDS = [...new Set(ALL_UPCOMING.map((g) => g.round))].sort((a, b) => a - b);

// ── Card ──────────────────────────────────────────────────────────────────────

function MatchRow({ game }: { game: ScheduledGame }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 transition hover:border-orange-500/30 hover:bg-orange-500/5">
      <span className="flex-1 text-right text-sm font-semibold text-white">{game.home}</span>
      <span className="shrink-0 rounded-lg bg-black/30 px-3 py-1.5 text-xs font-bold text-[#4a6a8a]">VS</span>
      <span className="flex-1 text-left text-sm font-semibold text-white">{game.away}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamesPage() {
  return (
    <div className="space-y-10">
      {/* Page title */}
      <div>
        <h1 className="text-3xl font-black text-white">לוח משחקים</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">מחזורים 9–14 · עונת 2025–2026</p>
      </div>

      {ROUNDS.map((round) => {
        const northGames = ALL_UPCOMING.filter((g) => g.round === round && g.division === 'North');
        const southGames = ALL_UPCOMING.filter((g) => g.round === round && g.division === 'South');
        const date = FUTURE_ROUND_DATES[round] ?? '';
        const isNext = round === 9;

        return (
          <section key={round}>
            {/* Round header */}
            <div className="mb-4 flex items-center gap-3">
              <div className={`rounded-2xl border px-4 py-1.5 text-sm font-bold ${
                isNext
                  ? 'border-orange-500/40 bg-orange-500/15 text-orange-400'
                  : 'border-white/10 bg-white/5 text-[#8aaac8]'
              }`}>
                מחזור {round}{isNext ? ' ← הבא' : ''}
              </div>
              <span className="text-sm text-[#4a6a8a]">{date}</span>
              <div className="h-px flex-1 bg-white/[0.05]" />
            </div>

            {/* Two-column split: South (right) | North (left) */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Right column = South */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400">
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                  מחוז דרום
                </h3>
                {southGames.length > 0 ? (
                  southGames.map((g, i) => <MatchRow key={i} game={g} />)
                ) : (
                  <p className="text-xs text-[#4a6a8a]">אין משחקים</p>
                )}
              </div>

              {/* Left column = North */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  מחוז צפון
                </h3>
                {northGames.length > 0 ? (
                  northGames.map((g, i) => <MatchRow key={i} game={g} />)
                ) : (
                  <p className="text-xs text-[#4a6a8a]">אין משחקים</p>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
