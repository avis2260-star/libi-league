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

function GameCard({ game, compact = false }: { game: CupGame; compact?: boolean }) {
  const winner = getWinner(game);
  const homeWin = winner === game.home_team;
  const awayWin = winner === game.away_team;

  return (
    <div className={`bg-[#0c1a28] border border-[#1e3a5f] rounded-xl overflow-hidden shadow-lg ${compact ? 'w-44' : 'w-52'}`}>
      {game.date && (
        <div className="px-3 pt-1.5 text-[9px] text-[#3a5a7a] text-right">{game.date}</div>
      )}
      {/* Home */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-[#152030] ${homeWin ? 'bg-orange-500/10' : ''}`}>
        <span className={`text-xs font-semibold truncate flex-1 text-right leading-tight ${homeWin ? 'text-orange-400 font-bold' : game.played ? 'text-[#4a6a8a]' : 'text-[#c8d8e8]'}`}>
          {game.home_team}
        </span>
        {game.played && game.home_score !== null && (
          <span className={`text-sm font-black mr-2 min-w-[1.8rem] text-center ${homeWin ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>
            {game.home_score}
          </span>
        )}
      </div>
      {/* Away */}
      <div className={`flex items-center justify-between px-3 py-2 ${awayWin ? 'bg-orange-500/10' : ''}`}>
        <span className={`text-xs font-semibold truncate flex-1 text-right leading-tight ${awayWin ? 'text-orange-400 font-bold' : game.played ? 'text-[#4a6a8a]' : 'text-[#c8d8e8]'}`}>
          {game.away_team}
        </span>
        {game.played && game.away_score !== null && (
          <span className={`text-sm font-black mr-2 min-w-[1.8rem] text-center ${awayWin ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>
            {game.away_score}
          </span>
        )}
      </div>
      {/* Status */}
      {!game.played && (
        <div className="px-3 py-1 text-[9px] text-[#2a4a6a] text-center bg-[#080f18]">
          ממתין לתוצאה
        </div>
      )}
    </div>
  );
}

function RoundColumn({
  label, date, games, compact = false,
}: {
  label: string; date?: string; games: CupGame[]; compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0 min-w-0">
      {/* Round header */}
      <div className="mb-4 text-center">
        <div className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a]">{label}</div>
        {date && <div className="text-[9px] text-[#3a5a7a] mt-0.5">{date}</div>}
      </div>
      {/* Games */}
      <div className="flex flex-col gap-4 items-center justify-center flex-1">
        {games.map((game) => (
          <div key={game.id} className="flex items-center gap-0">
            {/* Game number badge */}
            <div className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[9px] font-bold text-[#5a7a9a]">
              {game.game_number}
            </div>
            <GameCard game={game} compact={compact} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center self-center mx-2 text-[#1e3a5f]">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M6 14H22M22 14L15 7M22 14L15 21" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function ChampionCard({ teamName }: { teamName: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-yellow-400/50 bg-gradient-to-b from-yellow-400/10 to-[#0c1a28] shadow-[0_0_40px_rgba(250,204,21,0.15)] w-52">
      <div className="text-5xl mb-3">🏆</div>
      <div className="text-[#a08020] text-[10px] uppercase tracking-widest mb-1 font-bold">אלוף הגביע</div>
      <div className="text-yellow-400 font-black text-lg text-center leading-tight">{teamName}</div>
    </div>
  );
}

function TBDCard() {
  return (
    <div className="flex flex-col items-center justify-center w-52 h-36 rounded-2xl border-2 border-dashed border-[#1e3a5f] bg-[#080f18]">
      <div className="text-3xl mb-2">🏆</div>
      <div className="text-[#3a5a7a] text-xs text-center">טרם נקבע</div>
    </div>
  );
}

export default function TournamentBracket({ games }: { games: CupGame[] }) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6">
        <div className="text-7xl">🏆</div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">טורניר הגביע</h2>
          <p className="text-[#5a7a9a] text-sm">הנתונים יופיעו לאחר סנכרון קובץ האקסל</p>
        </div>
        <a href="/admin?tab=sync" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 transition text-white font-semibold text-sm">
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
  const sortedOrders = Array.from(roundsMap.keys()).sort((a, b) => a - b);
  const rounds = sortedOrders.map(o => ({ order: o, games: roundsMap.get(o)! }));

  // Champion = winner of last round's first game
  const finalGames = rounds[rounds.length - 1]?.games ?? [];
  const champion = finalGames[0] ? getWinner(finalGames[0]) : null;

  return (
    <div>
      {/* ── Desktop ─────────────────────────────────────────── */}
      {/* dir="ltr" so bracket flows left→right even on RTL page */}
      <div dir="ltr" className="hidden lg:flex items-start gap-0 overflow-x-auto pb-6">
        {rounds.map((round, idx) => {
          const isLast = idx === rounds.length - 1;
          const label  = round.games[0]?.round ?? '';
          const date   = round.games[0]?.date ?? '';
          const compact = round.games.length > 4;

          return (
            <div key={round.order} className="flex items-center self-stretch">
              <RoundColumn label={label} date={date} games={round.games} compact={compact} />
              {!isLast && <Arrow />}
            </div>
          );
        })}

        {/* Champion column */}
        <div className="flex items-center self-stretch">
          <Arrow />
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a] mb-4">אלוף</div>
            {champion ? <ChampionCard teamName={champion} /> : <TBDCard />}
          </div>
        </div>
      </div>

      {/* ── Mobile ──────────────────────────────────────────── */}
      <div className="lg:hidden space-y-6">
        {rounds.map((round, idx) => {
          const isLast  = idx === rounds.length - 1;
          const label   = round.games[0]?.round ?? '';
          const date    = round.games[0]?.date ?? '';
          return (
            <div key={round.order} className="space-y-3">
              <div className="text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a]">{label}</span>
                {date && <span className="text-[9px] text-[#3a5a7a] block">{date}</span>}
              </div>
              <div className="flex flex-col items-center gap-3">
                {round.games.map((game) => (
                  <div key={game.id} className="flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[9px] font-bold text-[#5a7a9a]">
                      {game.game_number}
                    </div>
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
              {!isLast && (
                <div className="flex justify-center">
                  <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
                    <path d="M10 4V24M10 24L4 17M10 24L16 17" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}

        {/* Champion on mobile */}
        <div className="space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a] text-center">אלוף</div>
          <div className="flex justify-center">
            {champion ? <ChampionCard teamName={champion} /> : <TBDCard />}
          </div>
        </div>
      </div>
    </div>
  );
}
