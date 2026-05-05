export const dynamic = 'force-dynamic';

import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlayerById, getPlayerGameStats } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { GameStatWithGame, Position } from '@/types';
import VideoGallery from '@/components/player/VideoGallery';
import PlayerStatsChart from '@/components/player/PlayerStatsChart';
import { getLang, st } from '@/lib/get-lang';

// ── Position metadata ─────────────────────────────────────────────────────────

const POSITION_META: Record<
  Position,
  { he: string; en: string; color: string; bg: string }
> = {
  PG: { he: 'פוינט גארד',    en: 'Point Guard',    color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/30' },
  SG: { he: 'שוטינג גארד',   en: 'Shooting Guard', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  SF: { he: 'סמול פורוורד',  en: 'Small Forward',  color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/30' },
  PF: { he: 'פאואר פורוורד', en: 'Power Forward',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  C:  { he: 'סנטר',          en: 'Center',          color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(total: number, games: number): string {
  if (games === 0) return '—';
  return (total / games).toFixed(1);
}

function getOpponent(stat: GameStatWithGame, teamId: string) {
  const g = stat.game;
  return g.home_team_id === teamId ? g.away_team : g.home_team;
}

function getResult(stat: GameStatWithGame, teamId: string): 'W' | 'L' | 'D' | null {
  const { game } = stat;
  // Treat any game with non-zero scores as completed even if its status
  // wasn't flipped to 'Finished' yet.
  if (game.status !== 'Finished' && (game.home_score + game.away_score) === 0) return null;
  const isHome = game.home_team_id === teamId;
  const myScore = isHome ? game.home_score : game.away_score;
  const theirScore = isHome ? game.away_score : game.home_score;
  if (myScore > theirScore) return 'W';
  if (myScore < theirScore) return 'L';
  return 'D';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [player, gameStats, lang] = await Promise.all([
    getPlayerById(id),
    getPlayerGameStats(id),
    getLang(),
  ]);
  const T = (he: string) => st(he, lang);

  if (!player) notFound();

  // ── Game count ────────────────────────────────────────────────────────────
  // A player has "played" a game whenever there's a game_stats row for them,
  // regardless of whether the parent game's status is still 'Scheduled'.
  // Admins often forget to flip status to 'Finished' after entering scores;
  // gating gamesPlayed on Finished caused averages to render as 0 even when
  // the season totals (in the players table) showed real numbers.
  let gamesPlayed = gameStats.length;

  // Fallback for old submissions approved before game_stats rows were written:
  // count approved submissions where this player appears in extracted_stats
  if (gamesPlayed === 0) {
    const { data: subs } = await supabaseAdmin
      .from('game_submissions')
      .select('extracted_stats')
      .eq('status', 'approved');

    gamesPlayed = (subs ?? []).filter((sub) => {
      const s = sub.extracted_stats as {
        home_players?: { name?: string }[];
        away_players?: { name?: string }[];
      } | null;
      const all = [...(s?.home_players ?? []), ...(s?.away_players ?? [])];
      return all.some(
        (p) => p.name && p.name.trim().toLowerCase() === player.name.trim().toLowerCase(),
      );
    }).length;
  }

  // ── Season totals (players table is source of truth) ─────────────────────
  const totalPts   = (player.points         > 0) ? player.points         : gameStats.reduce((n, s) => n + s.points, 0);
  const total3pt   = (player.three_pointers  > 0) ? player.three_pointers  : gameStats.reduce((n, s) => n + s.three_pointers, 0);
  const totalFouls = (player.fouls           > 0) ? player.fouls           : gameStats.reduce((n, s) => n + s.fouls, 0);

  const hasTotals = totalPts > 0 || total3pt > 0 || totalFouls > 0;
  const hasGames  = gamesPlayed > 0;

  // Always show averages — fall back to 0 when no games played
  const ptsVal     = hasGames ? avg(totalPts,   gamesPlayed) : '0';
  const threePtVal = hasGames ? avg(total3pt,   gamesPlayed) : '0';
  const foulsVal   = hasGames ? avg(totalFouls, gamesPlayed) : '0';
  const ptsSub     = T('נקודות בממוצע');
  const threePtSub = T('3נק׳ בממוצע');
  const foulsSub   = T('עבירות בממוצע');

  const posMeta = player.position ? POSITION_META[player.position] : null;

  const videos = gameStats
    .filter((s) => s.game.video_url)
    .map((s) => ({
      url: s.game.video_url!,
      label: `vs ${getOpponent(s, player.team_id!).name}`,
      date: s.game.game_date,
    }));

  // Show every game the player has stats for, in chronological order. Don't
  // require status='Finished' — admin scores often arrive while status is
  // still 'Scheduled'.
  const chartData = [...gameStats]
    .sort((a, b) => a.game.game_date.localeCompare(b.game.game_date))
    .map((s, i) => ({
      game: `G${i + 1}`,
      opponent: getOpponent(s, player.team_id!).name,
      points: s.points,
      threePt: s.three_pointers,
      fouls: s.fouls,
    }));

  return (
    <div>

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#0f1e30] to-[#0b1520] mb-8">
        {/* Giant jersey number watermark */}
        {player.jersey_number !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none text-[10rem] font-black leading-none text-white/[0.04] sm:text-[14rem]"
          >
            {player.jersey_number}
          </span>
        )}

        <div className="relative mx-auto flex max-w-4xl flex-col gap-5 px-4 py-10 sm:flex-row sm:items-center sm:gap-8">
          {/* Player photo — falls back to team logo */}
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-orange-500/50 bg-white/[0.06] shadow-lg shadow-orange-500/10 sm:h-32 sm:w-32">
            {player.photo_url ? (
              <Image src={player.photo_url} alt={player.name} fill className="object-cover" priority />
            ) : player.team?.logo_url ? (
              <Image src={player.team.logo_url} alt={player.team.name} fill className="object-cover" priority />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-4xl font-black text-[#4a6a8a]">
                {player.name?.charAt(0) ?? '?'}
              </span>
            )}
          </div>

          {/* Player info */}
          <div className="flex-1">
            <Link
              href="/players"
              className="mb-3 inline-block text-xs text-[#5a7a9a] hover:text-orange-400 transition-colors"
            >
              ← {T('כל השחקנים')}
            </Link>

            {/* Badges row */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {player.jersey_number !== null && (
                <span className="rounded-lg border border-white/[0.12] px-3 py-0.5 text-sm font-bold text-orange-400 font-stats">
                  #{player.jersey_number}
                </span>
              )}
              {posMeta && (
                <span className={`rounded-lg border px-3 py-0.5 text-sm font-semibold ${posMeta.color} ${posMeta.bg}`}>
                  {lang === 'en' ? posMeta.en : posMeta.he}
                </span>
              )}
              {player.is_active === false ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-0.5 text-sm font-bold text-red-400">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {T('לא פעיל')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-0.5 text-sm font-bold text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
                  {T('פעיל')}
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl font-heading">
              {player.name}
            </h1>

            {/* Team */}
            {player.team && (
              <p className="mt-1 text-sm text-[#8aaac8] font-heading">{T(player.team.name)}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Page body ───────────────────────────────────────────────────── */}
      <div className="space-y-10">

        {/* ── Stats dashboard ──────────────────────────────────────────── */}
        <section>
          <SectionTitle>{T('ממוצעי עונה')}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={T('נק׳')}     value={ptsVal}              sublabel={ptsSub}     accent="orange" />
            <StatCard label={T('3נק׳')}    value={threePtVal}          sublabel={threePtSub} accent="sky" />
            <StatCard label={T('עבירות')}  value={foulsVal}            sublabel={foulsSub}   accent="rose" />
            <StatCard label={T('משחקים')}  value={String(gamesPlayed)} sublabel={T('משחקים שהשתתף')} accent="emerald" />
          </div>

          {/* Season totals strip — shown when player has stats AND game count is known */}
          {hasTotals && hasGames && (
            <div className="mt-3 flex divide-x divide-x-reverse divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] text-center">
              {[
                { label: T('סה״כ נק׳'),    value: totalPts },
                { label: T('סה״כ 3נק׳'),   value: total3pt },
                { label: T('סה״כ עבירות'), value: totalFouls },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 py-3">
                  <p className="text-lg font-bold text-[#e8edf5] font-stats">{value}</p>
                  <p className="text-xs text-[#5a7a9a] font-body">{label}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Performance chart ────────────────────────────────────────── */}
        {chartData.length > 0 && (
          <section>
            <SectionTitle>{T('גרף ביצועים')}</SectionTitle>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 sm:p-6">
              <PlayerStatsChart data={chartData} />
            </div>
          </section>
        )}

        {/* ── Game history table ───────────────────────────────────────── */}
        {gameStats.length > 0 && (
          <section>
            <SectionTitle>{T('היסטוריית משחקים')}</SectionTitle>
            <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.03]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wide text-[#5a7a9a]">
                    <th className="px-4 py-3 text-right">{T('תאריך')}</th>
                    <th className="px-4 py-3 text-right">{T('יריב')}</th>
                    <th className="px-4 py-3 text-center">{T('תוצאה')}</th>
                    <th className="px-4 py-3 text-center">{T('נצ׳')}</th>
                    <th className="px-4 py-3 text-center">{T('נק׳')}</th>
                    <th className="px-4 py-3 text-center">{T('3נק׳')}</th>
                    <th className="px-4 py-3 text-center">{T('עב׳')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {gameStats.map((stat) => {
                    const opp = getOpponent(stat, player.team_id!);
                    const result = getResult(stat, player.team_id!);
                    const isHome = stat.game.home_team_id === player.team_id;
                    const myScore = isHome ? stat.game.home_score : stat.game.away_score;
                    const theirScore = isHome ? stat.game.away_score : stat.game.home_score;
                    const dateStr = new Date(stat.game.game_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'he-IL', {
                      day: 'numeric', month: 'numeric', year: '2-digit',
                    });
                    return (
                      <tr key={stat.id} className="hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 text-[#8aaac8]">{dateStr}</td>
                        <td className="px-4 py-3 font-medium text-[#e8edf5] font-heading">
                          <span className="text-[#5a7a9a] text-xs ml-1 font-body">{isHome ? T('נגד') : '@'}</span>
                          {T(opp.name)}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-[#8aaac8] font-stats">
                          {(stat.game.status === 'Finished' || (myScore + theirScore > 0))
                            ? `${myScore}–${theirScore}`
                            : <span className="text-xs text-[#5a7a9a] font-body">{stat.game.status}</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {result ? (
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                              result === 'W' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              result === 'L' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                              'bg-white/[0.04] text-[#8aaac8] border border-white/[0.07]'
                            }`}>
                              {result === 'W' ? (lang === 'en' ? 'W' : 'נצ׳') : result === 'L' ? (lang === 'en' ? 'L' : 'הפ׳') : (lang === 'en' ? 'D' : 'תק׳')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-orange-400 font-stats">{stat.points}</td>
                        <td className="px-4 py-3 text-center font-semibold text-sky-400 font-stats">{stat.three_pointers}</td>
                        <td className="px-4 py-3 text-center text-rose-400 font-stats">{stat.fouls}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── No games yet ─────────────────────────────────────────────── */}
        {gameStats.length === 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] py-16 text-center space-y-3 text-[#5a7a9a]">
            <p>{lang === 'en' ? 'No game data yet for this player.' : 'אין נתוני משחק עדיין עבור שחקן זה.'}</p>
            <a
              href={`/admin?tab=playerstats&player=${encodeURIComponent(player.name)}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-400/70 hover:text-orange-400 transition-colors"
            >
              ✏️ {lang === 'en' ? 'Update stats (Admin)' : 'עדכון סטטיסטיקה (מנהל)'}
            </a>
          </div>
        )}

        {/* ── Video gallery ────────────────────────────────────────────── */}
        {videos.length > 0 && (
          <section>
            <SectionTitle>{T('גלריית סרטונים')}</SectionTitle>
            <VideoGallery videos={videos} />
          </section>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white font-heading">
      <span className="h-4 w-1 rounded-full bg-orange-500" />
      {children}
    </h2>
  );
}

const ACCENT_CLASSES: Record<string, { number: string; bar: string }> = {
  orange:  { number: 'text-orange-400',  bar: 'bg-orange-500' },
  sky:     { number: 'text-sky-400',     bar: 'bg-sky-500' },
  rose:    { number: 'text-rose-400',    bar: 'bg-rose-500' },
  emerald: { number: 'text-emerald-400', bar: 'bg-emerald-500' },
};

function StatCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel: string;
  accent: string;
}) {
  const cls = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.orange;
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#5a7a9a] font-body">{label}</p>
        <p className={`mt-1 text-4xl font-black tabular-nums font-stats ${cls.number}`}>{value}</p>
        <p className="mt-1 text-xs text-[#4a6a8a] font-body">{sublabel}</p>
      </div>
      <div className="mt-4 h-0.5 w-full rounded-full bg-white/[0.06]">
        <div className={`h-0.5 w-1/3 rounded-full ${cls.bar}`} />
      </div>
    </div>
  );
}
