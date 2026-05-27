export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLang, st } from '@/lib/get-lang';
import { resolveSeasonFromParams, listKnownSeasons } from '@/lib/current-season';
import SeasonPicker from '@/components/SeasonPicker';
import ArchiveBanner from '@/components/ArchiveBanner';

type ScorerRow = {
  id: string;
  name: string;
  photo_url: string | null;
  jersey_number: number | null;
  team_name: string | null;
  games: number;
  points: number;
  three_pointers: number;
  fouls: number;
};

async function getCupScorers(season: string): Promise<ScorerRow[]> {
  // Pull every cup_game_stats row in the season, aggregate per player, then
  // hydrate names/teams/photos from players. Mirrors the archive-scorers
  // pattern in /scorers (re-deriving from per-game rows).
  const { data: stats } = await supabaseAdmin
    .from('cup_game_stats')
    .select('player_id, cup_game_id, points, three_pointers, fouls')
    .eq('season', season);

  type Totals = { games: Set<string>; points: number; three_pointers: number; fouls: number };
  const totals = new Map<string, Totals>();
  for (const r of (stats ?? []) as { player_id: string; cup_game_id: string; points: number | null; three_pointers: number | null; fouls: number | null }[]) {
    const t = totals.get(r.player_id) ?? { games: new Set<string>(), points: 0, three_pointers: 0, fouls: 0 };
    t.games.add(r.cup_game_id);
    t.points         += r.points         ?? 0;
    t.three_pointers += r.three_pointers ?? 0;
    t.fouls          += r.fouls          ?? 0;
    totals.set(r.player_id, t);
  }

  const playerIds = [...totals.keys()];
  if (playerIds.length === 0) return [];

  const { data: players } = await supabaseAdmin
    .from('players')
    .select('id, name, photo_url, jersey_number, team:teams(name)')
    .in('id', playerIds);

  return ((players ?? []) as unknown as {
    id: string; name: string; photo_url: string | null; jersey_number: number | null;
    team: { name: string } | null;
  }[])
    .map((p) => {
      const t = totals.get(p.id)!;
      return {
        id:             p.id,
        name:           p.name,
        photo_url:      p.photo_url,
        jersey_number:  p.jersey_number,
        team_name:      p.team?.name ?? null,
        games:          t.games.size,
        points:         t.points,
        three_pointers: t.three_pointers,
        fouls:          t.fouls,
      };
    })
    .filter((p) => p.points > 0 || p.three_pointers > 0 || p.fouls > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);
}

type CupGameRow = {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  played: boolean;
  round: string;
};

type TeamCupStats = {
  team: string;
  played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
};

function aggregateTeamStats(games: CupGameRow[]): TeamCupStats[] {
  const map = new Map<string, TeamCupStats>();
  const ensure = (team: string) => {
    let t = map.get(team);
    if (!t) {
      t = { team, played: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 };
      map.set(team, t);
    }
    return t;
  };
  for (const g of games) {
    if (!g.played || g.home_score == null || g.away_score == null) continue;
    const h = ensure(g.home_team);
    const a = ensure(g.away_team);
    h.played++; a.played++;
    h.points_for += g.home_score; h.points_against += g.away_score;
    a.points_for += g.away_score; a.points_against += g.home_score;
    if (g.home_score > g.away_score) { h.wins++; a.losses++; }
    else if (g.away_score > g.home_score) { a.wins++; h.losses++; }
  }
  return [...map.values()].sort((x, y) =>
    y.wins - x.wins ||
    (y.points_for - y.points_against) - (x.points_for - x.points_against) ||
    y.points_for - x.points_for,
  );
}

const MEDAL = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

function fmtAvg(total: number, games: number): string {
  if (!games) return '0';
  const v = total / games;
  return v.toFixed(1);
}

export default async function CupStatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { viewing, current, isArchive } = await resolveSeasonFromParams(params);

  const [scorers, lang, seasons, { data: cupGamesData }, { data: teamsData }] = await Promise.all([
    getCupScorers(viewing),
    getLang(),
    listKnownSeasons(),
    supabaseAdmin
      .from('cup_games')
      .select('id, home_team, away_team, home_score, away_score, played, round')
      .eq('season', viewing),
    supabaseAdmin.from('teams').select('name, logo_url'),
  ]);

  const T = (he: string) => st(he, lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  const teamLogos: Record<string, string> = {};
  for (const t of (teamsData ?? []) as { name: string | null; logo_url: string | null }[]) {
    if (t.name && t.logo_url) teamLogos[t.name] = t.logo_url;
  }

  const teamStats = aggregateTeamStats((cupGamesData ?? []) as CupGameRow[]);
  const gamesPlayedTotal = ((cupGamesData ?? []) as CupGameRow[]).filter(g => g.played).length;

  return (
    <div dir={dir} className="space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link href="/cup" className="mb-2 inline-block text-xs text-[#5a7a9a] hover:text-orange-400 transition-colors">
            {T('← חזרה לעמוד הגביע')}
          </Link>
          <h1 className="text-2xl font-black text-white flex items-center gap-2 font-heading">
            <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">🏆</span>
            {T('סטטיסטיקה גביע')}
          </h1>
          <p className="text-sm font-bold text-[#8aaac8] mt-0.5 font-body">
            {T('מובילי הגביע וסיכומי קבוצות')} — {lang === 'en' ? `Season ${viewing}` : `עונת ${viewing}`}
          </p>
        </div>
        <SeasonPicker current={current} viewing={viewing} seasons={seasons} />
      </div>

      {isArchive && <ArchiveBanner viewing={viewing} current={current} pathname="/cup/stats" />}

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a]">{T('משחקי גביע')}</p>
          <p className="mt-1 text-2xl font-black text-orange-400 font-stats">{gamesPlayedTotal}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a]">{T('שחקנים פעילים')}</p>
          <p className="mt-1 text-2xl font-black text-sky-400 font-stats">{scorers.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a]">{T('קבוצות')}</p>
          <p className="mt-1 text-2xl font-black text-emerald-400 font-stats">{teamStats.length}</p>
        </div>
      </div>

      {/* Score leaders */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-white flex items-center gap-2 font-heading">
          <span>🏅</span>
          {T('מובילי הגביע')}
        </h2>

        {scorers.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] py-16 text-center">
            <p className="text-4xl mb-3">🏀</p>
            <p className="font-bold text-[#8aaac8]">{T('עדיין אין סטטיסטיקה לגביע')}</p>
            <p className="text-xs text-[#5a7a9a] mt-2">{T('הזן סטטיסטיקה דרך לשונית הגביע באדמין')}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">

            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[3rem_1fr_4rem_4rem_4.5rem_4.5rem_4.5rem] gap-2 px-5 py-3 border-b border-white/[0.08] text-[11px] font-black uppercase tracking-widest text-[#5a7a9a]">
              <span className="text-center">{T('מקום')}</span>
              <span>{T('שחקן')}</span>
              <span className="text-center">{T('משחקים')}</span>
              <span className="text-center">{T('סה״כ נק׳')}</span>
              <span className="text-center">{T('ממוצע נק׳')}</span>
              <span className="text-center">{T('ממוצע 3נק׳')}</span>
              <span className="text-center">{T('ממוצע פאולים')}</span>
            </div>

            {scorers.map((p, i) => {
              const maxPts = scorers[0].points || 1;
              return (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="flex sm:grid sm:grid-cols-[3rem_1fr_4rem_4rem_4.5rem_4.5rem_4.5rem] gap-0 sm:gap-2 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Rank */}
                  <div className="w-14 sm:w-auto shrink-0 px-3 sm:px-0 py-4 flex flex-col items-center justify-center">
                    {i < 3 ? (
                      <span className="text-xl">{MEDAL[i]}</span>
                    ) : (
                      <span className={`text-sm font-black font-stats ${RANK_COLORS[i] ?? 'text-[#5a7a9a]'}`}>{i + 1}</span>
                    )}
                  </div>

                  {/* Player */}
                  <div className="flex flex-1 min-w-0 items-center gap-3 py-3 pr-0 sm:pr-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.10] bg-white/[0.04]">
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-black text-[#4a6a8a]">
                          {p.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white group-hover:text-orange-300 transition-colors leading-tight font-heading">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.jersey_number !== null && (
                          <span className="text-[10px] font-bold text-orange-400/80 shrink-0 font-stats">#{p.jersey_number}</span>
                        )}
                        {p.team_name && (
                          <span className="truncate text-xs font-bold text-[#8aaac8] font-body">{p.team_name}</span>
                        )}
                      </div>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.06]">
                        <div
                          className="h-1 rounded-full bg-gradient-to-l from-orange-500 to-orange-700"
                          style={{ width: `${Math.round((p.points / maxPts) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Games — visible on both mobile and desktop */}
                  <div className="hidden sm:block py-4 text-center">
                    <p className="text-sm font-black text-[#c8d8e8] font-stats">{p.games}</p>
                  </div>

                  {/* Total points */}
                  <div className="w-16 sm:w-auto shrink-0 px-2 py-4 text-center">
                    <p className="text-lg font-black text-orange-400 font-stats">{p.points}</p>
                    <p className="text-[10px] font-bold text-[#8aaac8] sm:hidden font-body">{T('נק׳')}</p>
                  </div>

                  {/* Avg points / game (PPG) */}
                  <div className="hidden sm:block py-4 text-center">
                    <p className="text-base font-black text-emerald-400 font-stats">{fmtAvg(p.points, p.games)}</p>
                    <p className="text-[9px] font-bold text-[#5a7a9a] font-body">{T('למשחק')}</p>
                  </div>

                  {/* Avg 3pt */}
                  <div className="hidden sm:block py-4 text-center">
                    <p className="text-base font-black text-sky-400 font-stats">{fmtAvg(p.three_pointers, p.games)}</p>
                    <p className="text-[9px] font-bold text-[#5a7a9a] font-body">{T('למשחק')}</p>
                  </div>

                  {/* Avg fouls */}
                  <div className="hidden sm:block py-4 text-center">
                    <p className="text-base font-black text-rose-400 font-stats">{fmtAvg(p.fouls, p.games)}</p>
                    <p className="text-[9px] font-bold text-[#5a7a9a] font-body">{T('למשחק')}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-[#3a5a7a] sm:hidden">
          {T('סובב למצב אופקי לצפייה בממוצעים')}
        </p>
      </section>

      {/* Team standings within the cup */}
      {teamStats.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-black text-white flex items-center gap-2 font-heading">
            <span>🛡️</span>
            {T('סיכום קבוצות בגביע')}
          </h2>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
            <div className="hidden sm:grid grid-cols-[3rem_1fr_3.5rem_3rem_3rem_4rem_4rem_4rem] gap-2 px-5 py-3 border-b border-white/[0.08] text-[11px] font-black uppercase tracking-widest text-[#5a7a9a]">
              <span className="text-center">{T('#')}</span>
              <span>{T('קבוצה')}</span>
              <span className="text-center">{T('משחקים')}</span>
              <span className="text-center">{T('נצ')}</span>
              <span className="text-center">{T('הפ')}</span>
              <span className="text-center">{T('זכות')}</span>
              <span className="text-center">{T('חובה')}</span>
              <span className="text-center">{T('הפרש')}</span>
            </div>

            {teamStats.map((t, i) => {
              const diff = t.points_for - t.points_against;
              const logo = teamLogos[t.team];
              return (
                <div
                  key={t.team}
                  className="grid grid-cols-[2.5rem_1fr_3rem_2.5rem_2.5rem_3.5rem_3.5rem_3.5rem] sm:grid-cols-[3rem_1fr_3.5rem_3rem_3rem_4rem_4rem_4rem] gap-1 sm:gap-2 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors px-2 sm:px-5 py-2.5"
                >
                  <span className="text-center text-xs font-black text-[#8aaac8] font-stats">{i + 1}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt={t.team} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-white/[0.04] text-[10px] font-black text-[#4a6a8a]">{t.team.charAt(0)}</span>
                    )}
                    <span className="truncate text-sm font-bold text-white font-heading">{T(t.team)}</span>
                  </div>
                  <span className="text-center text-sm font-black text-[#c8d8e8] font-stats">{t.played}</span>
                  <span className="text-center text-sm font-black text-emerald-400 font-stats">{t.wins}</span>
                  <span className="text-center text-sm font-black text-rose-400 font-stats">{t.losses}</span>
                  <span className="text-center text-sm font-black text-orange-400 font-stats">{t.points_for}</span>
                  <span className="text-center text-sm font-black text-[#8aaac8] font-stats">{t.points_against}</span>
                  <span className={`text-center text-sm font-black font-stats ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-[#8aaac8]'}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
