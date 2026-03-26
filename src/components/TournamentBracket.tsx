'use client';

type CupGame = {
  id: string;
  round: string;
  round_order: number;
  game_number: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  date: string;
  played: boolean;
};

function getWinner(game: CupGame): string | null {
  if (!game.played || game.home_score === null || game.away_score === null) return null;
  if (game.home_score > game.away_score) return game.home_team;
  if (game.away_score > game.home_score) return game.away_team;
  return null;
}

/* ── Single matchup card (mirrors the games-page style) ──────────────────── */
function MatchupCard({ game }: { game: CupGame }) {
  const winner  = getWinner(game);
  const homeWin = winner === game.home_team;
  const awayWin = winner === game.away_team;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 hover:border-orange-500/20 transition-colors">
      {/* Game number badge */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-bold text-[#5a7a9a]">
        {game.game_number}
      </div>

      {/* Home team */}
      <span
        className={`flex-1 truncate text-sm font-semibold text-right
          ${homeWin ? 'text-orange-400' : game.played ? 'text-[#8aaac8]' : 'text-white'}`}
      >
        {game.home_team}
      </span>

      {/* Score or VS */}
      <div className="w-20 shrink-0 text-center">
        {game.played && game.home_score !== null && game.away_score !== null ? (
          <span className="text-sm font-black text-white tabular-nums">
            {game.home_score}
            <span className="mx-1 text-[#3a5a7a] font-normal">–</span>
            {game.away_score}
          </span>
        ) : (
          <span className="inline-block rounded border border-[#1e3a5f] px-2 py-0.5 text-[10px] font-bold text-[#3a5a7a]">
            VS
          </span>
        )}
      </div>

      {/* Away team */}
      <span
        className={`flex-1 truncate text-sm font-semibold text-left
          ${awayWin ? 'text-orange-400' : game.played ? 'text-[#8aaac8]' : 'text-white'}`}
      >
        {game.away_team}
      </span>
    </div>
  );
}

/* ── One round section ───────────────────────────────────────────────────── */
function RoundSection({
  label, games, isLast,
}: {
  label: string; games: CupGame[]; isLast: boolean;
}) {
  const allPlayed = games.length > 0 && games.every((g) => g.played);

  return (
    <div>
      {/* Round header — badge shown only for multi-game rounds; single-game rounds show it above the card */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[11px] font-black uppercase tracking-widest text-[#5a7a9a]">
          {label}
        </span>
        {games.length > 1 && allPlayed && (
          <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-[10px] font-bold text-green-400">
            ✓ הסתיים
          </span>
        )}
        {games.length > 1 && !allPlayed && games.some((g) => !g.played) && (
          <span className="rounded-full bg-orange-900/30 px-2 py-0.5 text-[10px] font-bold text-orange-400">
            ● פעיל
          </span>
        )}
      </div>

      {/* Games grid — 1 column on mobile, 2 on md+ */}
      {games.length === 1 ? (
        <div className="max-w-lg mx-auto">
          {/* Status badge above right (home) team for single-game rounds */}
          <div className="mb-2 flex justify-start">
            {allPlayed ? (
              <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-[10px] font-bold text-green-400">✓ הסתיים</span>
            ) : (
              <span className="rounded-full bg-orange-900/30 px-2 py-0.5 text-[10px] font-bold text-orange-400">● פעיל</span>
            )}
          </div>
          <div className="grid gap-2">
            {games.map((game) => <MatchupCard key={game.id} game={game} />)}
          </div>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {games.map((game) => <MatchupCard key={game.id} game={game} />)}
        </div>
      )}

      {/* Downward arrow between rounds */}
      {!isLast && (
        <div className="my-4 flex justify-center">
          <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
            <path
              d="M10 2V22M10 22L4 15M10 22L16 15"
              stroke="#1e3a5f"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

/* ── Champion banner ─────────────────────────────────────────────────────── */
function ChampionBanner({ teamName }: { teamName: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-yellow-400/40 bg-gradient-to-b from-yellow-400/10 to-transparent p-6 shadow-[0_0_40px_rgba(250,204,21,0.12)]">
      <div className="text-5xl">🏆</div>
      <p className="text-[11px] font-black uppercase tracking-widest text-[#a08020]">אלוף הגביע 2025–2026</p>
      <p className="text-2xl font-black text-yellow-400 text-center">{teamName}</p>
    </div>
  );
}

function TBDBanner() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#1e3a5f] bg-[#080f18]/60 p-6">
      <div className="text-4xl">🏆</div>
      <p className="text-[11px] font-black uppercase tracking-widest text-[#3a5a7a]">אלוף הגביע</p>
      <p className="text-sm font-bold text-[#2a4a6a]">טרם נקבע — ממתין לגמר</p>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export default function TournamentBracket({ games }: { games: CupGame[] }) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6">
        <div className="text-7xl">🏆</div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">טורניר הגביע</h2>
          <p className="text-[#5a7a9a] text-sm">הנתונים יופיעו לאחר סנכרון קובץ האקסל</p>
        </div>
        <a
          href="/admin?tab=sync"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 transition text-white font-semibold text-sm"
        >
          סנכרן עכשיו
        </a>
      </div>
    );
  }

  // Group by round_order
  const roundsMap = new Map<number, CupGame[]>();
  for (const g of games) {
    if (!roundsMap.has(g.round_order)) roundsMap.set(g.round_order, []);
    roundsMap.get(g.round_order)!.push(g);
  }
  const rounds = Array.from(roundsMap.keys())
    .sort((a, b) => a - b)
    .map((o) => ({ order: o, label: roundsMap.get(o)![0].round, games: roundsMap.get(o)! }));

  // Champion ONLY from a round explicitly named 'גמר'.
  // If that round doesn't exist in DB, or the game hasn't been played yet → TBD.
  const finalRound = rounds.find((r) => r.label === 'גמר');
  const champion   = finalRound?.games[0] ? getWinner(finalRound.games[0]) : null;

  return (
    <div className="space-y-0">
      {rounds.map((round, idx) => (
        <RoundSection
          key={round.order}
          label={round.label}
          games={round.games}
          isLast={idx === rounds.length - 1}
        />
      ))}

      {/* Arrow to champion */}
      <div className="my-4 flex justify-center">
        <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
          <path
            d="M10 2V22M10 22L4 15M10 22L16 15"
            stroke="#1e3a5f"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Champion */}
      <div className="max-w-sm mx-auto">
        {champion ? <ChampionBanner teamName={champion} /> : <TBDBanner />}
      </div>
    </div>
  );
}
