'use client';

interface GameData {
  gameNumber: number;
  played: boolean;
  aScore: number | null;
  bScore: number | null;
  aWon: boolean;
}

interface Props {
  roundLabel: string;
  seriesNum: number;
  teamA: string;
  teamB: string;
  logoA?: string;
  logoB?: string;
  winsA: number;
  winsB: number;
  winner: string | null;
  games: GameData[];
  hasTeams: boolean;
}

export default function SeriesFlyerCard({
  roundLabel, seriesNum,
  teamA, teamB, logoA, logoB,
  winsA, winsB, winner, games, hasTeams,
}: Props) {
  return (
    <div
      className="w-full max-w-xl overflow-hidden rounded-3xl relative animate-fade-in-scale animate-glow-pulse"
      style={{
        background: 'linear-gradient(160deg, #0f2035 0%, #0b1520 40%, #0f1e2e 100%)',
        border: '1px solid rgba(255,180,50,0.25)',
        boxShadow: '0 0 80px rgba(255,140,0,0.12), 0 24px 64px rgba(0,0,0,0.6)',
      }}
    >
      {/* Animated SVG court lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
        <line x1="0" y1="300" x2="400" y2="300" stroke="white" strokeWidth="2"
          strokeDasharray="300" style={{ animation: 'courtDraw 1s ease 0.4s both' }} />
        <path d="M80 500 Q200 400 320 500" fill="none" stroke="white" strokeWidth="2"
          strokeDasharray="300" style={{ animation: 'courtDraw 1s ease 0.5s both' }} />
        <path d="M80 100 Q200 200 320 100" fill="none" stroke="white" strokeWidth="2"
          strokeDasharray="300" style={{ animation: 'courtDraw 1s ease 0.5s both' }} />
      </svg>

      {/* Header */}
      <div
        className="relative px-6 py-4 text-center animate-fade-in-up"
        style={{
          background: 'linear-gradient(90deg, rgba(255,140,0,0.15), rgba(255,180,50,0.08), rgba(255,140,0,0.15))',
          borderBottom: '1px solid rgba(255,180,50,0.15)',
          animationDelay: '0.1s',
        }}
      >
        <p className="text-[10px] font-black uppercase tracking-[4px] text-[#e0a030]">
          🏀 ליגת ליבי פלייאוף 2025–2026
        </p>
        <p className="mt-0.5 text-lg font-black text-white">{roundLabel} · סדרה {seriesNum}</p>
      </div>

      {/* Bouncing basketball */}
      <div className="relative flex justify-center pt-5 pb-1">
        <div className="flex flex-col items-center">
          <div className="animate-bounce-ball">
            <svg viewBox="0 0 40 40" className="w-9 h-9 drop-shadow-lg">
              <circle cx="20" cy="20" r="19" fill="#f97316" />
              <path d="M20 1 Q20 20 20 39" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" fill="none" />
              <path d="M1 20 Q20 20 39 20" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" fill="none" />
              <path d="M4 8 Q20 20 4 32" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" fill="none" />
              <path d="M36 8 Q20 20 36 32" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <div
            className="w-7 h-1.5 rounded-full bg-black/40 mt-0.5 animate-shadow-squash"
            style={{ filter: 'blur(2px)' }}
          />
        </div>
      </div>

      {/* Teams matchup */}
      <div className="relative px-6 py-6 flex items-center justify-between gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        {/* Team A */}
        <div className="flex-1 flex flex-col items-center gap-3">
          {logoA ? (
            <img src={logoA} alt={teamA}
              className="h-20 w-20 rounded-full object-cover border-2 border-white/20 shadow-2xl" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-[#1a3050] border-2 border-white/10 flex items-center justify-center text-3xl font-black text-[#3a5a7a]">
              {[...teamA].find(c => /\S/.test(c)) ?? '?'}
            </div>
          )}
          <p className={`text-sm font-black text-center leading-tight ${winner === teamA ? 'text-orange-400' : 'text-white'}`}>
            {hasTeams ? teamA : 'ממתין'}
          </p>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-2xl"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            <span className={`text-5xl font-black tabular-nums leading-none ${winsA > 0 ? 'text-white' : 'text-[#1e3a5f]'}`}>
              {winsA}
            </span>
            <span className="text-2xl text-[#1e3a5f] font-black">:</span>
            <span className={`text-5xl font-black tabular-nums leading-none ${winsB > 0 ? 'text-white' : 'text-[#1e3a5f]'}`}>
              {winsB}
            </span>
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-[#3a5a7a]">
            ניצחונות · הטוב מ-3
          </p>
        </div>

        {/* Team B */}
        <div className="flex-1 flex flex-col items-center gap-3">
          {logoB ? (
            <img src={logoB} alt={teamB}
              className="h-20 w-20 rounded-full object-cover border-2 border-white/20 shadow-2xl" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-[#1a3050] border-2 border-white/10 flex items-center justify-center text-3xl font-black text-[#3a5a7a]">
              {[...teamB].find(c => /\S/.test(c)) ?? '?'}
            </div>
          )}
          <p className={`text-sm font-black text-center leading-tight ${winner === teamB ? 'text-orange-400' : 'text-white'}`}>
            {hasTeams ? teamB : 'ממתין'}
          </p>
        </div>
      </div>

      {/* Games breakdown */}
      <div className="px-6 pb-6 grid grid-cols-3 gap-3">
        {games.map((g, idx) => (
          <div
            key={g.gameNumber}
            className="rounded-2xl flex flex-col items-center gap-2 py-4 px-2 animate-fade-in-up"
            style={{ animationDelay: `${0.3 + idx * 0.1}s` }}
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-[#3a5a7a]">
              משחק {g.gameNumber}
            </p>

            {g.played ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-black tabular-nums ${g.aWon ? 'text-orange-400' : 'text-white'}`}>
                    {g.aScore}
                  </span>
                  <span className="text-sm text-[#2a4a6a] font-black">-</span>
                  <span className={`text-2xl font-black tabular-nums ${!g.aWon ? 'text-orange-400' : 'text-white'}`}>
                    {g.bScore}
                  </span>
                </div>
                <div
                  className="h-4 w-4 rounded-full"
                  style={{
                    background: g.aWon ? '#f97316' : '#4a6a8a',
                    boxShadow: g.aWon ? '0 0 10px rgba(249,115,22,0.7)' : 'none',
                  }}
                />
                <p className={`text-[9px] font-bold text-center leading-tight ${g.aWon ? 'text-orange-400' : 'text-[#5a7a9a]'}`}>
                  {g.aWon ? (hasTeams ? teamA : 'A') : (hasTeams ? teamB : 'B')}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-[#1a2e45]">–</span>
                  <span className="text-sm text-[#1a2e45] font-black">-</span>
                  <span className="text-2xl font-black text-[#1a2e45]">–</span>
                </div>
                <div className="h-4 w-4 rounded-full border border-white/[0.08] bg-transparent" />
                <p className="text-[9px] font-bold text-[#2a4a6a]">טרם שוחק</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Winner banner */}
      {winner && (
        <div
          className="px-6 py-4 text-center animate-fade-in-up"
          style={{
            background: 'linear-gradient(90deg, rgba(34,197,94,0.05), rgba(34,197,94,0.18), rgba(34,197,94,0.05))',
            borderTop: '1px solid rgba(34,197,94,0.25)',
            animationDelay: '0.6s',
          }}
        >
          <p className="text-sm font-black text-green-400">🏆 {winner} ניצחו בסדרה!</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-[9px] font-black uppercase tracking-[3px] text-[#1e3a5f]">
          LIBI LEAGUE · OFFICIAL PLAYOFFS
        </p>
      </div>
    </div>
  );
}
