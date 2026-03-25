'use client';
import { useRef, useEffect, useState } from 'react';

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

function GameCard({ game }: { game: CupGame }) {
  const winner  = getWinner(game);
  const homeWin = winner === game.home_team;
  const awayWin = winner === game.away_team;

  return (
    <div className="bg-[#0c1a28] border border-[#1e3a5f] rounded-lg overflow-hidden shadow-md w-40">
      {/* Home */}
      <div className={`flex items-center justify-between px-2 py-1.5 border-b border-[#152030] ${homeWin ? 'bg-orange-500/10' : ''}`}>
        <span className={`text-[10px] font-semibold truncate flex-1 text-right leading-tight
          ${homeWin ? 'text-orange-400 font-bold' : game.played ? 'text-[#4a6a8a]' : 'text-[#c8d8e8]'}`}>
          {game.home_team}
        </span>
        {game.played && game.home_score !== null && (
          <span className={`text-xs font-black ml-1.5 min-w-[1.4rem] text-center shrink-0
            ${homeWin ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>
            {game.home_score}
          </span>
        )}
      </div>
      {/* Away */}
      <div className={`flex items-center justify-between px-2 py-1.5 ${awayWin ? 'bg-orange-500/10' : ''}`}>
        <span className={`text-[10px] font-semibold truncate flex-1 text-right leading-tight
          ${awayWin ? 'text-orange-400 font-bold' : game.played ? 'text-[#4a6a8a]' : 'text-[#c8d8e8]'}`}>
          {game.away_team}
        </span>
        {game.played && game.away_score !== null && (
          <span className={`text-xs font-black ml-1.5 min-w-[1.4rem] text-center shrink-0
            ${awayWin ? 'text-orange-400' : 'text-[#4a6a8a]'}`}>
            {game.away_score}
          </span>
        )}
      </div>
      {/* Not played */}
      {!game.played && (
        <div className="px-2 py-0.5 text-[8px] text-[#2a4a6a] text-center bg-[#080f18]">
          ממתין לתוצאה
        </div>
      )}
    </div>
  );
}

function RoundColumn({ label, games }: { label: string; games: CupGame[] }) {
  return (
    <div className="flex flex-col items-center gap-0 min-w-0">
      {/* Header */}
      <div className="mb-3 text-center">
        <div className="text-[9px] font-black uppercase tracking-widest text-[#5a7a9a]">{label}</div>
      </div>
      {/* Games */}
      <div className="flex flex-col gap-2.5 items-center justify-center flex-1">
        {games.map((game) => (
          <div key={game.id} className="flex items-center gap-1">
            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[8px] font-bold text-[#5a7a9a]">
              {game.game_number}
            </div>
            <GameCard game={game} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center self-center mx-1.5 text-[#1e3a5f]">
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
        <path d="M6 14H22M22 14L15 7M22 14L15 21" stroke="#1e3a5f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function ChampionCard({ teamName }: { teamName: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-yellow-400/50 bg-gradient-to-b from-yellow-400/10 to-[#0c1a28] shadow-[0_0_32px_rgba(250,204,21,0.15)] w-44">
      <div className="text-4xl mb-2">🏆</div>
      <div className="text-[#a08020] text-[9px] uppercase tracking-widest mb-1 font-bold">אלוף הגביע</div>
      <div className="text-yellow-400 font-black text-sm text-center leading-tight">{teamName}</div>
    </div>
  );
}

function TBDCard() {
  return (
    <div className="flex flex-col items-center justify-center w-44 h-28 rounded-2xl border-2 border-dashed border-[#1e3a5f] bg-[#080f18]">
      <div className="text-2xl mb-1.5">🏆</div>
      <div className="text-[#3a5a7a] text-[10px] text-center">טרם נקבע</div>
    </div>
  );
}

export default function TournamentBracket({ games }: { games: CupGame[] }) {
  // ── Auto-scale desktop bracket to fit viewport without horizontal scroll ──
  const wrapRef  = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function measure() {
      const wrap  = wrapRef.current;
      const inner = innerRef.current;
      if (!wrap || !inner) return;
      // scrollWidth is layout-based (unaffected by CSS transform), so this
      // gives the true natural width regardless of the current scale value.
      const natural   = inner.scrollWidth;
      const available = wrap.clientWidth;
      setScale(natural > available ? available / natural : 1);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [games.length]);

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

  // Champion = winner of the LAST round (גמר) only if it was played
  const finalGames = rounds[rounds.length - 1]?.games ?? [];
  const champion   = finalGames[0] ? getWinner(finalGames[0]) : null;

  return (
    <div>
      {/* ── Desktop: auto-scaled to fit ─────────────────────────────── */}
      <div ref={wrapRef} className="hidden lg:block w-full overflow-hidden">
        <div
          ref={innerRef}
          dir="ltr"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
          className="inline-flex items-start gap-0 pb-4"
        >
          {rounds.map((round, idx) => {
            const isLast = idx === rounds.length - 1;
            const label  = round.games[0]?.round ?? '';
            return (
              <div key={round.order} className="flex items-center self-stretch">
                <RoundColumn label={label} games={round.games} />
                {!isLast && <Arrow />}
              </div>
            );
          })}

          {/* Champion column */}
          <div className="flex items-center self-stretch">
            <Arrow />
            <div className="flex flex-col items-center gap-2">
              <div className="text-[9px] font-black uppercase tracking-widest text-[#5a7a9a] mb-3">אלוף</div>
              {champion ? <ChampionCard teamName={champion} /> : <TBDCard />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: vertical stacked ─────────────────────────────────── */}
      <div className="lg:hidden space-y-6">
        {rounds.map((round, idx) => {
          const isLast = idx === rounds.length - 1;
          const label  = round.games[0]?.round ?? '';
          return (
            <div key={round.order} className="space-y-3">
              <div className="text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a]">{label}</span>
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
