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
  return null; // tie
}

function GameCard({ game }: { game: CupGame }) {
  const winner = getWinner(game);
  const homeIsWinner = winner === game.home_team;
  const awayIsWinner = winner === game.away_team;

  return (
    <div className="bg-[#0f1e30] border border-[#1e3a5f] rounded-xl overflow-hidden w-52 shadow-lg">
      {game.date && (
        <div className="px-3 pt-2 pb-1 text-[10px] text-[#5a7a9a] text-right">
          {game.date}
        </div>
      )}
      {/* Home team row */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-[#1e3a5f] ${homeIsWinner ? 'bg-orange-400/5' : ''}`}>
        <span className={`text-sm font-semibold truncate flex-1 text-right ${homeIsWinner ? 'text-orange-400 font-bold' : game.played ? 'text-gray-500' : 'text-[#e8edf5]'}`}>
          {game.home_team}
        </span>
        {game.played && game.home_score !== null && (
          <span className={`text-sm font-bold ml-2 min-w-[1.5rem] text-center ${homeIsWinner ? 'text-orange-400' : 'text-gray-500'}`}>
            {game.home_score}
          </span>
        )}
      </div>
      {/* VS divider */}
      <div className="px-3 py-1 text-[10px] text-[#3a5a7a] text-center tracking-widest">
        נגד
      </div>
      {/* Away team row */}
      <div className={`flex items-center justify-between px-3 py-2 border-t border-[#1e3a5f] ${awayIsWinner ? 'bg-orange-400/5' : ''}`}>
        <span className={`text-sm font-semibold truncate flex-1 text-right ${awayIsWinner ? 'text-orange-400 font-bold' : game.played ? 'text-gray-500' : 'text-[#e8edf5]'}`}>
          {game.away_team}
        </span>
        {game.played && game.away_score !== null && (
          <span className={`text-sm font-bold ml-2 min-w-[1.5rem] text-center ${awayIsWinner ? 'text-orange-400' : 'text-gray-500'}`}>
            {game.away_score}
          </span>
        )}
      </div>
      {/* Round badge */}
      <div className="px-3 py-1.5 text-[9px] text-[#5a7a9a] uppercase tracking-widest text-center bg-[#0a1628]">
        {game.round}
      </div>
    </div>
  );
}

function EmptyPlaceholder() {
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

function ChampionCard({ teamName }: { teamName: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-yellow-400/60 bg-gradient-to-b from-yellow-400/10 to-[#0f1e30] shadow-[0_0_30px_rgba(250,204,21,0.2)] w-56">
      <div className="text-5xl mb-3">🏆</div>
      <div className="text-[#5a7a9a] text-xs uppercase tracking-widest mb-1">אלוף הגביע</div>
      <div className="text-orange-400 font-black text-xl text-center">{teamName}</div>
    </div>
  );
}

// Bracket connector between a pair of games and the next round
function BracketConnector() {
  return (
    <div className="relative w-8 self-stretch flex-shrink-0">
      {/* Right vertical line connecting top game bottom-half to bottom game top-half */}
      <div className="absolute right-0 top-1/4 bottom-1/4 border-r-2 border-[#1e3a5f]" />
      {/* Horizontal line from top game to center */}
      <div className="absolute right-0 top-1/4 w-full border-t-2 border-[#1e3a5f]" />
      {/* Horizontal line from bottom game to center */}
      <div className="absolute right-0 bottom-1/4 w-full border-b-2 border-[#1e3a5f]" />
    </div>
  );
}

export default function TournamentBracket({ games }: { games: CupGame[] }) {
  if (games.length === 0) {
    return <EmptyPlaceholder />;
  }

  // Group by round_order
  const roundsMap = new Map<number, CupGame[]>();
  for (const game of games) {
    if (!roundsMap.has(game.round_order)) roundsMap.set(game.round_order, []);
    roundsMap.get(game.round_order)!.push(game);
  }

  const sortedOrders = Array.from(roundsMap.keys()).sort((a, b) => a - b);
  const rounds = sortedOrders.map(order => roundsMap.get(order)!);

  // Find champion: winner of the last (highest round_order) game
  const lastRoundGames = rounds[rounds.length - 1];
  const finalGame = lastRoundGames?.[0];
  const champion = finalGame ? getWinner(finalGame) : null;

  // ── Desktop bracket layout (horizontal, RTL: rightmost = earliest round) ──
  // We render columns from left to right as earliest→latest for LTR flow,
  // but since page is RTL the visual reads right-to-left naturally.

  return (
    <div>
      {/* Desktop bracket */}
      <div className="hidden md:block overflow-x-auto pb-4">
        <div className="inline-flex items-stretch gap-0 min-w-max">
          {rounds.map((roundGames, roundIdx) => {
            const isLast = roundIdx === rounds.length - 1;
            const roundName = roundGames[0]?.round ?? '';

            // Pair up games for connector lines: every 2 games feeds into 1 next-round slot
            const pairs: CupGame[][] = [];
            for (let i = 0; i < roundGames.length; i += 2) {
              pairs.push(roundGames.slice(i, i + 2));
            }

            return (
              <div key={roundIdx} className="flex items-stretch gap-0">
                {/* Column: round label + game pairs */}
                <div className="flex flex-col justify-center gap-0">
                  {/* Round label */}
                  <div className="text-[#5a7a9a] uppercase tracking-widest text-xs text-center mb-3 px-4">
                    {roundName}
                  </div>

                  {/* Game pairs with vertical spacing to align with next round */}
                  <div className="flex flex-col gap-0">
                    {pairs.map((pair, pairIdx) => {
                      const spacerBetween = roundIdx === 0 ? 'h-8' : 'h-16';
                      return (
                        <div key={pairIdx} className="flex items-stretch">
                          {/* The pair of games stacked with a spacer */}
                          <div className="flex flex-col justify-center">
                            {pair[0] && <GameCard game={pair[0]} />}
                            {pair.length === 2 && (
                              <>
                                <div className={spacerBetween} />
                                <GameCard game={pair[1]} />
                              </>
                            )}
                          </div>

                          {/* Connector to next round (only if there is a next round and pair has 2 games) */}
                          {!isLast && pair.length === 2 && <BracketConnector />}
                          {/* If only 1 game in pair (odd), no connector or a straight line */}
                          {!isLast && pair.length === 1 && (
                            <div className="relative w-8 self-stretch flex-shrink-0">
                              <div className="absolute right-0 top-1/2 w-full border-t-2 border-[#1e3a5f]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Champion column */}
          <div className="flex flex-col justify-center items-center pl-4">
            <div className="text-[#5a7a9a] uppercase tracking-widest text-xs text-center mb-3">
              אלוף
            </div>
            {champion ? (
              <ChampionCard teamName={champion} />
            ) : (
              <div className="w-56 h-32 border-2 border-dashed border-[#1e3a5f] rounded-2xl flex items-center justify-center">
                <span className="text-[#3a5a7a] text-sm">ממתין לתוצאות</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: vertical stacked layout */}
      <div className="md:hidden space-y-8">
        {rounds.map((roundGames, roundIdx) => {
          const roundName = roundGames[0]?.round ?? '';
          const isLast = roundIdx === rounds.length - 1;
          return (
            <div key={roundIdx} className="space-y-3">
              <div className="text-[#5a7a9a] uppercase tracking-widest text-xs text-center">
                {roundName}
              </div>
              <div className="flex flex-col items-center gap-3">
                {roundGames.map(game => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
              {!isLast && (
                <div className="flex justify-center">
                  <div className="text-[#1e3a5f] text-2xl">↓</div>
                </div>
              )}
            </div>
          );
        })}

        {/* Champion on mobile */}
        {champion && (
          <div className="space-y-3">
            <div className="text-[#5a7a9a] uppercase tracking-widest text-xs text-center">
              אלוף
            </div>
            <div className="flex justify-center">
              <ChampionCard teamName={champion} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
