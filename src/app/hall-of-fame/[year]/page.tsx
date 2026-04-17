export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function normName(s: string) {
  return s.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function formatTime(t: string | null) {
  if (!t) return null;
  return t.slice(0, 5); // "14:30:00" → "14:30"
}

/* ── page ────────────────────────────────────────────────────────────────── */
export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const decodedYear = decodeURIComponent(year);

  /* 1 — fetch the season record */
  const { data: season } = await supabaseAdmin
    .from('league_history_seasons')
    .select('*')
    .eq('year', decodedYear)
    .maybeSingle();

  if (!season) notFound();

  /* 2 — find the cup final where the champion played */
  const { data: cupGames } = await supabaseAdmin
    .from('cup_games')
    .select('*')
    .eq('round', 'גמר');

  const final = (cupGames ?? []).find((g) => {
    if (!season.champion_name) return false;
    const champ = normName(season.champion_name);
    return normName(g.home_team) === champ || normName(g.away_team) === champ;
  }) ?? (cupGames ?? [])[0] ?? null;

  /* 3 — try to get location + time from the games table */
  let location: string | null = null;
  let gameTime: string | null = null;

  if (final) {
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .in('name', [final.home_team, final.away_team]);

    if (teams && teams.length >= 1) {
      const ids = teams.map((t: { id: string }) => t.id);
      const { data: matchedGame } = await supabaseAdmin
        .from('games')
        .select('game_date, game_time, location')
        .in('home_team_id', ids)
        .in('away_team_id', ids)
        .maybeSingle();

      if (matchedGame) {
        location = matchedGame.location ?? null;
        gameTime = formatTime(matchedGame.game_time);
      }
    }
  }

  /* 4 — fetch team logos */
  const teamNames = [season.champion_name, final?.home_team, final?.away_team].filter(Boolean) as string[];
  const { data: teamsData } = await supabaseAdmin
    .from('teams')
    .select('name, logo_url')
    .in('name', teamNames);

  const logos: Record<string, string> = {};
  for (const t of teamsData ?? []) {
    if (t.name && t.logo_url) logos[normName(t.name)] = t.logo_url;
  }
  function getLogo(name: string) {
    return logos[normName(name)] ?? null;
  }

  const homeWins = final && final.home_score !== null && final.away_score !== null
    ? final.home_score > final.away_score
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-body" dir="rtl">
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-10">

        {/* Back */}
        <Link href="/hall-of-fame" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-orange-400 transition">
          ← חזרה להיכל התהילה
        </Link>

        {/* Season hero */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-8">
          <div className="absolute -left-6 -top-6 font-stats text-[10rem] leading-none text-white/[0.04] select-none">
            {season.year.split('-')[0]}
          </div>
          <div className="relative">
            <p className="font-stats text-3xl text-orange-500 mb-1">{season.year}</p>
            <h1 className="font-heading font-black text-4xl sm:text-5xl mb-4 leading-tight">
              {season.champion_name ?? '—'}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm">
              {season.champion_captain && (
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-orange-400">👤</span> קפטן: <strong>{season.champion_captain}</strong>
                </span>
              )}
              {season.mvp_name && (
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-orange-400">⭐</span> MVP: <strong>{season.mvp_name}</strong>
                  {season.mvp_stats && <span className="font-stats text-lg text-orange-400 ml-1">{season.mvp_stats}</span>}
                </span>
              )}
            </div>
          </div>
          <div className="absolute top-6 left-6 bg-orange-500 text-black px-4 py-1.5 rounded-full text-xs font-black font-heading tracking-wider">
            CHAMPIONS
          </div>
        </header>

        {/* Cup Final game card */}
        {final ? (
          <section className="space-y-4">
            <h2 className="font-heading font-black text-2xl flex items-center gap-2">
              <span className="w-6 h-px bg-orange-500 inline-block"></span>
              גמר הגביע
            </h2>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">

              {/* Meta row — date / time / location */}
              <div className="flex flex-wrap gap-4 items-center px-6 py-4 border-b border-slate-800 bg-slate-800/30 text-sm">
                {final.date && (
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span>📅</span>
                    <span className="font-stats text-base text-white">{final.date}</span>
                  </span>
                )}
                {gameTime && (
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span>🕐</span>
                    <span className="font-stats text-base text-white" dir="ltr">{gameTime}</span>
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span>📍</span>
                    <span className="text-white">{location}</span>
                  </span>
                )}
                {!final.date && !gameTime && !location && (
                  <span className="text-slate-500 italic">פרטי משחק לא זמינים</span>
                )}
              </div>

              {/* Scoreboard */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-8">

                {/* Home team */}
                <div className="flex flex-col items-end gap-2 text-right">
                  {getLogo(final.home_team) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getLogo(final.home_team)!} alt={final.home_team}
                      className="h-14 w-14 rounded-full object-cover border-2 border-slate-700" />
                  )}
                  <p className={`font-heading font-black text-xl leading-tight ${homeWins ? 'text-white' : 'text-slate-400'}`}>
                    {final.home_team}
                  </p>
                  {homeWins && <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">🏆 אלוף</span>}
                </div>

                {/* Score */}
                <div className="flex flex-col items-center gap-1">
                  {final.played && final.home_score !== null ? (
                    <div className="flex items-center gap-2">
                      <span className={`font-stats text-5xl font-bold ${homeWins ? 'text-orange-400' : 'text-slate-400'}`}>
                        {final.home_score}
                      </span>
                      <span className="font-stats text-3xl text-slate-600">:</span>
                      <span className={`font-stats text-5xl font-bold ${!homeWins ? 'text-orange-400' : 'text-slate-400'}`}>
                        {final.away_score}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-stats text-3xl text-slate-600">VS</span>
                      <span className="text-xs text-slate-500">טרם שוחק</span>
                    </div>
                  )}
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">גמר גביע</span>
                </div>

                {/* Away team */}
                <div className="flex flex-col items-start gap-2 text-left">
                  {getLogo(final.away_team) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getLogo(final.away_team)!} alt={final.away_team}
                      className="h-14 w-14 rounded-full object-cover border-2 border-slate-700" />
                  )}
                  <p className={`font-heading font-black text-xl leading-tight ${!homeWins ? 'text-white' : 'text-slate-400'}`}>
                    {final.away_team}
                  </p>
                  {homeWins === false && <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">🏆 אלוף</span>}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-500">
            <p>לא נמצא מידע על משחק הגמר לעונה זו</p>
          </div>
        )}

      </div>
    </div>
  );
}
