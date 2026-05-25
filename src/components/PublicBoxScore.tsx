// Read-only per-game box score: quarter breakdown + each team's player stats.
// Server component (uses native <details> for collapse — no client JS).
// Shared by the public /cup and /playoff series pages.

export type BoxPlayer = {
  name: string;
  jersey_number: number | null;
  points: number;
  three_pointers: number;
  fouls: number;
};

function sumPoints(players: BoxPlayer[]) {
  return players.reduce((s, p) => s + (p.points ?? 0), 0);
}

function PlayerTable({ teamName, players, en }: { teamName: string; players: BoxPlayer[]; en: boolean }) {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  const totals = sorted.reduce(
    (acc, p) => ({ pts: acc.pts + p.points, tp: acc.tp + p.three_pointers, f: acc.f + p.fouls }),
    { pts: 0, tp: 0, f: 0 },
  );
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 overflow-hidden">
      <div className="px-3 py-2 bg-orange-500/[0.06] border-b border-white/[0.06]">
        <p className="text-sm font-black text-white truncate">🛡️ {teamName || '—'}</p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-[#5a7a9a] text-center py-5">{en ? 'No stats recorded' : 'לא הוזנו נתונים'}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-[#5a7a9a]">
            <tr>
              <th className="px-3 py-1.5 text-right">{en ? 'Player' : 'שחקן'}</th>
              <th className="px-2 py-1.5 text-center">{en ? 'PTS' : 'נק׳'}</th>
              <th className="px-2 py-1.5 text-center">{en ? '3PT' : '3נק׳'}</th>
              <th className="px-2 py-1.5 text-center">{en ? 'PF' : 'פאולים'}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="px-3 py-1.5">
                  <span className="font-semibold text-white text-sm">{p.name}</span>
                  {p.jersey_number !== null && (
                    <span className="mr-1.5 text-[10px] font-bold text-orange-400/70">#{p.jersey_number}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center font-black text-white tabular-nums">{p.points}</td>
                <td className="px-2 py-1.5 text-center text-[#c0d4e8] tabular-nums">{p.three_pointers}</td>
                <td className="px-2 py-1.5 text-center text-[#c0d4e8] tabular-nums">{p.fouls}</td>
              </tr>
            ))}
            <tr className="bg-orange-500/[0.06] font-black">
              <td className="px-3 py-1.5 text-[#8aaac8] text-xs uppercase tracking-wide">{en ? 'Total' : 'סה״כ'}</td>
              <td className="px-2 py-1.5 text-center text-orange-400 tabular-nums">{totals.pts}</td>
              <td className="px-2 py-1.5 text-center text-orange-300 tabular-nums">{totals.tp}</td>
              <td className="px-2 py-1.5 text-center text-orange-300 tabular-nums">{totals.f}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function QuarterTable({
  homeTeamName, awayTeamName, homeQ, awayQ, en,
}: {
  homeTeamName: string; awayTeamName: string;
  homeQ: number[]; awayQ: number[]; en: boolean;
}) {
  const count = Math.max(homeQ.length, awayQ.length, 4);
  const label = (i: number) =>
    i < 4 ? (en ? `Q${i + 1}` : `ר${i + 1}`) : (en ? `OT${i - 3}` : `הא${i - 3}`);
  const cell = (arr: number[], i: number) => (arr[i] != null ? arr[i] : '–');
  const sum = (arr: number[]) => arr.reduce((s, n) => s + (n ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-black/20">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-[#5a7a9a]">
          <tr>
            <th className="px-3 py-1.5 text-right">{en ? 'Team' : 'קבוצה'}</th>
            {Array.from({ length: count }, (_, i) => (
              <th key={i} className="px-2 py-1.5 text-center">{label(i)}</th>
            ))}
            <th className="px-2 py-1.5 text-center">{en ? 'Total' : 'סה״כ'}</th>
          </tr>
        </thead>
        <tbody>
          {([[homeTeamName, homeQ], [awayTeamName, awayQ]] as const).map(([name, arr], r) => (
            <tr key={r} className="border-t border-white/[0.04]">
              <td className="px-3 py-1.5 font-bold text-white text-xs truncate max-w-[140px]">{name || '—'}</td>
              {Array.from({ length: count }, (_, i) => (
                <td key={i} className="px-2 py-1.5 text-center text-[#c0d4e8] tabular-nums">{cell(arr, i)}</td>
              ))}
              <td className="px-2 py-1.5 text-center font-black text-orange-400 tabular-nums">{sum(arr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PublicBoxScore({
  lang,
  gameLabel,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  homeQuarters,
  awayQuarters,
  homePlayers,
  awayPlayers,
  defaultOpen = false,
}: {
  lang: 'he' | 'en';
  gameLabel?: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  homeQuarters: number[] | null;
  awayQuarters: number[] | null;
  homePlayers: BoxPlayer[];
  awayPlayers: BoxPlayer[];
  defaultOpen?: boolean;
}) {
  const en = lang === 'en';
  const hasQuarters = (homeQuarters?.length ?? 0) > 0 || (awayQuarters?.length ?? 0) > 0;
  const hasPlayers = homePlayers.length > 0 || awayPlayers.length > 0;
  if (!hasQuarters && !hasPlayers) return null;

  // Fall back to player-points sum when an official score isn't stored.
  const hScore = homeScore ?? sumPoints(homePlayers);
  const aScore = awayScore ?? sumPoints(awayPlayers);

  return (
    <details open={defaultOpen} className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-white/[0.03] transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-orange-400 text-sm transition-transform group-open:rotate-90">▶</span>
          <span className="text-sm font-black text-white truncate">
            {gameLabel && <span className="text-[#8aaac8] font-bold ms-1">{gameLabel} · </span>}
            {homeTeamName} <span className="text-[#5a7a9a]">vs</span> {awayTeamName}
          </span>
        </div>
        <span className="shrink-0 font-stats text-base font-black text-orange-400 tabular-nums">
          {hScore} : {aScore}
        </span>
      </summary>

      <div className="p-3 space-y-3 border-t border-white/[0.06]">
        {hasQuarters && (
          <QuarterTable
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            homeQ={homeQuarters ?? []}
            awayQ={awayQuarters ?? []}
            en={en}
          />
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <PlayerTable teamName={homeTeamName} players={homePlayers} en={en} />
          <PlayerTable teamName={awayTeamName} players={awayPlayers} en={en} />
        </div>
      </div>
    </details>
  );
}
