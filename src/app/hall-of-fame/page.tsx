export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Season = {
  id: string;
  year: string;
  champion_name: string | null;
  champion_logo: string | null;
  champion_captain: string | null;
  cup_holder_name: string | null;
  cup_holder_logo: string | null;
  mvp_name: string | null;
  mvp_stats: string | null;
  is_current: boolean | null;
  sort_order: number | null;
};

type Record = {
  id: string;
  title: string;
  holder: string | null;
  value: string | null;
  record_date: string | null;
  sort_order: number | null;
};

type PlayoffSeries = {
  series_number: number;
  team_a: string;
  team_b: string;
};

type PlayoffGame = {
  series_number: number;
  game_number: number;
  home_score: number | null;
  away_score: number | null;
  played: boolean | null;
};

type CupGame = {
  round: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  played: boolean | null;
};

/* ── helpers ───────────────────────────────────────────────────────────── */
function normName(s: string) {
  return s.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function homeForGame(s: PlayoffSeries, gNum: number) {
  return gNum === 2 ? s.team_b : s.team_a;
}

function playoffSeriesWinner(s: PlayoffSeries, games: PlayoffGame[]): string | null {
  let winsA = 0, winsB = 0;
  for (const g of games.filter(g => g.series_number === s.series_number && g.played)) {
    const home = homeForGame(s, g.game_number);
    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
    if ((homeWon && home === s.team_a) || (!homeWon && home !== s.team_a)) winsA++;
    else winsB++;
  }
  return winsA >= 2 ? s.team_a : winsB >= 2 ? s.team_b : null;
}

function cupFinalWinner(games: CupGame[]): string | null {
  const finalGame = games.find(g => g.round === 'גמר' && g.played && g.home_score !== null && g.away_score !== null);
  if (!finalGame) return null;
  return (finalGame.home_score ?? 0) > (finalGame.away_score ?? 0)
    ? finalGame.home_team
    : finalGame.away_team;
}

/* ── Trophy card component ────────────────────────────────────────────── */
function TrophyCard({
  title,
  subtitle,
  team,
  logo,
  badge,
  icon,
}: {
  title: string;
  subtitle: string;
  team: string;
  logo: string | null;
  badge: string;
  icon: string;
}) {
  return (
    <section>
      <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
        <span className="w-8 h-px bg-orange-500 inline-block"></span> {title}
      </h2>
      <div className="relative overflow-hidden rounded-3xl border-2 border-yellow-400/40 bg-gradient-to-br from-yellow-400/10 via-slate-900 to-slate-950 p-8 shadow-[0_0_60px_rgba(250,204,21,0.12)]">
        <div className="absolute -left-6 -top-10 text-[10rem] leading-none text-yellow-400/[0.05] select-none">
          {icon}
        </div>
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={team}
              className="h-28 w-28 rounded-full object-cover border-4 border-yellow-400/50 shadow-[0_0_30px_rgba(250,204,21,0.25)]"
            />
          ) : (
            <div className="h-28 w-28 rounded-full bg-slate-800 border-4 border-yellow-400/50 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(250,204,21,0.25)]">
              {icon}
            </div>
          )}
          <div className="flex-1 text-center sm:text-right">
            <p className="text-[11px] font-black uppercase tracking-[3px] text-yellow-400/80 mb-2">
              {subtitle}
            </p>
            <h3 className="font-heading font-black text-4xl sm:text-5xl text-yellow-400 mb-3">
              {team}
            </h3>
          </div>
          <div className="bg-yellow-400 text-black px-4 py-1.5 rounded-full text-xs font-black font-heading tracking-wider shrink-0">
            {badge}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function HallOfFamePage() {
  let seasons: Season[] = [];
  let records: Record[] = [];
  let leagueChampion: string | null = null;
  let leagueChampionLogo: string | null = null;
  let cupHolder: string | null = null;
  let cupHolderLogo: string | null = null;

  try {
    const [
      { data: s },
      { data: r },
      { data: playoffSeries },
      { data: playoffGames },
      { data: cupGames },
      { data: teams },
    ] = await Promise.all([
      supabaseAdmin.from('league_history_seasons').select('*').order('year', { ascending: false }),
      supabaseAdmin.from('league_history_records').select('*').order('sort_order'),
      supabaseAdmin.from('playoff_series').select('series_number, team_a, team_b').order('series_number'),
      supabaseAdmin.from('playoff_games').select('series_number, game_number, home_score, away_score, played'),
      supabaseAdmin.from('cup_games').select('round, home_team, away_team, home_score, away_score, played'),
      supabaseAdmin.from('teams').select('name, logo_url'),
    ]);
    seasons = (s ?? []) as Season[];
    records = (r ?? []) as Record[];

    const teamList = (teams ?? []) as { name: string; logo_url: string | null }[];
    const findLogo = (name: string) =>
      teamList.find(t => normName(t.name) === normName(name))?.logo_url ?? null;

    /* ── League champion: ONLY the live winner of the playoff finals
       (playoff_series #7). Nothing shown until the finals are decided. ── */
    const finalSeries = (playoffSeries ?? []).find(
      (ps: PlayoffSeries) => ps.series_number === 7 && ps.team_a && ps.team_b,
    ) as PlayoffSeries | undefined;

    if (finalSeries) {
      const winner = playoffSeriesWinner(finalSeries, (playoffGames ?? []) as PlayoffGame[]);
      if (winner) {
        leagueChampion = winner;
        leagueChampionLogo = findLogo(winner);
      }
    }

    /* ── Cup holder: ONLY the live winner of the cup final (round='גמר').
       Nothing shown until the final is played. ── */
    const cupWinner = cupFinalWinner((cupGames ?? []) as CupGame[]);
    if (cupWinner) {
      cupHolder = cupWinner;
      cupHolderLogo = findLogo(cupWinner);
    }
  } catch {
    seasons = [];
    records = [];
  }

  return (
    <div className="bg-slate-950 min-h-screen p-8 text-white font-body text-right" dir="rtl">

      <header className="mb-12 border-b border-orange-500/30 pb-6">
        <h1 className="font-heading font-black text-5xl mb-2 italic uppercase">היכל התהילה</h1>
        <p className="text-slate-400 text-lg font-body">מורשת הכדורסל של ליגת ליבי</p>
      </header>

      {/* אלופת הליגה + מחזיקת הגביע */}
      {(leagueChampion || cupHolder) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
          {leagueChampion && (
            <TrophyCard
              title="אלופת הליגה"
              subtitle="אלופת הפלייאוף · 2025–2026"
              team={leagueChampion}
              logo={leagueChampionLogo}
              badge="CHAMPION"
              icon="🏆"
            />
          )}
          {cupHolder && (
            <TrophyCard
              title="מחזיקת הגביע"
              subtitle="אלופת הגביע · 2025–2026"
              team={cupHolder}
              logo={cupHolderLogo}
              badge="CUP HOLDER"
              icon="🥇"
            />
          )}
        </div>
      )}

      {/* קיר האלופות */}
      <section className="mb-16">
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-orange-500 inline-block"></span> אלופות הליגה
        </h2>
        {seasons.length === 0 ? (
          <p className="text-slate-500 text-center py-12">אין עונות להצגה עדיין</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {seasons.map((season) => (
              <Link
                key={season.id}
                href={`/hall-of-fame/${encodeURIComponent(season.year)}`}
                className="relative group overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 hover:border-orange-500 transition-all cursor-pointer block"
              >
                {/* Large year watermark */}
                <div className="absolute -left-4 -top-4 font-stats text-8xl text-white/5 group-hover:text-orange-500/10 transition-colors select-none">
                  {season.year.split('-')[0]}
                </div>

                <p className="font-stats text-2xl text-orange-500">{season.year}</p>
                <h3 className="font-heading font-black text-3xl mb-4">{season.champion_name ?? '—'}</h3>

                <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-body">MVP של העונה</p>
                    <p className="font-heading font-bold">{season.mvp_name ?? '—'}</p>
                    <p className="font-stats text-lg text-orange-400">{season.mvp_stats ?? ''}</p>
                  </div>
                  <div className="bg-orange-500 text-black px-3 py-1 rounded-full text-xs font-black font-heading">
                    CHAMPIONS
                  </div>
                </div>
                <div className="mt-3 text-xs text-orange-400/60 group-hover:text-orange-400 transition font-body">
                  לחץ לפרטי הגמר ←
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* קיר מחזיקות הגביע */}
      <section className="mb-16">
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-yellow-400 inline-block"></span> מחזיקות הגביע
        </h2>
        {seasons.filter(s => s.cup_holder_name).length === 0 ? (
          <p className="text-slate-500 text-center py-12">אין מחזיקות גביע להצגה עדיין</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {seasons.filter(s => s.cup_holder_name).map((season) => (
              <div
                key={`cup-${season.id}`}
                className="relative overflow-hidden rounded-2xl bg-slate-900 border border-yellow-400/20 p-6 hover:border-yellow-400/60 transition-all"
              >
                {/* Large year watermark */}
                <div className="absolute -left-4 -top-4 font-stats text-8xl text-yellow-400/[0.05] select-none">
                  {season.year.split('-')[0]}
                </div>

                <p className="font-stats text-2xl text-yellow-400">{season.year}</p>
                <h3 className="font-heading font-black text-3xl mb-4">{season.cup_holder_name}</h3>

                <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-body">מחזיקת הגביע</p>
                    <p className="font-heading font-bold">🥇 {season.cup_holder_name}</p>
                  </div>
                  <div className="bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-black font-heading">
                    CUP HOLDER
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* לוח שיאי כל הזמנים */}
      <section>
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-orange-500 inline-block"></span> שיאי כל הזמנים
        </h2>
        {records.length === 0 ? (
          <p className="text-slate-500 text-center py-12">אין שיאים להצגה עדיין</p>
        ) : (
          <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800">
            <table className="w-full">
              <thead className="bg-slate-800/50 font-heading text-orange-500 text-sm italic">
                <tr>
                  <th className="p-4 text-right">קטגוריה</th>
                  <th className="p-4 text-right">בעל השיא</th>
                  <th className="p-4 text-center">נתון</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-orange-500/5 transition-colors">
                    <td className="p-4 font-heading font-bold">{record.title}</td>
                    <td className="p-4 font-body text-slate-300">{record.holder ?? '—'}</td>
                    <td className="p-4 text-center font-stats text-3xl text-orange-500">{record.value ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
