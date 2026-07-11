// Read-only per-game box score: quarter breakdown + each team's player stats.
// Server component (uses native <details> for collapse — no client JS).
// Shared by the public /cup and /playoff series pages.

import type { ReactNode } from 'react';
import { displayName } from '@/lib/names';

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

function PlayerTable({
  teamName, players, en, isWinner, teamScore,
}: {
  teamName: string; players: BoxPlayer[]; en: boolean; isWinner: boolean; teamScore: number;
}) {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  const totals = sorted.reduce(
    (acc, p) => ({ pts: acc.pts + p.points, tp: acc.tp + p.three_pointers, f: acc.f + p.fouls }),
    { pts: 0, tp: 0, f: 0 },
  );
  // Top scorer = game star (only flag when they actually scored).
  const topPts = sorted.length ? sorted[0].points : 0;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-gradient-to-l from-orange-500/[0.16] to-orange-500/[0.03] border-b border-white/[0.07]">
        <p className="flex items-center gap-1.5 text-sm font-black text-white min-w-0 break-words">
          {isWinner && <span className="text-[#e0a030]" aria-hidden>👑</span>}
          {teamName ? displayName(teamName, en ? 'en' : 'he') : '—'}
        </p>
        <span className="shrink-0 font-stats text-lg font-black text-orange-400 tabular-nums">
          {teamScore}<span className="ms-1 text-[10px] font-bold text-[#7a9aba]">{en ? 'PTS' : 'נק׳'}</span>
        </span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-[#5a7a9a] text-center py-5">{en ? 'No stats recorded' : 'לא הוזנו נתונים'}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-[#6a86a4]">
            <tr>
              <th className="px-3 py-2 text-right">{en ? 'Player' : 'שחקן'}</th>
              <th className="px-2 py-2 text-center">{en ? 'PTS' : 'נק׳'}</th>
              <th className="px-2 py-2 text-center">{en ? '3PT' : '3נק׳'}</th>
              <th className="px-2 py-2 text-center">{en ? 'PF' : 'פאולים'}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isStar = i === 0 && topPts > 0;
              return (
                <tr
                  key={i}
                  className={`border-t border-white/[0.04] ${isStar ? 'bg-gradient-to-l from-orange-500/[0.20] to-orange-500/[0.04]' : ''}`}
                >
                  <td className="px-3 py-2">
                    <span className={`text-sm ${isStar ? 'font-black text-[#ffe6d2]' : 'font-semibold text-white'}`}>{displayName(p.name, en ? 'en' : 'he')}</span>
                    {p.jersey_number !== null && (
                      <span className="mr-1.5 text-[11px] font-bold text-orange-400/75">#{p.jersey_number}</span>
                    )}
                    {isStar && (
                      <span className="ms-2 inline-flex items-center gap-1 rounded-full border border-orange-400/55 bg-orange-400/25 px-2 py-px text-[10px] font-black text-[#ffd9b8] align-middle">
                        👑 {en ? 'MVP' : 'מצטיין'}
                      </span>
                    )}
                  </td>
                  <td className={`px-2 py-2 text-center font-black tabular-nums ${isStar ? 'text-orange-400' : 'text-white'}`}>{p.points}</td>
                  <td className="px-2 py-2 text-center text-[#c0d4e8] tabular-nums">{p.three_pointers}</td>
                  <td className="px-2 py-2 text-center text-[#c0d4e8] tabular-nums">{p.fouls}</td>
                </tr>
              );
            })}
            <tr className="bg-orange-500/[0.07] font-black border-t border-white/[0.06]">
              <td className="px-3 py-2 text-[#8aaac8] text-xs uppercase tracking-wide">{en ? 'Total' : 'סה״כ'}</td>
              <td className="px-2 py-2 text-center text-orange-400 tabular-nums">{totals.pts}</td>
              <td className="px-2 py-2 text-center text-orange-300 tabular-nums">{totals.tp}</td>
              <td className="px-2 py-2 text-center text-orange-300 tabular-nums">{totals.f}</td>
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
  const cell = (arr: number[], i: number) => (arr[i] != null ? arr[i] : null);
  const sum = (arr: number[]) => arr.reduce((s, n) => s + (n ?? 0), 0);
  const rows = [
    { name: homeTeamName, arr: homeQ, other: awayQ },
    { name: awayTeamName, arr: awayQ, other: homeQ },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/20">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-[#6a86a4]">
          <tr>
            <th className="px-3 py-2 text-right">{en ? 'Team' : 'קבוצה'}</th>
            {Array.from({ length: count }, (_, i) => (
              <th key={i} className="px-2 py-2 text-center">{label(i)}</th>
            ))}
            <th className="px-2 py-2 text-center">{en ? 'Total' : 'סה״כ'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-white/[0.04]">
              <td className="px-3 py-2 font-black text-white text-xs truncate max-w-[150px]">{row.name ? displayName(row.name, en ? 'en' : 'he') : '—'}</td>
              {Array.from({ length: count }, (_, i) => {
                const v = cell(row.arr, i);
                const ov = cell(row.other, i);
                const wonQ = v != null && ov != null && v > ov;
                return (
                  <td
                    key={i}
                    className={`px-2 py-2 text-center tabular-nums ${wonQ ? 'font-black text-white bg-orange-500/[0.13]' : 'text-[#c0d4e8]'}`}
                  >
                    {v != null ? v : '–'}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-center font-black text-orange-400 tabular-nums text-[15px]">{sum(row.arr)}</td>
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
  award,
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
  /** award mark shown in the summary bar (e.g. <PlayoffPlate /> for playoffs, 🏆 for cup) */
  award?: ReactNode;
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
  const homeWon = hScore > aScore;
  const awayWon = aScore > hScore;

  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-orange-500/20 bg-gradient-to-br from-[#0f1e2e] to-[#0b1520] overflow-hidden shadow-[0_0_40px_rgba(249,115,22,0.06)]"
    >
      <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-white/[0.03] transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-orange-400 text-sm transition-transform group-open:rotate-90" aria-hidden>▶</span>
          {award && <span className="shrink-0 inline-flex items-center" aria-hidden>{award}</span>}
          <span className="text-sm font-black text-white min-w-0 break-words">
            {gameLabel && <span className="text-[#8aaac8] font-bold ms-1">{gameLabel} · </span>}
            {displayName(homeTeamName, en ? 'en' : 'he')} <span className="text-[#5a7a9a]">vs</span> {displayName(awayTeamName, en ? 'en' : 'he')}
          </span>
        </div>
        <span className="shrink-0 font-stats text-base font-black tabular-nums">
          <span className={homeWon ? 'text-orange-400' : 'text-white'}>{hScore}</span>
          <span className="text-[#34557a]"> : </span>
          <span className={awayWon ? 'text-orange-400' : 'text-white'}>{aScore}</span>
        </span>
      </summary>

      <div className="p-3 space-y-3 border-t border-orange-500/[0.12]">
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
          <PlayerTable teamName={homeTeamName} players={homePlayers} en={en} isWinner={homeWon} teamScore={hScore} />
          <PlayerTable teamName={awayTeamName} players={awayPlayers} en={en} isWinner={awayWon} teamScore={aScore} />
        </div>
      </div>
    </details>
  );
}
