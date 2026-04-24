'use client';

import { Fragment } from 'react';

type CupGame = {
  id: string; round: string; round_order: number; game_number: number;
  home_team: string; away_team: string;
  home_score: number | null; away_score: number | null;
  date: string; played: boolean;
};

function getWinner(g: CupGame): string | null {
  if (!g.played || g.home_score === null || g.away_score === null) return null;
  return g.home_score > g.away_score ? g.home_team : g.away_score > g.home_score ? g.away_team : null;
}

const HEADER_H = 32; // compact round-label row

/* ── Normalize team name for fuzzy logo lookup ───────────────────────────── */
function normalizeName(s: string) {
  return s.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function findLogoUrl(name: string, logos: Record<string, string>): string | undefined {
  if (logos[name]) return logos[name];
  const norm = normalizeName(name);
  for (const [key, url] of Object.entries(logos)) {
    if (normalizeName(key) === norm) return url;
  }
  return undefined;
}

/* ── Team logo ───────────────────────────────────────────────────────────── */
function TeamLogo({ name, logos, large }: { name: string; logos: Record<string, string>; large?: boolean }) {
  const url = findLogoUrl(name, logos);
  const sz = large ? 'h-9 w-9' : 'h-6 w-6';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`${sz} shrink-0 rounded-full object-cover border border-white/10`} />;
  }
  return (
    <div className={`${sz} shrink-0 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[10px] font-black text-[#3a5a7a]`}>
      {[...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

/* ── Match card ──────────────────────────────────────────────────────────── */
function MatchCard({ game, teamLogos, isFinal }: { game: CupGame; teamLogos: Record<string, string>; isFinal?: boolean }) {
  const winner = getWinner(game);
  const homeWin = winner === game.home_team;
  const awayWin = winner === game.away_team;

  return (
    <div className={`overflow-hidden rounded-xl border shadow-lg ${isFinal
      ? 'border-orange-500/30 ring-1 ring-orange-500/20 shadow-[0_0_30px_rgba(255,121,56,0.12)]'
      : 'border-white/[0.07]'} bg-[#0c1825]`}
    >
      <div className={`flex items-center gap-2 px-2.5 py-1.5 ${homeWin ? 'bg-orange-500/15' : ''}`}>
        <TeamLogo name={game.home_team} logos={teamLogos} large={isFinal} />
        <span className={`flex-1 min-w-0 truncate font-bold ${isFinal ? 'text-sm' : 'text-xs'} ${homeWin ? 'text-orange-400' : game.played ? 'text-[#5a7a9a]' : 'text-white'}`}>
          {game.home_team}
        </span>
        {game.played && game.home_score !== null && (
          <span className={`shrink-0 font-black tabular-nums ${isFinal ? 'text-lg' : 'text-sm'} ${homeWin ? 'text-orange-400' : 'text-[#5a7a9a]'}`}>
            {game.home_score}
          </span>
        )}
        {homeWin && <span className="text-orange-400 text-xs shrink-0">✓</span>}
      </div>
      <div className="h-px bg-white/[0.05]" />
      <div className={`flex items-center gap-2 px-2.5 py-1.5 ${awayWin ? 'bg-orange-500/15' : ''}`}>
        <TeamLogo name={game.away_team} logos={teamLogos} large={isFinal} />
        <span className={`flex-1 min-w-0 truncate font-bold ${isFinal ? 'text-sm' : 'text-xs'} ${awayWin ? 'text-orange-400' : game.played ? 'text-[#5a7a9a]' : 'text-white'}`}>
          {game.away_team}
        </span>
        {game.played && game.away_score !== null && (
          <span className={`shrink-0 font-black tabular-nums ${isFinal ? 'text-lg' : 'text-sm'} ${awayWin ? 'text-orange-400' : 'text-[#5a7a9a]'}`}>
            {game.away_score}
          </span>
        )}
        {awayWin && <span className="text-orange-400 text-xs shrink-0">✓</span>}
      </div>
    </div>
  );
}

/* ── SVG connector: center-to-center bracket lines ───────────────────────── */
// With justify-around (no gap), center of item i in n items within height H:
//   y = headerH + (totalH - headerH) * (2i + 1) / (2n)
function BracketSVGLines({
  fromCount, toCount, totalH,
}: {
  fromCount: number; toCount: number; totalH: number;
}) {
  const gameAreaH = totalH - HEADER_H;
  const W = 28;
  const xMid = 10;

  const fromY = (i: number) => HEADER_H + gameAreaH * (2 * i + 1) / (2 * fromCount);
  const toY   = (j: number) => HEADER_H + gameAreaH * (2 * j + 1) / (2 * toCount);

  const paths: string[] = [];
  for (let j = 0; j < toCount; j++) {
    const yA = fromY(j * 2);      // top game of pair
    const yB = fromY(j * 2 + 1);  // bottom game of pair
    const yC = toY(j);            // center of the merged game (= midpoint of yA & yB)

    // C-bracket: from left edge at yA, across to xMid, down to yB, back to left edge
    paths.push(`M 0 ${yA} L ${xMid} ${yA} L ${xMid} ${yB} L 0 ${yB}`);
    // Horizontal line from midpoint of bracket to right edge (next round)
    paths.push(`M ${xMid} ${yC} L ${W} ${yC}`);
  }

  return (
    <svg
      width={W}
      height={totalH}
      className="shrink-0 overflow-visible"
      style={{ opacity: 0.22 }}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#7aaac8"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/* ── Simple dashed separator (when round counts don't pair cleanly) ───────── */
function RoundGap({ totalH }: { totalH: number }) {
  return (
    <svg width={20} height={totalH} className="shrink-0 overflow-visible" style={{ opacity: 0.08 }}>
      <line x1={10} y1={HEADER_H} x2={10} y2={totalH} stroke="#7aaac8" strokeWidth={1} strokeDasharray="4 4" />
    </svg>
  );
}

/* ── Champion banner ─────────────────────────────────────────────────────── */
function ChampionBanner({ teamName, teamLogos }: { teamName: string; teamLogos: Record<string, string> }) {
  const url = teamLogos[teamName];
  return (
    <div className="mt-4 flex flex-row items-center justify-center gap-4 rounded-2xl border-2 border-yellow-400/40 bg-gradient-to-b from-yellow-400/10 to-transparent px-6 py-4 shadow-[0_0_60px_rgba(250,204,21,0.15)] max-w-md mx-auto">
      <div className="text-3xl">🏆</div>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={teamName} className="h-12 w-12 rounded-full border-2 border-yellow-400/50 object-cover shadow-lg shrink-0" />
      )}
      <div className="flex flex-col items-start">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#a08020]">אלוף הגביע 2025–2026</p>
        <p className="text-lg font-black text-yellow-400">{teamName}</p>
      </div>
    </div>
  );
}

function TBDBanner() {
  return (
    <div className="mt-4 flex flex-row items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#1e3a5f] bg-[#080f18]/60 px-6 py-3 max-w-md mx-auto">
      <div className="text-2xl">🏆</div>
      <div className="flex flex-col items-start">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#3a5a7a]">אלוף הגביע</p>
        <p className="text-sm font-bold text-[#2a4a6a]">טרם נקבע — ממתין לגמר</p>
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export default function TournamentBracket({ games, teamLogos }: { games: CupGame[]; teamLogos: Record<string, string> }) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6">
        <div className="text-7xl">🏆</div>
        <h2 className="text-2xl font-bold text-white">טורניר הגביע</h2>
        <p className="text-[#5a7a9a] text-sm">הנתונים יופיעו לאחר סנכרון קובץ האקסל</p>
        <a href="/admin?tab=sync" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 transition text-white font-semibold text-sm">סנכרן עכשיו</a>
      </div>
    );
  }

  const roundsMap = new Map<number, CupGame[]>();
  for (const g of games) {
    if (!roundsMap.has(g.round_order)) roundsMap.set(g.round_order, []);
    roundsMap.get(g.round_order)!.push(g);
  }
  const rounds = Array.from(roundsMap.keys()).sort((a, b) => a - b)
    .map(o => ({ order: o, label: roundsMap.get(o)![0].round, games: roundsMap.get(o)! }));

  const finalRound = rounds.find(r => r.label === 'גמר');
  const champion   = finalRound?.games[0] ? getWinner(finalRound.games[0]) : null;
  const maxGames   = Math.max(...rounds.map(r => r.games.length));

  // Total bracket height — no gap between cards, justify-around handles spacing
  const CARD_H  = 58;  // approximate card height in px (compact)
  const bracketH = HEADER_H + maxGames * CARD_H + (maxGames + 1) * 4;

  return (
    <div dir="ltr">
      {/* ── Horizontal bracket ─────────────────────────────────────────── */}
      <div className="overflow-x-auto pb-4">
        <div
          className="flex items-stretch"
          style={{ height: bracketH, minWidth: rounds.length * 230 + (rounds.length - 1) * 28 }}
        >
          {rounds.map((round, idx) => {
            const isFinal    = round.label === 'גמר';
            const allPlayed  = round.games.every(g => g.played);
            const nextRound  = rounds[idx + 1];
            const cleanPair  = !!nextRound && nextRound.games.length * 2 === round.games.length;

            return (
              <Fragment key={round.order}>
                {/* ── Round column ────────────────────────────────────── */}
                <div className="flex flex-col" style={{ width: isFinal ? 250 : 215, minWidth: isFinal ? 250 : 215 }}>
                  {/* Round label */}
                  <div className="flex items-center justify-center gap-2 shrink-0" style={{ height: HEADER_H }}>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isFinal ? 'text-yellow-400' : 'text-[#5a7a9a]'}`}>
                      {isFinal ? '🏆 ' : ''}{round.label}
                    </span>
                    {allPlayed
                      ? <span className="rounded-full bg-green-900/40 px-1.5 py-px text-[9px] font-bold text-green-400">✓</span>
                      : <span className="rounded-full bg-orange-900/30 px-1.5 py-px text-[9px] font-bold text-orange-400">●</span>
                    }
                  </div>
                  {/* Game cards — no gap so SVG y-formula stays accurate */}
                  <div className="flex-1 flex flex-col justify-around px-1.5">
                    {round.games.map(game => (
                      <MatchCard key={game.id} game={game} teamLogos={teamLogos} isFinal={isFinal} />
                    ))}
                  </div>
                </div>

                {/* ── Connector to next round ──────────────────────────── */}
                {idx < rounds.length - 1 && (
                  cleanPair
                    ? <BracketSVGLines fromCount={round.games.length} toCount={nextRound.games.length} totalH={bracketH} />
                    : <RoundGap totalH={bracketH} />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Champion banner ────────────────────────────────────────────── */}
      {champion ? <ChampionBanner teamName={champion} teamLogos={teamLogos} /> : <TBDBanner />}
    </div>
  );
}
