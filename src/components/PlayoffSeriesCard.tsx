'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/TranslationProvider';

export type RosterPlayer = { name: string; jersey_number: number | null };

type Series = {
  series_number: number; team_a: string; team_a_label: string;
  team_b: string; team_b_label: string;
};
type Game = {
  series_number: number; game_number: number;
  home_score: number | null; away_score: number | null;
  played: boolean; game_date: string | null;
};

function normName(n: string) {
  return n.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function findLogo(name: string, logos: Record<string, string>) {
  return logos[name] ?? Object.entries(logos).find(([k]) => normName(k) === normName(name))?.[1];
}

function TeamLogo({ name, logos, size = 'md' }: { name: string; logos: Record<string, string>; size?: 'sm' | 'md' | 'lg' }) {
  const url = findLogo(name, logos);
  const sz = size === 'lg' ? 'h-16 w-16 text-2xl' : size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-11 w-11 text-xs';
  if (url) return <img src={url} alt={name} className={`${sz} shrink-0 rounded-full object-cover border-2 border-white/10 shadow-md`} />;
  return (
    <div className={`${sz} shrink-0 rounded-full bg-[#1a2e45] border-2 border-white/10 flex items-center justify-center font-black text-[#3a5a7a]`}>
      {[...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

function parseLabel(label: string, lang: 'he' | 'en' = 'he') {
  const isNorth = label.includes('צפון') || /north/i.test(label);
  const isSouth = label.includes('דרום') || /south/i.test(label);
  const hasEmoji = /[\u{1F300}-\u{1FFFF}]/u.test(label);
  const emoji = hasEmoji ? '' : (isNorth ? '🔵' : isSouth ? '🟠' : '');
  const divName = lang === 'en'
    ? (isNorth ? 'North' : isSouth ? 'South' : '')
    : (isNorth ? 'צפון' : isSouth ? 'דרום' : '');
  const seed = label.match(/#(\d+)/)?.[1] ?? '';
  // Handle "winner of series N" pattern
  const winnerOf = label.match(/נצח סדרה\s+(\d+)/);
  if (winnerOf) {
    return { emoji: '', divName: '', seed: '',
      full: lang === 'en' ? `Winner Series ${winnerOf[1]}` : `נצח סדרה ${winnerOf[1]}` };
  }
  return { emoji, divName, seed, full: `${emoji} ${divName}${seed ? ` #${seed}` : ''}`.trim() || label };
}

function homeForGame(s: Series, gNum: number) { return gNum === 2 ? s.team_b : s.team_a; }

function seriesScore(s: Series, games: Game[]) {
  let winsA = 0, winsB = 0;
  for (const g of games.filter(g => g.series_number === s.series_number && g.played)) {
    const home = homeForGame(s, g.game_number);
    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
    if ((homeWon && home === s.team_a) || (!homeWon && home !== s.team_a)) winsA++;
    else winsB++;
  }
  return { winsA, winsB, winner: winsA >= 2 ? s.team_a : winsB >= 2 ? s.team_b : null };
}

function GameDots({ series, allGames }: { series: Series; allGames: Game[] }) {
  const seriesGames = allGames.filter(g => g.series_number === series.series_number);
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {[1, 2, 3].map(gNum => {
        const g = seriesGames.find(g => g.game_number === gNum);
        const played = g?.played && g.home_score !== null && g.away_score !== null;
        const home = homeForGame(series, gNum);
        const homeWon = played && (g!.home_score! > g!.away_score!);
        const aWon = played && ((homeWon && home === series.team_a) || (!homeWon && home !== series.team_a));
        return (
          <div key={gNum} className="flex flex-col items-center gap-0.5">
            <div className={`h-2 w-2 rounded-full ${!played ? 'border border-white/[0.12] bg-transparent' : aWon ? 'bg-orange-400' : 'bg-[#4a6a8a]'}`} />
            <span className="text-[8px] text-[#2a4a6a]">{gNum}</span>
          </div>
        );
      })}
    </div>
  );
}

function RosterList({ roster, teamName }: { roster: RosterPlayer[]; teamName: string }) {
  const { t } = useLang();
  if (!roster.length) return (
    <p className="text-xs text-[#3a5a7a] text-center py-2">{t('לא נמצאו שחקנים')}</p>
  );
  return (
    <ul className="space-y-1">
      {roster.map((p, i) => (
        <li key={i} className="flex items-center gap-2">
          {p.jersey_number !== null && (
            <span className="w-6 shrink-0 text-[10px] font-black text-orange-400/70 text-center font-stats">{p.jersey_number}</span>
          )}
          <span className="text-xs text-[#c8d8e8] truncate font-heading">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PlayoffSeriesCard({
  series,
  allGames,
  teamLogos,
  roundLabel,
  isFinal = false,
  champion,
  rosterA = [],
  rosterB = [],
}: {
  series: Series | null;
  allGames: Game[];
  teamLogos: Record<string, string>;
  roundLabel: string;
  isFinal?: boolean;
  champion?: string | null;
  rosterA?: RosterPlayer[];
  rosterB?: RosterPlayer[];
}) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const { t, lang } = useLang();
  const hasTeams = !!(series?.team_a?.trim()) && !!(series?.team_b?.trim());
  const hasRosters = rosterA.length > 0 || rosterB.length > 0;

  /* ── Placeholder (no teams yet) ── */
  if (!series || !hasTeams) {
    const lA = series?.team_a_label ? parseLabel(series.team_a_label, lang) : null;
    const lB = series?.team_b_label ? parseLabel(series.team_b_label, lang) : null;
    return (
      <div className={`rounded-2xl border overflow-hidden ${isFinal ? 'border-yellow-400/20 bg-[#0f1c2a]' : 'border-white/[0.08] bg-[#0c1825]'}`}>
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isFinal ? 'border-yellow-400/10' : 'border-white/[0.05]'}`}>
          <span className={`text-[11px] font-black tracking-widest uppercase ${isFinal ? 'text-yellow-400' : 'text-[#4a6a8a]'}`}>{roundLabel}</span>
          {series && <span className="text-[10px] text-[#2a4a6a] font-semibold">· {t('סדרה')} {series.series_number}</span>}
          <span className="rounded-full bg-white/[0.04] border border-white/[0.07] px-2.5 py-0.5 text-[10px] font-black text-[#3a5a7a]">{t('טרם נקבע')}</span>
        </div>
        <div className="px-3 sm:px-6 py-4 sm:py-5 flex items-center gap-2 sm:gap-4">
          <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
            <div className="h-11 w-11 rounded-full bg-[#1a2e45] border-2 border-white/[0.07] flex items-center justify-center text-[#2a4a6a] text-lg font-black">?</div>
            {lA && <p className="text-[10px] text-[#1e3a5f] text-center">{lA.full}</p>}
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0 px-1">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <span className="text-3xl sm:text-5xl font-black text-[#1a2e45] tabular-nums leading-none">–</span>
              <span className="text-base sm:text-lg text-[#1a2e45] font-black leading-none">:</span>
              <span className="text-3xl sm:text-5xl font-black text-[#1a2e45] tabular-nums leading-none">–</span>
            </div>
            {!isFinal && <p className="text-[8px] sm:text-[9px] text-[#1e3a5f] tracking-widest uppercase font-bold mt-0.5">{t('הטוב מ-3')}</p>}
          </div>
          <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
            <div className="h-11 w-11 rounded-full bg-[#1a2e45] border-2 border-white/[0.07] flex items-center justify-center text-[#2a4a6a] text-lg font-black">?</div>
            {lB && <p className="text-[10px] text-[#1e3a5f] text-center">{lB.full}</p>}
          </div>
        </div>
      </div>
    );
  }

  const { winsA, winsB, winner } = seriesScore(series, allGames);
  const aWon = winner === series.team_a;
  const bWon = winner === series.team_b;
  const started = winsA > 0 || winsB > 0;
  const lA = parseLabel(series.team_a_label, lang);
  const lB = parseLabel(series.team_b_label, lang);

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-lg ${
      isFinal
        ? 'border-orange-500/30 shadow-[0_0_40px_rgba(255,121,56,0.1)] bg-gradient-to-br from-[#0f1e2e] via-[#0c1825] to-[#0f2030]'
        : 'border-white/[0.07] bg-gradient-to-br from-[#0c1825] to-[#0b1520]'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isFinal ? 'border-orange-500/15 bg-orange-500/[0.05]' : 'border-white/[0.05]'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-black tracking-widest uppercase ${isFinal ? 'text-yellow-400' : 'text-[#4a6a8a]'}`}>{roundLabel}</span>
          <span className="text-[10px] text-[#2a4a6a] font-semibold">· {t('סדרה')} {series.series_number}</span>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ${
          winner
            ? 'bg-green-500/15 border border-green-500/30 text-green-400'
            : !started ? 'bg-white/[0.05] border border-white/[0.08] text-[#3a5a7a]'
            : winsA === winsB ? 'bg-yellow-400/10 border border-yellow-400/25 text-yellow-400'
            : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
        }`}>
          {winner ? 'FINAL' : !started ? t('טרם החל') : winsA === winsB ? t('שוויון') : `${t('מוביל')}: ${t(winsA > winsB ? series.team_a : series.team_b)}`}
        </span>
      </div>

      {/* Link to series detail */}
      <Link href={`/playoff/series/${series.series_number}`} className="block hover:opacity-90 transition-opacity">
        {/* Scoreboard */}
        <div className="px-3 sm:px-6 py-4 sm:py-5 flex items-center gap-2 sm:gap-4">
          <div className={`flex-1 min-w-0 flex flex-col items-center gap-1.5 transition-opacity ${bWon ? 'opacity-35' : ''}`}>
            <TeamLogo name={series.team_a} logos={teamLogos} size="md" />
            <div className="text-center w-full px-1">
              <p className={`text-xs sm:text-sm font-black leading-tight break-words font-heading ${aWon ? 'text-orange-400' : 'text-white'}`}>{t(series.team_a)}</p>
              <p className="text-[9px] text-[#4a6a8a] mt-0.5 font-semibold font-body">{lA.full}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0 px-1">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <span className={`text-3xl sm:text-5xl font-black tabular-nums leading-none font-stats ${aWon ? 'text-orange-400' : started ? 'text-white' : 'text-[#1e3a5f]'}`}>
                {started ? winsA : '–'}
              </span>
              <span className="text-base sm:text-lg text-[#1e3a5f] font-black leading-none">:</span>
              <span className={`text-3xl sm:text-5xl font-black tabular-nums leading-none font-stats ${bWon ? 'text-orange-400' : started ? 'text-white' : 'text-[#1e3a5f]'}`}>
                {started ? winsB : '–'}
              </span>
            </div>
            {!isFinal && (
              <p className="text-[8px] sm:text-[9px] text-[#2a4a6a] tracking-widest uppercase font-bold mt-0.5">
                {started ? t('ניצחונות') : t('הטוב מ-3')}
              </p>
            )}
            <GameDots series={series} allGames={allGames} />
          </div>

          <div className={`flex-1 min-w-0 flex flex-col items-center gap-1.5 transition-opacity ${aWon ? 'opacity-35' : ''}`}>
            <TeamLogo name={series.team_b} logos={teamLogos} size="md" />
            <div className="text-center w-full px-1">
              <p className={`text-xs sm:text-sm font-black leading-tight break-words font-heading ${bWon ? 'text-orange-400' : 'text-white'}`}>{t(series.team_b)}</p>
              <p className="text-[9px] text-[#4a6a8a] mt-0.5 font-semibold font-body">{lB.full}</p>
            </div>
          </div>
        </div>

        {/* Winner strip */}
        {winner && (
          <div className="border-t border-green-500/15 bg-green-500/[0.05] px-4 py-2 text-center">
            <span className="text-[11px] font-black text-green-400">🏆 {t(winner)} {t('ניצח בסדרה')}</span>
          </div>
        )}
      </Link>

      {/* Roster toggle */}
      {hasRosters && (
        <div className="border-t border-white/[0.05]">
          <button
            onClick={() => setRosterOpen(o => !o)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold text-[#5a7a9a] hover:text-orange-400 hover:bg-white/[0.02] transition-colors"
          >
            <span className={`transition-transform duration-200 ${rosterOpen ? 'rotate-180' : ''}`}>▾</span>
            {rosterOpen ? t('הסתר הרכבים') : t('הצג הרכבים')}
          </button>

          {rosterOpen && (
            <div className="animate-roster-in border-t border-white/[0.04] px-4 py-4">
              <div className="grid grid-cols-2 gap-4 divide-x divide-x-reverse divide-white/[0.05]">
                {/* Team A roster */}
                <div className="pr-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#3a5a7a] mb-2">
                    {t(series.team_a)}
                  </p>
                  <RosterList roster={rosterA} teamName={series.team_a} />
                </div>
                {/* Team B roster */}
                <div className="pl-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#3a5a7a] mb-2">
                    {t(series.team_b)}
                  </p>
                  <RosterList roster={rosterB} teamName={series.team_b} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
