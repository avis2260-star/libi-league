'use client';

import { Fragment, useMemo, useState } from 'react';
import { useLang } from '@/components/TranslationProvider';

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

const HEADER_H = 48;
const CARD_H   = 64;
const PAD_Y    = 4;
const GAP_X    = 40;

/* ── Team name helpers ──────────────────────────────────────────────── */
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
function sameTeam(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeName(a) === normalizeName(b);
}

function TeamLogo({ name, logos, size = 'sm' }: { name: string; logos: Record<string, string>; size?: 'sm' | 'md' | 'lg' }) {
  const url = findLogoUrl(name, logos);
  const cls = size === 'lg' ? 'h-10 w-10' : size === 'md' ? 'h-8 w-8' : 'h-6 w-6';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`${cls} shrink-0 rounded-full object-cover border border-white/10`} />;
  }
  return (
    <div className={`${cls} shrink-0 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[10px] font-black text-[#3a5a7a]`}>
      {[...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

/* ── Match card with focus/dim states ────────────────────────────────── */
function MatchCard({
  game, teamLogos, isFinal, focused, dimmed, focusedTeam, onClickTeam,
}: {
  game: CupGame; teamLogos: Record<string, string>; isFinal?: boolean;
  focused: boolean; dimmed: boolean; focusedTeam: string | null;
  onClickTeam: (name: string) => void;
}) {
  const { t, lang } = useLang();
  const en = lang === 'en';
  const winner = getWinner(game);
  const homeWin = winner === game.home_team;
  const awayWin = winner === game.away_team;

  const homeOnPath = focusedTeam ? sameTeam(game.home_team, focusedTeam) : false;
  const awayOnPath = focusedTeam ? sameTeam(game.away_team, focusedTeam) : false;

  return (
    <div className={`overflow-hidden rounded-xl border shadow-lg transition-all duration-300 ${
      focused
        ? 'border-orange-500/70 ring-2 ring-orange-500/40 shadow-[0_0_32px_rgba(255,121,56,0.35)] bg-[#0c1825]'
        : isFinal
          ? 'border-orange-500/40 ring-1 ring-orange-500/30 shadow-[0_0_40px_rgba(255,121,56,0.2)] bg-gradient-to-b from-orange-500/[0.05] to-[#0c1825]'
          : 'border-white/[0.07] bg-[#0c1825]'
    } ${dimmed ? 'opacity-25' : 'opacity-100'}`}>
      <button
        type="button"
        onClick={() => onClickTeam(game.home_team)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-right transition-colors ${
          homeOnPath ? 'bg-orange-500/25' : homeWin ? 'bg-orange-500/15' : ''
        } hover:bg-orange-500/20`}
      >
        {!isFinal && (
          <span
            className="shrink-0 inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-black bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
            title={t('משחק בית')}
            aria-label={t('בית')}
          >
            {en ? 'H' : 'ב'}
          </span>
        )}
        <TeamLogo name={game.home_team} logos={teamLogos} size={isFinal ? 'md' : 'sm'} />
        <span className={`flex-1 min-w-0 truncate font-bold ${isFinal ? 'text-sm' : 'text-xs'} ${
          homeOnPath ? 'text-orange-300' : homeWin ? 'text-orange-400' : game.played ? 'text-[#5a7a9a]' : 'text-white'
        }`}>
          {t(game.home_team)}
        </span>
        {game.played && game.home_score !== null && (
          <span className={`shrink-0 font-black tabular-nums ${isFinal ? 'text-base' : 'text-sm'} ${
            homeOnPath ? 'text-orange-300' : homeWin ? 'text-orange-400' : 'text-[#5a7a9a]'
          }`}>
            {game.home_score}
          </span>
        )}
      </button>
      <div className="h-px bg-white/[0.05]" />
      <button
        type="button"
        onClick={() => onClickTeam(game.away_team)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-right transition-colors ${
          awayOnPath ? 'bg-orange-500/25' : awayWin ? 'bg-orange-500/15' : ''
        } hover:bg-orange-500/20`}
      >
        {!isFinal && (
          <span
            className="shrink-0 inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-black bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25"
            title={t('משחק חוץ')}
            aria-label={t('חוץ')}
          >
            {en ? 'A' : 'ח'}
          </span>
        )}
        <TeamLogo name={game.away_team} logos={teamLogos} size={isFinal ? 'md' : 'sm'} />
        <span className={`flex-1 min-w-0 truncate font-bold ${isFinal ? 'text-sm' : 'text-xs'} ${
          awayOnPath ? 'text-orange-300' : awayWin ? 'text-orange-400' : game.played ? 'text-[#5a7a9a]' : 'text-white'
        }`}>
          {t(game.away_team)}
        </span>
        {game.played && game.away_score !== null && (
          <span className={`shrink-0 font-black tabular-nums ${isFinal ? 'text-base' : 'text-sm'} ${
            awayOnPath ? 'text-orange-300' : awayWin ? 'text-orange-400' : 'text-[#5a7a9a]'
          }`}>
            {game.away_score}
          </span>
        )}
      </button>
    </div>
  );
}

/* ── Connector with per-path highlight ───────────────────────────────── */
function SmoothConnector({
  fromCount, toCount, totalH, fromGames, toGames, focusedTeam,
}: {
  fromCount: number; toCount: number; totalH: number;
  fromGames: CupGame[]; toGames: CupGame[]; focusedTeam: string | null;
}) {
  const W = GAP_X;
  const gameAreaH = totalH - HEADER_H;
  const fromY = (i: number) => HEADER_H + gameAreaH * (2 * i + 1) / (2 * fromCount);
  const toY   = (j: number) => HEADER_H + gameAreaH * (2 * j + 1) / (2 * toCount);

  type Seg = { d: string; highlight: boolean };
  const segs: Seg[] = [];
  for (let j = 0; j < toCount; j++) {
    const yA = fromY(j * 2);
    const yB = fromY(j * 2 + 1);
    const yC = toY(j);
    const midX = W / 2;

    const gFromA = fromGames[j * 2];
    const gFromB = fromGames[j * 2 + 1];
    const gTo = toGames[j];

    const winnerA = gFromA ? getWinner(gFromA) : null;
    const winnerB = gFromB ? getWinner(gFromB) : null;

    const aHighlight = focusedTeam
      ? !!winnerA && sameTeam(winnerA, focusedTeam) && !!gTo && (sameTeam(gTo.home_team, focusedTeam) || sameTeam(gTo.away_team, focusedTeam))
      : false;
    const bHighlight = focusedTeam
      ? !!winnerB && sameTeam(winnerB, focusedTeam) && !!gTo && (sameTeam(gTo.home_team, focusedTeam) || sameTeam(gTo.away_team, focusedTeam))
      : false;

    segs.push({ d: `M 0 ${yA} C ${midX} ${yA} ${midX} ${yC} ${W} ${yC}`, highlight: aHighlight });
    segs.push({ d: `M 0 ${yB} C ${midX} ${yB} ${midX} ${yC} ${W} ${yC}`, highlight: bHighlight });
  }

  const hasFocus = !!focusedTeam;

  return (
    <svg width={W} height={totalH} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={`grad-${fromCount}-${toCount}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7aaac8" stopOpacity="0.2" />
          <stop offset="60%" stopColor="#ff7938" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ff7938" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`grad-hot-${fromCount}-${toCount}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff7938" stopOpacity="1" />
          <stop offset="100%" stopColor="#ff7938" stopOpacity="1" />
        </linearGradient>
      </defs>
      {segs.map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill="none"
          stroke={s.highlight ? `url(#grad-hot-${fromCount}-${toCount})` : `url(#grad-${fromCount}-${toCount})`}
          strokeWidth={s.highlight ? 2.5 : 1.5}
          strokeLinecap="round"
          style={{
            opacity: hasFocus ? (s.highlight ? 1 : 0.1) : 0.35,
            filter: s.highlight ? 'drop-shadow(0 0 6px rgba(255,121,56,0.6))' : undefined,
            transition: 'opacity 200ms, stroke-width 200ms',
          }}
        />
      ))}
    </svg>
  );
}

function RoundGap({ totalH }: { totalH: number }) {
  return (
    <svg width={20} height={totalH} className="shrink-0 overflow-visible" style={{ opacity: 0.08 }}>
      <line x1={10} y1={HEADER_H} x2={10} y2={totalH} stroke="#7aaac8" strokeWidth={1} strokeDasharray="4 4" />
    </svg>
  );
}

/* ── Round header ────────────────────────────────────────────────────── */
function RoundHeader({ label, date, allPlayed, isFinal, gamesLeft }: {
  label: string; date: string; allPlayed: boolean; isFinal: boolean; gamesLeft: number;
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center shrink-0 pb-2" style={{ height: HEADER_H }}>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-black uppercase tracking-widest ${isFinal ? 'text-orange-400' : 'text-[#e0c97a]'}`}>
          {isFinal ? '🏆 ' : ''}{t(label)}
        </span>
        {allPlayed ? (
          <span className="rounded-full bg-green-900/40 px-1.5 py-px text-[9px] font-bold text-green-400">✓</span>
        ) : (
          <span className="rounded-full bg-orange-900/30 px-1.5 py-px text-[9px] font-bold text-orange-400">●</span>
        )}
      </div>
      {date ? (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.06] px-2 py-px text-[10px] font-bold text-[#8aaac8]" dir="ltr">
          📅 {date}
        </span>
      ) : (
        <span className="mt-1 text-[10px] text-[#3a5a7a]">—</span>
      )}
      {isFinal && (
        <span className="mt-0.5 text-[9px] font-bold text-[#8aaac8]">{t('מגרש ניטרלי')}</span>
      )}
      {!isFinal && !allPlayed && gamesLeft > 0 && (
        <span className="mt-0.5 text-[9px] text-[#5a7a9a]">{gamesLeft} {t('משחקים נותרו')}</span>
      )}
    </div>
  );
}

/* ── Champion / TBD banners ──────────────────────────────────────────── */
function ChampionBanner({ teamName, teamLogos, dimmed }: { teamName: string; teamLogos: Record<string, string>; dimmed: boolean }) {
  const { t } = useLang();
  const url = teamLogos[teamName];
  return (
    <div className={`mt-2 flex flex-row items-center justify-center gap-4 rounded-2xl border-2 border-yellow-400/40 bg-gradient-to-b from-yellow-400/10 to-transparent px-6 py-4 shadow-[0_0_60px_rgba(250,204,21,0.15)] max-w-md mx-auto transition-opacity duration-300 ${dimmed ? 'opacity-30' : 'opacity-100'}`}>
      <div className="text-3xl">🏆</div>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={teamName} className="h-12 w-12 rounded-full border-2 border-yellow-400/50 object-cover shadow-lg shrink-0" />
      )}
      <div className="flex flex-col items-start">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#a08020]">{t('אלוף הגביע 2025–2026')}</p>
        <p className="text-lg font-black text-yellow-400">{t(teamName)}</p>
      </div>
    </div>
  );
}

function TBDBanner({ dimmed }: { dimmed: boolean }) {
  const { t } = useLang();
  return (
    <div className={`mt-2 flex flex-row items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#1e3a5f] bg-[#080f18]/60 px-6 py-3 max-w-md mx-auto transition-opacity duration-300 ${dimmed ? 'opacity-30' : 'opacity-100'}`}>
      <div className="text-2xl">🏆</div>
      <div className="flex flex-col items-start">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#3a5a7a]">{t('אלוף הגביע')}</p>
        <p className="text-sm font-bold text-[#2a4a6a]">{t('טרם נקבע — ממתין לגמר')}</p>
      </div>
    </div>
  );
}

/* ── Journey panel (side card with the focused team's run) ───────────── */
type JourneyStep = {
  round: string;
  game: CupGame;
  opponent: string;
  teamScore: number | null;
  oppScore: number | null;
  outcome: 'win' | 'loss' | 'upcoming';
  isHome: boolean;
};

function buildJourney(focusedTeam: string, games: CupGame[]): JourneyStep[] {
  const theirs = games
    .filter(g => sameTeam(g.home_team, focusedTeam) || sameTeam(g.away_team, focusedTeam))
    .sort((a, b) => a.round_order - b.round_order || a.game_number - b.game_number);

  return theirs.map(g => {
    const isHome = sameTeam(g.home_team, focusedTeam);
    const opponent = isHome ? g.away_team : g.home_team;
    const teamScore = isHome ? g.home_score : g.away_score;
    const oppScore  = isHome ? g.away_score : g.home_score;
    let outcome: JourneyStep['outcome'] = 'upcoming';
    if (g.played && teamScore !== null && oppScore !== null) {
      outcome = teamScore > oppScore ? 'win' : 'loss';
    }
    return { round: g.round, game: g, opponent, teamScore, oppScore, outcome, isHome };
  });
}

function JourneyPanel({
  focusedTeam, teamLogos, games, onClose,
}: {
  focusedTeam: string; teamLogos: Record<string, string>;
  games: CupGame[]; onClose: () => void;
}) {
  const { t, lang } = useLang();
  const en = lang === 'en';
  const steps = useMemo(() => buildJourney(focusedTeam, games), [focusedTeam, games]);
  const wins = steps.filter(s => s.outcome === 'win').length;
  const losses = steps.filter(s => s.outcome === 'loss').length;
  const upcoming = steps.find(s => s.outcome === 'upcoming');
  const eliminated = losses > 0;
  const lastPlayed = [...steps].filter(s => s.outcome !== 'upcoming').pop();

  // headline for the run
  let headline = '';
  if (eliminated && lastPlayed) {
    headline = en ? `Eliminated in ${t(lastPlayed.round)}` : `הודחה ב${lastPlayed.round}`;
  } else if (wins === 0 && upcoming) {
    headline = en ? `Starting in ${t(upcoming.round)}` : `מתחילה את הדרך ב${upcoming.round}`;
  } else if (upcoming) {
    headline = en ? `${wins} wins · heading to ${t(upcoming.round)}` : `${wins} ניצחונות · בדרך ל${upcoming.round}`;
  } else if (wins === steps.length && steps.length > 0) {
    headline = en ? `🏆 Cup Champion! ${wins} wins` : `🏆 אלופת הגביע! ${wins} ניצחונות`;
  }

  const logoUrl = findLogoUrl(focusedTeam, teamLogos);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-start sm:justify-start pointer-events-none" dir={en ? 'ltr' : 'rtl'}>
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity"
        aria-label={t('סגור')}
      />

      {/* Panel: bottom sheet on mobile, right side drawer on desktop */}
      <div className="relative sm:ms-auto w-full sm:w-[380px] max-h-full sm:h-full overflow-y-auto bg-[#0a1422] border-t-2 sm:border-t-0 sm:border-s-2 border-orange-500/40 shadow-2xl pointer-events-auto mt-auto sm:mt-0 rounded-t-2xl sm:rounded-none animate-[slideIn_300ms_ease-out]">
        <style>{`
          @keyframes slideIn {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          @media (min-width: 640px) {
            @keyframes slideIn {
              from { transform: translateX(-100%); }
              to   { transform: translateX(0); }
            }
          }
        `}</style>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-[#0a1422] via-[#0a1422] to-[#0a1422]/95 border-b border-white/[0.06]">
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={focusedTeam} className="h-14 w-14 rounded-full border-2 border-orange-500/50 object-cover shadow-lg shrink-0" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-[#1a2e45] border-2 border-orange-500/50 flex items-center justify-center text-lg font-black text-[#5a7a9a]">
                {[...focusedTeam].find(c => /\S/.test(c)) ?? '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">{t('מסע בגביע')}</p>
              <h3 className="text-lg font-black text-white truncate">{t(focusedTeam)}</h3>
              <p className="text-[11px] text-[#8aaac8] mt-0.5">{headline}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 h-8 w-8 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center justify-center"
              aria-label={t('סגור')}
            >
              ✕
            </button>
          </div>
          {/* mini stats */}
          <div className="flex gap-2 px-4 pb-3">
            <div className="flex-1 rounded-lg bg-green-900/20 border border-green-500/20 px-2 py-1.5 text-center">
              <p className="text-[9px] font-bold uppercase text-green-400/80">{t('ניצחונות')}</p>
              <p className="text-base font-black text-green-400 tabular-nums">{wins}</p>
            </div>
            <div className="flex-1 rounded-lg bg-red-900/20 border border-red-500/20 px-2 py-1.5 text-center">
              <p className="text-[9px] font-bold uppercase text-red-400/80">{t('הפסדים')}</p>
              <p className="text-base font-black text-red-400 tabular-nums">{losses}</p>
            </div>
            <div className="flex-1 rounded-lg bg-white/[0.03] border border-white/[0.08] px-2 py-1.5 text-center">
              <p className="text-[9px] font-bold uppercase text-[#5a7a9a]">{t('משחקים')}</p>
              <p className="text-base font-black text-white tabular-nums">{steps.length}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <ol className="relative px-4 py-4 space-y-3">
          {/* vertical line */}
          <div className="absolute top-4 bottom-4 end-[calc(1rem+11px)] w-px bg-gradient-to-b from-orange-500/60 via-orange-500/30 to-transparent" />

          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const color =
              step.outcome === 'win' ? 'text-green-400 border-green-500/40 bg-green-900/20'
              : step.outcome === 'loss' ? 'text-red-400 border-red-500/40 bg-red-900/20'
              : 'text-[#8aaac8] border-white/[0.1] bg-white/[0.03]';
            const icon =
              step.outcome === 'win' ? '✓'
              : step.outcome === 'loss' ? '✕'
              : '○';
            const label =
              step.outcome === 'win' ? t('ניצחון')
              : step.outcome === 'loss' ? t('הפסד')
              : t('עתידי');
            const opponentLogo = findLogoUrl(step.opponent, teamLogos);

            return (
              <li key={step.game.id} className="relative ps-10">
                {/* node */}
                <div className={`absolute end-0 top-1 h-[22px] w-[22px] rounded-full border-2 ${color} flex items-center justify-center text-[11px] font-black`}>
                  {icon}
                </div>

                {/* card */}
                <div className={`rounded-xl border px-3 py-2.5 ${
                  step.outcome === 'upcoming'
                    ? 'border-white/[0.08] bg-white/[0.02]'
                    : step.outcome === 'win'
                      ? 'border-green-500/20 bg-green-900/10'
                      : 'border-red-500/20 bg-red-900/10'
                } ${isLast && step.outcome === 'upcoming' ? 'ring-1 ring-orange-500/30' : ''}`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#e0c97a]">
                        {t(step.round)}
                      </span>
                      {step.round === 'גמר' ? (
                        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[9px] font-black ring-1 bg-white/[0.04] text-[#8aaac8] ring-white/[0.08]">
                          {t('מגרש ניטרלי')}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[9px] font-black ring-1 ${
                          step.isHome
                            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
                            : 'bg-sky-500/15 text-sky-300 ring-sky-500/25'
                        }`}>
                          {step.isHome ? t('בבית') : t('בחוץ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-black uppercase tracking-wider ${
                        step.outcome === 'win' ? 'text-green-400'
                        : step.outcome === 'loss' ? 'text-red-400'
                        : 'text-[#8aaac8]'
                      }`}>
                        {label}
                      </span>
                      {step.game.date && (
                        <span
                          dir="ltr"
                          className={`rounded-md px-2 py-0.5 text-sm font-black tabular-nums tracking-wide border ${
                            step.outcome === 'win'
                              ? 'bg-green-500/15 text-green-300 border-green-500/30'
                              : step.outcome === 'loss'
                                ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                          }`}
                        >
                          {step.game.date}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {opponentLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opponentLogo} alt={step.opponent} className="h-7 w-7 rounded-full object-cover border border-white/10 shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[11px] font-black text-[#3a5a7a] shrink-0">
                        {[...step.opponent].find(c => /\S/.test(c)) ?? '?'}
                      </div>
                    )}
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">
                      {step.outcome === 'upcoming' ? t('תפגוש את ') : t('מול ')}
                      {t(step.opponent)}
                    </span>
                    {step.outcome !== 'upcoming' && step.teamScore !== null && step.oppScore !== null && (
                      <span className="shrink-0 font-black tabular-nums text-sm" dir="ltr">
                        <span className={step.outcome === 'win' ? 'text-green-400' : 'text-red-400'}>{step.teamScore}</span>
                        <span className="text-[#5a7a9a] mx-1">–</span>
                        <span className="text-[#5a7a9a]">{step.oppScore}</span>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}

          {steps.length === 0 && (
            <li className="text-center text-[#5a7a9a] text-sm py-6">{t('אין משחקים לקבוצה זו')}</li>
          )}
        </ol>

        <div className="px-4 pb-5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-sm font-bold text-white py-2.5 transition-colors"
          >
            {t('חזרה לטורניר')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */
export default function JourneyBracket({ games, teamLogos }: { games: CupGame[]; teamLogos: Record<string, string> }) {
  const { t } = useLang();
  const [focusedTeam, setFocusedTeam] = useState<string | null>(null);

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="text-6xl">🏆</div>
        <h2 className="text-xl font-bold text-white">{t('טורניר הגביע')}</h2>
        <p className="text-[#5a7a9a] text-sm">{t('הנתונים יופיעו לאחר סנכרון קובץ האקסל')}</p>
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
  const bracketH = HEADER_H + maxGames * CARD_H + (maxGames + 1) * PAD_Y;

  // Is a given game on the focused team's path?
  function gameOnPath(g: CupGame): boolean {
    if (!focusedTeam) return false;
    return sameTeam(g.home_team, focusedTeam) || sameTeam(g.away_team, focusedTeam);
  }

  const championIsFocused = !!focusedTeam && !!champion && sameTeam(champion, focusedTeam);

  return (
    <>
      <div dir="ltr">
        <div className="overflow-x-auto pb-3">
          <div
            className="flex items-stretch"
            style={{ height: bracketH, minWidth: rounds.length * 220 + (rounds.length - 1) * GAP_X + 80 }}
          >
            {rounds.map((round, idx) => {
              const isFinal    = round.label === 'גמר';
              const allPlayed  = round.games.every(g => g.played);
              const gamesLeft  = round.games.filter(g => !g.played).length;
              const nextRound  = rounds[idx + 1];
              const cleanPair  = !!nextRound && nextRound.games.length * 2 === round.games.length;
              const colWidth   = isFinal ? 280 : 215;

              return (
                <Fragment key={round.order}>
                  <div className="flex flex-col" style={{ width: colWidth, minWidth: colWidth }}>
                    <RoundHeader
                      label={round.label}
                      date={round.games[0]?.date ?? ''}
                      allPlayed={allPlayed}
                      isFinal={isFinal}
                      gamesLeft={gamesLeft}
                    />
                    <div className="flex-1 flex flex-col justify-around px-1.5">
                      {round.games.map(game => {
                        const onPath = gameOnPath(game);
                        const dimmed = !!focusedTeam && !onPath;
                        return (
                          <MatchCard
                            key={game.id}
                            game={game}
                            teamLogos={teamLogos}
                            isFinal={isFinal}
                            focused={!!focusedTeam && onPath}
                            dimmed={dimmed}
                            focusedTeam={focusedTeam}
                            onClickTeam={(name) => setFocusedTeam(name)}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {idx < rounds.length - 1 && (
                    cleanPair
                      ? <SmoothConnector
                          fromCount={round.games.length}
                          toCount={nextRound.games.length}
                          totalH={bracketH}
                          fromGames={round.games}
                          toGames={nextRound.games}
                          focusedTeam={focusedTeam}
                        />
                      : <RoundGap totalH={bracketH} />
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

        {champion
          ? <ChampionBanner teamName={champion} teamLogos={teamLogos} dimmed={!!focusedTeam && !championIsFocused} />
          : <TBDBanner dimmed={!!focusedTeam} />
        }
      </div>

      {focusedTeam && (
        <JourneyPanel
          focusedTeam={focusedTeam}
          teamLogos={teamLogos}
          games={games}
          onClose={() => setFocusedTeam(null)}
        />
      )}
    </>
  );
}
