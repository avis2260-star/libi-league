export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { NORTH_TABLE, SOUTH_TABLE } from '@/lib/league-data';
import { notFound } from 'next/navigation';
import { getLang, st } from '@/lib/get-lang';
import { makeNameResolver } from '@/lib/team-name-resolver';

/* ── Types ─────────────────────────────────────────────────────────────────── */
type Standing = {
  rank: number; name: string; wins: number; losses: number;
  pts: number; diff: number; pf: number; pa: number;
  games: number; techni: number; penalty: number; division: string;
};
type GameRow = {
  round: number; date: string; division: string;
  home_team: string; away_team: string;
  home_score: number; away_score: number; techni: boolean;
};
type UpcomingGameRow = {
  game_date: string;
  game_time: string | null;
  location: string | null;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_team: { name: string } | { name: string }[] | null;
  away_team: { name: string } | { name: string }[] | null;
};

/* ── Team name aliases (same team, different names across tables) ──────────── */
const TEAM_ALIASES: [string, string][] = [
  ['אריות קריית גת', 'א.ס. ק. גת'],
  ['אריות קריית גת', 'א.ט. ק. גת'],
  ['אריות קריית גת', 'אריות ק. גת'],
  ['ה.ה. גדרה',      'החברה הטובים גדרה'],
  ['ה.ה. גדרה',      'החברה הטובים'],
];

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function normName(s: string) {
  return s.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function resolveAlias(name: string): string {
  const norm = normName(name);
  for (const [canonical, alias] of TEAM_ALIASES) {
    if (normName(alias) === norm) return canonical;
    if (normName(canonical) === norm) return canonical;
  }
  return name;
}
function matchTeam(a: string, b: string) {
  if (a === b || normName(a) === normName(b)) return true;
  return resolveAlias(a) === resolveAlias(b);
}
function findLogo(name: string, logos: Record<string, string>): string | undefined {
  if (logos[name]) return logos[name];
  const resolved = resolveAlias(name);
  for (const [k, v] of Object.entries(logos)) {
    if (normName(k) === normName(name) || resolveAlias(k) === resolved) return v;
  }
  return undefined;
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default async function TeamStatsPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: encodedName } = await params;
  const teamName = decodeURIComponent(encodedName);

  /* Fetch all data in parallel */
  const [
    { data: standingsData },
    { data: resultsData },
    { data: teamsData },
    { data: cupData },
    { data: upcomingData },
    lang,
  ] = await Promise.all([
    supabaseAdmin.from('standings').select('*').order('rank'),
    supabaseAdmin.from('game_results').select('*').order('round'),
    supabaseAdmin.from('teams').select('id, name, logo_url, captain_name, contact_info'),
    supabaseAdmin.from('cup_games').select('*').order('round_order'),
    supabaseAdmin
      .from('games')
      .select('game_date, game_time, location, status, home_team_id, away_team_id, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
      .neq('status', 'Finished')
      .gte('game_date', new Date().toISOString().slice(0, 10))
      .order('game_date', { ascending: true }),
    getLang(),
  ]);
  const T = (he: string) => st(he, lang);
  const en = lang === 'en';

  const allStandings: Standing[] = (standingsData ?? [
    ...NORTH_TABLE.map(t => ({ ...t, division: 'North' })),
    ...SOUTH_TABLE.map(t => ({ ...t, division: 'South' })),
  ]) as Standing[];

  const standing = allStandings.find(s => matchTeam(s.name, teamName));

  /* Build logo map */
  const logos: Record<string, string> = {};
  for (const t of teamsData ?? []) {
    if (t.name && t.logo_url) logos[t.name] = t.logo_url;
  }
  const logoUrl = findLogo(teamName, logos);
  const teamInfo = (teamsData ?? []).find(t => matchTeam(t.name, teamName));

  /* Filter games */
  const allGames = (resultsData ?? []) as GameRow[];
  // A double-loss (both teams forfeit, stored as techni+0:0) must appear in the
  // game log so that round numbers are not skipped in the streak history.
  // Only exclude single-side techni games (one team wins 20:0).
  const isDoubleLoss = (g: GameRow) =>
    g.techni && g.home_score === 0 && g.away_score === 0;
  const teamGames = allGames.filter(g =>
    (matchTeam(g.home_team, teamName) || matchTeam(g.away_team, teamName)) &&
    (!g.techni || isDoubleLoss(g))
  );

  /* Cup games */
  const cupGames = ((cupData ?? []) as { home_team: string; away_team: string; home_score: number | null; away_score: number | null; played: boolean; round: string; game_number: number }[])
    .filter(g => matchTeam(g.home_team, teamName) || matchTeam(g.away_team, teamName));

  /* Upcoming games — pull team_id once, then filter by it */
  function teamNameOf(t: UpcomingGameRow['home_team']): string {
    if (!t) return '';
    if (Array.isArray(t)) return t[0]?.name ?? '';
    return t.name ?? '';
  }
  const teamId = teamInfo?.id ?? null;
  const upcomingGames = teamId
    ? ((upcomingData ?? []) as unknown as UpcomingGameRow[])
        .filter(g => g.home_team_id === teamId || g.away_team_id === teamId)
        .map(g => {
          const homeName = teamNameOf(g.home_team);
          const awayName = teamNameOf(g.away_team);
          const isHome = g.home_team_id === teamId;
          return {
            isHome,
            opponent: isHome ? awayName : homeName,
            game_date: g.game_date,
            game_time: g.game_time,
            location: g.location,
          };
        })
    : [];

  /* Resolver: opponent names cached in game_results may be stale after
     an admin rename — pipe them through the live teams table so the
     team page always shows the canonical name. */
  const resolveName = makeNameResolver((teamsData ?? []).map(t => ({ id: t.id, name: t.name })));

  /* Compute per-game stats */
  let totalPts = 0, totalAllowed = 0, wins = 0, losses = 0;
  const gameDetails = teamGames.map(g => {
    const isHome = matchTeam(g.home_team, teamName);
    const myScore  = isHome ? g.home_score : g.away_score;
    const oppScore = isHome ? g.away_score : g.home_score;
    const oppName  = resolveName(isHome ? g.away_team : g.home_team);
    const won = myScore > oppScore;
    if (won) wins++; else losses++;
    totalPts += myScore;
    totalAllowed += oppScore;
    return { round: g.round, date: g.date, isHome, myScore, oppScore, oppName, won };
  });

  const avgPts     = teamGames.length ? (totalPts / teamGames.length).toFixed(1) : '–';
  const avgAllowed = teamGames.length ? (totalAllowed / teamGames.length).toFixed(1) : '–';
  const winPct     = teamGames.length ? Math.round((wins / teamGames.length) * 100) : 0;

  const division = standing
    ? standing.division === 'North'
      ? (lang === 'en' ? 'North' : 'צפון')
      : (lang === 'en' ? 'South' : 'דרום')
    : null;

  const rankColor =
    standing?.rank === 1 ? '#e0c97a'
    : standing?.rank === 2 ? '#b0b8c8'
    : standing?.rank === 3 ? '#c87d3a'
    : '#7aaac8';

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={teamName}
            className="h-20 w-20 rounded-full object-cover border-2 border-white/10 shadow-lg shrink-0" />
        ) : (
          <div className="h-20 w-20 rounded-full bg-[#1a2e45] border-2 border-white/10 flex items-center justify-center text-3xl font-black text-[#3a5a7a] shrink-0">
            {[...teamName].find(c => /\S/.test(c)) ?? '?'}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-white leading-tight font-heading">{T(teamName)}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {division && (
              <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                (standing?.division === 'North') ? 'bg-blue-500/15 text-blue-400' : 'bg-orange-500/15 text-orange-400'
              }`}>{lang === 'en' ? `${division} Division` : `מחוז ${division}`}</span>
            )}
            {standing && (
              <span className="text-sm font-bold" style={{ color: rankColor }}>
                {T('מקום')} #{standing.rank}
              </span>
            )}
          </div>
          {teamInfo?.captain_name && teamInfo.captain_name !== 'TBD' && (
            <p className="text-sm font-bold text-[#8aaac8] mt-1">{T('קפטן')}: <span className="font-black text-white">{teamInfo.captain_name}</span></p>
          )}
        </div>
      </div>

      {/* ── Season record ───────────────────────────────────────────────── */}
      {standing && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: T('נצחונות'), value: String(standing.wins), color: 'text-green-400' },
            { label: T('הפסדים'), value: String(standing.losses), color: 'text-red-400' },
            { label: T('נקודות'), value: String(standing.pts), color: 'text-orange-400' },
            { label: '+/−', value: standing.diff > 0 ? `+${standing.diff}` : String(standing.diff), color: standing.diff > 0 ? 'text-green-400' : 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4 text-center">
              <p className={`text-2xl font-black font-stats ${color}`} dir="ltr">{value}</p>
              <p className="text-xs font-bold text-[#8aaac8] mt-0.5 font-body">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Averages ────────────────────────────────────────────────────── */}
      {teamGames.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-bold text-[#e0c97a]">📊 {T('ממוצעים עונתיים')}</h2>
          </div>
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.05]">
            <div className="p-4 text-center">
              <p className="text-2xl font-black text-white font-stats">{avgPts}</p>
              <p className="text-xs font-bold text-[#8aaac8] mt-0.5 font-body">{T('נקודות לניצחון')}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-2xl font-black text-[#8aaac8] font-stats">{avgAllowed}</p>
              <p className="text-xs font-bold text-[#8aaac8] mt-0.5 font-body">{T('נקודות נגד')}</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-2xl font-black text-orange-400 font-stats">{winPct}%</p>
              <p className="text-xs font-bold text-[#8aaac8] mt-0.5 font-body">{T('אחוז נצחונות')}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Game log ────────────────────────────────────────────────────── */}
      {gameDetails.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-bold text-[#e0c97a]">📋 {T('יומן משחקים')} ({gameDetails.length})</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {[...gameDetails].sort((a, b) => b.round - a.round).map((g, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 ${g.won ? 'bg-green-500/[0.03]' : ''}`}>
                <span className={`shrink-0 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black ${
                  g.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/15 text-red-400'
                }`}>{g.won ? (lang === 'en' ? 'W' : 'נ') : (lang === 'en' ? 'L' : 'ה')}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {g.isHome ? T('בית') : T('חוץ')} {T('נגד')} {T(g.oppName)}
                  </p>
                  <p className="text-sm font-black text-[#8aaac8]">{T('מחזור')} {g.round} · {g.date}</p>
                </div>
                <div dir="ltr" className="shrink-0 text-right">
                  <span className={`text-lg font-black font-stats ${g.won ? 'text-green-400' : 'text-red-400'}`}>{g.myScore}</span>
                  <span className="text-[#8aaac8] mx-1">–</span>
                  <span className="text-lg font-black text-[#8aaac8] font-stats">{g.oppScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cup games ───────────────────────────────────────────────────── */}
      {cupGames.length > 0 && (
        <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.03] overflow-hidden">
          <div className="border-b border-yellow-400/[0.1] px-5 py-3">
            <h2 className="text-sm font-bold text-yellow-400">🏆 {T('משחקי גביע')}</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {cupGames.map((g, i) => {
              const isHome = matchTeam(g.home_team, teamName);
              const myScore  = isHome ? g.home_score : g.away_score;
              const oppScore = isHome ? g.away_score : g.home_score;
              const oppName  = resolveName(isHome ? g.away_team : g.home_team);
              const hasScores = myScore !== null && oppScore !== null;
              const won = hasScores && (myScore as number) > (oppScore as number);
              const isPlayed = g.played || hasScores;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className={`shrink-0 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black ${
                    !isPlayed ? 'bg-white/5 text-[#8aaac8]' :
                    won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/15 text-red-400'
                  }`}>{!isPlayed ? '?' : won ? (lang === 'en' ? 'W' : 'נ') : (lang === 'en' ? 'L' : 'ה')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{T('גביע')} — {T(g.round)} {T('נגד')} {T(oppName)}</p>
                  </div>
                  {hasScores ? (
                    <div dir="ltr" className="shrink-0">
                      <span className={`text-lg font-black font-stats ${won ? 'text-green-400' : 'text-red-400'}`}>{myScore}</span>
                      <span className="text-[#8aaac8] mx-1">–</span>
                      <span className="text-lg font-black text-[#8aaac8] font-stats">{oppScore}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-[#8aaac8]">{T('טרם שוחק')}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Upcoming games ──────────────────────────────────────────────── */}
      {upcomingGames.length > 0 && (
        <div className="rounded-2xl border border-orange-400/20 bg-orange-400/[0.03] overflow-hidden">
          <div className="border-b border-orange-400/[0.1] px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-orange-400">📅 {T('משחקים קרובים')}</h2>
            <span className="text-[10px] font-bold text-orange-400/70">{upcomingGames.length}</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {upcomingGames.map((g, i) => {
              const time = (g.game_time && g.game_time !== '00:00:00') ? g.game_time.slice(0, 5) : '';
              const loc  = (g.location && g.location !== 'TBD') ? g.location : '';
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="shrink-0 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25">
                    {g.isHome ? (en ? 'H' : 'ב') : (en ? 'A' : 'ח')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {g.isHome ? T('בית') : T('חוץ')} {T('נגד')} {T(g.opponent)}
                    </p>
                    <p className="text-xs font-bold text-[#8aaac8] mt-0.5">
                      <span dir="ltr">{g.game_date}</span>
                      {time && <> · <span dir="ltr">{time}</span></>}
                      {loc && <> · 📍 {loc}</>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {gameDetails.length === 0 && cupGames.length === 0 && upcomingGames.length === 0 && (
        <div className="rounded-2xl border border-white/[0.07] py-16 text-center">
          <p className="text-4xl mb-3">🏀</p>
          <p className="text-sm font-bold text-[#8aaac8]">{en ? `No games found for ${teamName}` : `לא נמצאו משחקים עבור ${teamName}`}</p>
        </div>
      )}

      {/* ── Back link ───────────────────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <a href="/teams" className="text-sm font-bold text-[#8aaac8] hover:text-orange-400 transition block">{T('← חזרה לרשימת הקבוצות')}</a>
        {teamInfo?.id && (
          <a href={`/teams/${teamInfo.id}/players`} className="text-sm text-orange-400/70 hover:text-orange-400 transition block">
            🃏 {en ? `Player cards for ${T(teamName)}` : `כרטיסי שחקנים של ${teamName}`}
          </a>
        )}
      </div>
    </div>
  );
}
