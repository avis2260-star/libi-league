'use client';

import { useMemo, useState, useTransition } from 'react';
import { upsertPlayerGameStat } from '@/app/admin/actions';

// ── Types from the server ─────────────────────────────────────────────────────

export type PerGamePlayer = {
  id: string;
  name: string;
  jersey_number: number | null;
};

export type PerGameInfo = {
  id: string;            // games.id
  round: number;
  date: string;          // YYYY-MM-DD
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  homePlayers: PerGamePlayer[];
  awayPlayers: PerGamePlayer[];
};

export type PerGameStatRow = {
  player_id: string;
  game_id: string;
  points: number;
  three_pointers: number;
  fouls: number;
};

// ── Single editable row ──────────────────────────────────────────────────────

function PlayerRow({
  player,
  gameId,
  existing,
  onSaved,
}: {
  player: PerGamePlayer;
  gameId: string;
  existing: { points: number; three_pointers: number; fouls: number } | undefined;
  onSaved: (values: { points: number; three_pointers: number; fouls: number }) => void;
}) {
  const init = existing ?? { points: 0, three_pointers: 0, fouls: 0 };
  const [points,   setPoints]   = useState(String(init.points));
  const [threePt,  setThreePt]  = useState(String(init.three_pointers));
  const [fouls,    setFouls]    = useState(String(init.fouls));
  const [savedSnapshot, setSavedSnapshot] = useState(init);
  const [msg,      setMsg]      = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    points  !== String(savedSnapshot.points) ||
    threePt !== String(savedSnapshot.three_pointers) ||
    fouls   !== String(savedSnapshot.fouls);

  function save() {
    setMsg(null);
    const next = {
      points:         parseInt(points  || '0', 10),
      three_pointers: parseInt(threePt || '0', 10),
      fouls:          parseInt(fouls   || '0', 10),
    };
    startTransition(async () => {
      const res = await upsertPlayerGameStat({
        playerId:      player.id,
        gameId,
        points:        next.points,
        threePointers: next.three_pointers,
        fouls:         next.fouls,
      });
      if (res.error) {
        setMsg({ ok: false, text: res.error });
      } else {
        setMsg({ ok: true, text: '✓ נשמר' });
        setSavedSnapshot(next);
        onSaved(next);
      }
    });
  }

  return (
    <tr className="border-b border-white/[0.05] hover:bg-white/[0.02]">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{player.name}</span>
          {player.jersey_number !== null && (
            <span className="text-[10px] font-bold text-orange-400/70">#{player.jersey_number}</span>
          )}
        </div>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={points}
          onChange={e => setPoints(e.target.value.replace(/[^0-9]/g, ''))}
          className="w-14 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-sm text-white focus:outline-none focus:border-orange-500/50"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={threePt}
          onChange={e => setThreePt(e.target.value.replace(/[^0-9]/g, ''))}
          className="w-14 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-sm text-white focus:outline-none focus:border-orange-500/50"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={fouls}
          onChange={e => setFouls(e.target.value.replace(/[^0-9]/g, ''))}
          className="w-14 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-center text-sm text-white focus:outline-none focus:border-orange-500/50"
        />
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <button
          onClick={save}
          disabled={!dirty || pending}
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold py-1 px-3 rounded-lg transition-all"
        >
          {pending ? '...' : 'שמור'}
        </button>
        {msg && (
          <span className={`mr-2 text-[10px] font-bold ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Roster table (one team per game) ─────────────────────────────────────────

function RosterTable({
  teamName,
  players,
  gameId,
  statsByKey,
  onPlayerSaved,
}: {
  teamName: string;
  players: PerGamePlayer[];
  gameId: string;
  statsByKey: Record<string, { points: number; three_pointers: number; fouls: number }>;
  onPlayerSaved: (playerId: string, values: { points: number; three_pointers: number; fouls: number }) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
      <div className="px-3 py-2 bg-orange-500/[0.06] border-b border-white/[0.06]">
        <p className="text-sm font-black text-white">🛡️ {teamName}</p>
      </div>
      {players.length === 0 ? (
        <p className="text-xs text-[#5a7a9a] text-center py-6">לא נמצאו שחקנים לקבוצה</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-[#5a7a9a]">
              <tr>
                <th className="px-3 py-2 text-right">שחקן</th>
                <th className="px-2 py-2 text-center">נק׳</th>
                <th className="px-2 py-2 text-center">3נק׳</th>
                <th className="px-2 py-2 text-center">פאולים</th>
                <th className="px-2 py-2 text-right">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <PlayerRow
                  key={`${gameId}|${p.id}`}
                  player={p}
                  gameId={gameId}
                  existing={statsByKey[`${gameId}|${p.id}`]}
                  onSaved={values => onPlayerSaved(p.id, values)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Game card (two team rosters side-by-side on desktop, stacked on mobile) ──

function GameCard({
  game,
  statsByKey,
  open,
  onToggle,
}: {
  game: PerGameInfo;
  statsByKey: Record<string, { points: number; three_pointers: number; fouls: number }>;
  open: boolean;
  onToggle: () => void;
}) {
  const played = game.homeScore != null && game.awayScore != null;

  // Live per-player points map for this game — initialized from saved stats,
  // updated when a row saves successfully. Used to show running team totals.
  const [livePoints, setLivePoints] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const p of [...game.homePlayers, ...game.awayPlayers]) {
      m[p.id] = statsByKey[`${game.id}|${p.id}`]?.points ?? 0;
    }
    return m;
  });

  function handlePlayerSaved(playerId: string, values: { points: number; three_pointers: number; fouls: number }) {
    setLivePoints(prev => ({ ...prev, [playerId]: values.points }));
  }

  const homeTotal = game.homePlayers.reduce((s, p) => s + (livePoints[p.id] ?? 0), 0);
  const awayTotal = game.awayPlayers.reduce((s, p) => s + (livePoints[p.id] ?? 0), 0);

  const homeMatch = game.homeScore != null ? homeTotal === game.homeScore : null;
  const awayMatch = game.awayScore != null ? awayTotal === game.awayScore : null;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-l from-orange-500/10 to-transparent hover:from-orange-500/15 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-orange-400 text-sm transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="text-sm font-black text-white truncate">
            {game.homeTeamName} <span className="text-[#5a7a9a]">vs</span> {game.awayTeamName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {played ? (
            <span className="font-stats text-base font-black text-orange-400 tabular-nums">
              {game.homeScore} : {game.awayScore}
            </span>
          ) : (
            <span className="text-[10px] font-bold text-[#5a7a9a]">לא שוחק</span>
          )}
          <span className="text-[10px] font-bold text-[#5a7a9a]">·</span>
          <span className="text-[10px] font-bold text-[#5a7a9a]">{game.date}</span>
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <ScoreboardSummary
            homeTeamName={game.homeTeamName}
            awayTeamName={game.awayTeamName}
            homeTotal={homeTotal}
            awayTotal={awayTotal}
            officialHome={game.homeScore}
            officialAway={game.awayScore}
            homeMatch={homeMatch}
            awayMatch={awayMatch}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <RosterTable
            teamName={game.homeTeamName}
            players={game.homePlayers}
            gameId={game.id}
            statsByKey={statsByKey}
            onPlayerSaved={handlePlayerSaved}
          />
          <RosterTable
            teamName={game.awayTeamName}
            players={game.awayPlayers}
            gameId={game.id}
            statsByKey={statsByKey}
            onPlayerSaved={handlePlayerSaved}
          />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scoreboard summary: derived from saved player points ─────────────────────

function ScoreboardSummary({
  homeTeamName,
  awayTeamName,
  homeTotal,
  awayTotal,
  officialHome,
  officialAway,
  homeMatch,
  awayMatch,
}: {
  homeTeamName: string;
  awayTeamName: string;
  homeTotal: number;
  awayTotal: number;
  officialHome: number | null;
  officialAway: number | null;
  homeMatch: boolean | null;
  awayMatch: boolean | null;
}) {
  const hasOfficial = officialHome != null && officialAway != null;
  const allMatch = homeMatch === true && awayMatch === true;

  return (
    <div dir="rtl" className="rounded-xl border border-orange-500/15 bg-orange-500/[0.03] px-3 py-3 space-y-2">
      <div className="flex items-center justify-center gap-3 text-base font-black">
        <span className="truncate text-white">{homeTeamName}</span>
        <span className={`font-stats text-2xl tabular-nums ${homeMatch === false ? 'text-red-400' : 'text-orange-400'}`}>
          {homeTotal}
        </span>
        <span className="text-[#5a7a9a]">:</span>
        <span className={`font-stats text-2xl tabular-nums ${awayMatch === false ? 'text-red-400' : 'text-orange-400'}`}>
          {awayTotal}
        </span>
        <span className="truncate text-white">{awayTeamName}</span>
      </div>

      {hasOfficial ? (
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold">
          <span className="text-[#8aaac8]">תוצאה רשמית:</span>
          <span className="font-stats text-[#c8d8e8] tabular-nums">{officialHome} : {officialAway}</span>
          <span className={allMatch ? 'text-green-400' : 'text-red-400'}>
            {allMatch ? '✓ תואם' : '✗ לא תואם'}
          </span>
        </div>
      ) : (
        <p className="text-center text-[11px] font-bold text-[#5a7a9a]">
          סכום הנקודות של השחקנים מתעדכן עם כל שמירה
        </p>
      )}
    </div>
  );
}

// ── Tab root ─────────────────────────────────────────────────────────────────

export default function PerGameStatsTab({
  games,
  existingStats,
  initialRound,
}: {
  games: PerGameInfo[];
  existingStats: PerGameStatRow[];
  initialRound: number;
}) {
  const rounds = useMemo(
    () => [...new Set(games.map(g => g.round))].sort((a, b) => a - b),
    [games],
  );
  const [selectedRound, setSelectedRound] = useState<number>(initialRound);
  const [openGameId, setOpenGameId] = useState<string | null>(null);

  // Build O(1) lookup: "game_id|player_id" → stat row
  const statsByKey = useMemo(() => {
    const m: Record<string, { points: number; three_pointers: number; fouls: number }> = {};
    for (const s of existingStats) {
      m[`${s.game_id}|${s.player_id}`] = {
        points: s.points,
        three_pointers: s.three_pointers,
        fouls: s.fouls,
      };
    }
    return m;
  }, [existingStats]);

  const roundGames = useMemo(
    () => games.filter(g => g.round === selectedRound),
    [games, selectedRound],
  );

  return (
    <div dir="rtl" className="space-y-4 p-4">
      <div>
        <h2 className="text-xl font-black text-white">🏀 סטטיסטיקת משחקים לפי מחזור</h2>
        <p className="text-sm text-[#5a7a9a] mt-0.5">
          הזן סטטיסטיקות לכל שחקן בכל משחק. השמירה מעדכנת אוטומטית את הסיכום העונתי של השחקן.
        </p>
      </div>

      {/* Round picker */}
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-sm font-bold text-[#8aaac8]">מחזור:</label>
        <div className="flex flex-wrap gap-1.5">
          {rounds.map(r => (
            <button
              key={r}
              onClick={() => { setSelectedRound(r); setOpenGameId(null); }}
              className={`text-sm font-black rounded-lg px-3 py-1.5 transition-colors border ${
                r === selectedRound
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-white/[0.03] border-white/10 text-[#8aaac8] hover:border-orange-500/40 hover:text-orange-400'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Games of selected round */}
      <div className="space-y-3">
        {roundGames.length === 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] py-12 text-center text-[#5a7a9a]">
            אין משחקים במחזור {selectedRound}
          </div>
        )}
        {roundGames.map(g => (
          <GameCard
            key={g.id}
            game={g}
            statsByKey={statsByKey}
            open={openGameId === g.id}
            onToggle={() => setOpenGameId(prev => prev === g.id ? null : g.id)}
          />
        ))}
      </div>

      <p className="text-[11px] text-[#5a7a9a]">
        מציג {roundGames.length} משחקים במחזור {selectedRound}
      </p>
    </div>
  );
}
