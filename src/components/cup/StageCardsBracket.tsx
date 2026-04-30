'use client';

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

function TeamLogo({ name, logos, size = 'sm' }: { name: string; logos: Record<string, string>; size?: 'sm' | 'md' | 'lg' }) {
  const url = findLogoUrl(name, logos);
  const cls = size === 'lg' ? 'h-12 w-12' : size === 'md' ? 'h-9 w-9' : 'h-7 w-7';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`${cls} shrink-0 rounded-full object-cover border border-white/10`} />;
  }
  return (
    <div className={`${cls} shrink-0 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[11px] font-black text-[#3a5a7a]`}>
      {[...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

/* ── A compact match card — two-row layout, score on outside ─────────── */
function MatchCard({ game, teamLogos }: { game: CupGame; teamLogos: Record<string, string> }) {
  const { t, lang } = useLang();
  const en = lang === 'en';
  const winner = getWinner(game);
  const homeWin = winner === game.home_team;
  const awayWin = winner === game.away_team;

  const Row = ({ name, score, isWinner, placeholder, isHome }: { name: string; score: number | null; isWinner: boolean; placeholder: boolean; isHome: boolean }) => (
    <div className={`flex items-center gap-2 px-3 py-2 ${isWinner ? 'bg-orange-500/15' : ''}`}>
      <span
        className={`shrink-0 inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-black ring-1 ${
          isHome
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
            : 'bg-sky-500/15 text-sky-300 ring-sky-500/25'
        }`}
        title={isHome ? t('משחק בית') : t('משחק חוץ')}
        aria-label={isHome ? t('בית') : t('חוץ')}
      >
        {en ? (isHome ? 'H' : 'A') : (isHome ? 'ב' : 'ח')}
      </span>
      <TeamLogo name={name} logos={teamLogos} />
      <span className={`flex-1 min-w-0 truncate text-xs font-bold ${isWinner ? 'text-orange-400' : placeholder ? 'text-[#5a7a9a]' : 'text-white'}`}>
        {t(name)}
      </span>
      {score !== null && (
        <span className={`shrink-0 font-black tabular-nums text-sm ${isWinner ? 'text-orange-400' : 'text-[#5a7a9a]'}`}>
          {score}
        </span>
      )}
      {isWinner && <span className="text-orange-400 text-xs shrink-0">✓</span>}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0c1825] shadow-lg">
      <Row name={game.home_team} score={game.home_score} isWinner={homeWin} placeholder={game.played && !homeWin} isHome />
      <div className="h-px bg-white/[0.05]" />
      <Row name={game.away_team} score={game.away_score} isWinner={awayWin} placeholder={game.played && !awayWin} isHome={false} />
    </div>
  );
}

/* ── Featured final card (big, centered) ─────────────────────────────── */
function FinalCard({ game, teamLogos }: { game: CupGame; teamLogos: Record<string, string> }) {
  const { t } = useLang();
  const winner = getWinner(game);
  const homeWin = winner === game.home_team;
  const awayWin = winner === game.away_team;

  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border-2 border-orange-500/30 bg-gradient-to-b from-orange-500/[0.06] to-transparent shadow-[0_0_50px_rgba(255,121,56,0.12)]">
      <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500/10 border-b border-orange-500/20">
        <span className="text-lg">🏆</span>
        <span className="text-[11px] font-black uppercase tracking-widest text-orange-400">
          {t('הגמר')} · {game.date || t('תאריך טרם נקבע')} · {t('מגרש ניטרלי')}
        </span>
      </div>
      <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3 px-5 py-5">
        {/* Home team (right in RTL). Final is played on a neutral court so we
            don't show a בית/חוץ badge here. */}
        <div className={`flex flex-col items-center gap-2 ${homeWin ? 'text-orange-400' : 'text-white'}`}>
          <TeamLogo name={game.home_team} logos={teamLogos} size="lg" />
          <span className="text-sm font-black text-center">{t(game.home_team)}</span>
          {homeWin && <span className="text-[10px] font-bold text-orange-400">🏆 {t('אלוף')}</span>}
        </div>

        {/* Score / vs */}
        <div className="flex flex-col items-center gap-1 shrink-0" dir="ltr">
          {game.played && game.home_score !== null && game.away_score !== null ? (
            <div className="flex items-center gap-2 font-stats">
              <span className={`text-2xl font-black tabular-nums ${homeWin ? 'text-orange-400' : 'text-[#5a7a9a]'}`}>{game.home_score}</span>
              <span className="text-[#5a7a9a] font-black">–</span>
              <span className={`text-2xl font-black tabular-nums ${awayWin ? 'text-orange-400' : 'text-[#5a7a9a]'}`}>{game.away_score}</span>
            </div>
          ) : (
            <span className="text-2xl font-black text-[#5a7a9a]">VS</span>
          )}
        </div>

        {/* Away team (left in RTL). Neutral-court final — no בית/חוץ badge. */}
        <div className={`flex flex-col items-center gap-2 ${awayWin ? 'text-orange-400' : 'text-white'}`}>
          <TeamLogo name={game.away_team} logos={teamLogos} size="lg" />
          <span className="text-sm font-black text-center">{t(game.away_team)}</span>
          {awayWin && <span className="text-[10px] font-bold text-orange-400">🏆 {t('אלוף')}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Round section header ────────────────────────────────────────────── */
function RoundHeader({ label, date, count, allPlayed, isFinal }: {
  label: string; date: string; count: number; allPlayed: boolean; isFinal: boolean;
}) {
  const { t, lang } = useLang();
  const en = lang === 'en';
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border ${
      isFinal ? 'border-orange-500/30 bg-orange-500/[0.05]' : 'border-white/[0.07] bg-white/[0.03]'
    }`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`text-xs font-black uppercase tracking-widest ${isFinal ? 'text-orange-400' : 'text-[#e0c97a]'}`}>
          {isFinal ? '🏆 ' : ''}{t(label)}
        </span>
        {allPlayed ? (
          <span className="rounded-full bg-green-900/40 px-1.5 py-px text-[10px] font-bold text-green-400">{t('הושלם ✓')}</span>
        ) : (
          <span className="rounded-full bg-orange-900/30 px-1.5 py-px text-[10px] font-bold text-orange-400">{t('● פעיל')}</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] font-bold text-[#5a7a9a] shrink-0">
        {date && (
          <span className="inline-flex items-center gap-1" dir="ltr">
            📅 {date}
          </span>
        )}
        <span>{count} {en ? (count === 1 ? 'game' : 'games') : (count === 1 ? 'משחק' : 'משחקים')}</span>
      </div>
    </div>
  );
}

/* ── Champion / TBD banner ───────────────────────────────────────────── */
function ChampionBanner({ teamName, teamLogos }: { teamName: string; teamLogos: Record<string, string> }) {
  const { t } = useLang();
  const url = teamLogos[teamName];
  return (
    <div className="mt-2 flex flex-row items-center justify-center gap-4 rounded-2xl border-2 border-yellow-400/40 bg-gradient-to-b from-yellow-400/10 to-transparent px-6 py-4 shadow-[0_0_60px_rgba(250,204,21,0.15)] max-w-md mx-auto">
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

function TBDBanner() {
  const { t } = useLang();
  return (
    <div className="mt-2 flex flex-row items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#1e3a5f] bg-[#080f18]/60 px-6 py-3 max-w-md mx-auto">
      <div className="text-2xl">🏆</div>
      <div className="flex flex-col items-start">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#3a5a7a]">{t('אלוף הגביע')}</p>
        <p className="text-sm font-bold text-[#2a4a6a]">{t('טרם נקבע — ממתין לגמר')}</p>
      </div>
    </div>
  );
}

/* ── Grid class chooser — centers 3-game rounds (like quarter-finals) ── */
function gridClassForCount(count: number): string {
  if (count >= 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  if (count === 3) return 'grid-cols-1 sm:grid-cols-3 max-w-3xl mx-auto';
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto';
  return 'grid-cols-1 max-w-md mx-auto';
}

/* ── Main component ──────────────────────────────────────────────────── */
export default function StageCardsBracket({ games, teamLogos }: { games: CupGame[]; teamLogos: Record<string, string> }) {
  const { t } = useLang();
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

  return (
    <div className="space-y-3">
      {rounds.map(round => {
        const isFinal = round.label === 'גמר';
        const date = round.games[0]?.date ?? '';
        const allPlayed = round.games.every(g => g.played);

        return (
          <section key={round.order} className="space-y-2">
            <RoundHeader
              label={round.label}
              date={date}
              count={round.games.length}
              allPlayed={allPlayed}
              isFinal={isFinal}
            />

            {isFinal ? (
              <FinalCard game={round.games[0]} teamLogos={teamLogos} />
            ) : (
              <div className={`grid gap-2 ${gridClassForCount(round.games.length)}`}>
                {round.games.map(game => (
                  <MatchCard key={game.id} game={game} teamLogos={teamLogos} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {champion ? <ChampionBanner teamName={champion} teamLogos={teamLogos} /> : <TBDBanner />}
    </div>
  );
}
