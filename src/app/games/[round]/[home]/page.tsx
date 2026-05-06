export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import { getTeams } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLang, st } from '@/lib/get-lang';

const ROUND_DATES: Record<number, string> = {
  1: '01.11.25', 2: '08.11.25', 3: '29.11.25', 4: '20.12.25',
  5: '10.01.26', 6: '17.01.26', 7: '07.02.26', 8: '21.02.26',
  9: '24.04.26', 10: '01.05.26', 11: '08.05.26',
  12: '05.06.26', 13: '12.06.26', 14: '19.06.26',
};

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function normalize(s: string) {
  return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim();
}

type StandingRow = {
  name: string; rank: number; wins: number; losses: number;
  diff: number; pts: number; games: number; pf: number; pa: number;
};

function findStat(standings: StandingRow[], name: string): StandingRow | undefined {
  const normName = normalize(name);
  return standings.find(s =>
    s.name === name || normalize(s.name) === normName ||
    normName.includes(normalize(s.name)) || normalize(s.name).includes(normName)
  );
}

export default async function GamePreviewPage({
  params,
}: {
  params: Promise<{ round: string; home: string }>;
}) {
  const { round: roundStr, home: homeEncoded } = await params;
  const round = parseInt(roundStr, 10);
  const homeTeam = decodeURIComponent(homeEncoded);
  const lang = await getLang();
  const T = (he: string) => st(he, lang);
  const en = lang === 'en';

  const game = LIBI_SCHEDULE.find(
    (g) => g.round === round && normalize(g.homeTeam) === normalize(homeTeam)
  );
  if (!game) notFound();

  // Fetch logos + standings + Supabase game details in parallel.
  //
  // Note: we deliberately do NOT filter by `game_date`. The DB row's
  // `game_date` can drift from the canonical LIBI_SCHEDULE date after a
  // reschedule (the row keeps its old date until the next Excel sync), so
  // a date filter would silently miss the row and the time/location entered
  // in admin would never appear here. Instead we filter by team pair, which
  // is unique per matchup per round and survives date drifts.
  const [teams, standingsRes, dbGamesRes, resultRes] = await Promise.all([
    getTeams(),
    supabaseAdmin.from('standings').select('name,rank,wins,losses,diff,pts,games,pf,pa').order('rank'),
    supabaseAdmin
      .from('games')
      .select('id,game_time,location,game_date,video_url,home_team:teams!games_home_team_id_fkey(name),away_team:teams!games_away_team_id_fkey(name)')
      .order('game_date', { ascending: false }),
    supabaseAdmin
      .from('game_results')
      .select('round,home_team,away_team,home_score,away_score,techni')
      .eq('round', round),
  ]);

  // Logo map
  const logoMap: Record<string, string | null> = {};
  for (const t of teams) logoMap[normalize(t.name)] = t.logo_url;
  const homeLogo = logoMap[normalize(game.homeTeam)] ?? null;
  const awayLogo = logoMap[normalize(game.awayTeam)] ?? null;

  // Standings
  const standings = (standingsRes.data ?? []) as StandingRow[];
  const homeStats = findStat(standings, game.homeTeam);
  const awayStats = findStat(standings, game.awayTeam);

  // Time + location from Supabase games table — match by team pair.
  // Rows are ordered by game_date desc, so .find() picks the newest row
  // if (rarely) more than one row exists for the same matchup.
  let gameTime: string | null = null;
  let gameLocation: string | null = null;
  let gameId: string | null = null;
  let videoUrl: string | null = null;
  const dbGames = (dbGamesRes.data ?? []) as unknown as {
    id: string;
    game_time: string;
    location: string;
    game_date: string;
    video_url: string | null;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  }[];
  // First, try to match by team pair AND the round's canonical date — handles
  // the case where the same matchup recurs across rounds (home/away swap, or
  // a rescheduled fixture leaves stale rows from earlier dates).
  const teamPairMatches = dbGames.filter(
    g =>
      normalize(g.home_team?.name ?? '') === normalize(game.homeTeam) &&
      normalize(g.away_team?.name ?? '') === normalize(game.awayTeam)
  );
  const dbMatch =
    teamPairMatches.find(g => g.game_date === game.date) ?? teamPairMatches[0];
  if (dbMatch) {
    gameId       = dbMatch.id;
    const t = dbMatch.game_time;
    gameTime     = (t && t !== '00:00:00') ? t : null;
    const l = dbMatch.location;
    gameLocation = (l && l !== 'TBD') ? l : null;
    videoUrl     = dbMatch.video_url;
  }

  // Result from game_results (matched by round + team pair)
  type ResultRow = {
    round: number; home_team: string; away_team: string;
    home_score: number; away_score: number; techni: boolean;
  };
  const resultRow = ((resultRes.data ?? []) as ResultRow[]).find(
    r =>
      normalize(r.home_team) === normalize(game.homeTeam) &&
      normalize(r.away_team) === normalize(game.awayTeam)
  );
  const isPlayed = !!resultRow;
  const homeScore = resultRow?.home_score ?? null;
  const awayScore = resultRow?.away_score ?? null;
  const techni = resultRow?.techni ?? false;
  const homeWon = isPlayed && (homeScore as number) > (awayScore as number);
  const awayWon = isPlayed && (awayScore as number) > (homeScore as number);

  // Box score: reads from players table so admin corrections via
  // "עריכת סטטיסטיקת שחקנים" are immediately reflected everywhere.
  type BoxRow = {
    player: { id: string; name: string; jersey_number: number | null };
    points: number;
    three_pointers: number;
    fouls: number;
  };
  type PlayerRow = { id: string; name: string; jersey_number: number | null; points: number; three_pointers: number; fouls: number };
  let homeBox: BoxRow[] = [];
  let awayBox: BoxRow[] = [];
  if (isPlayed) {
    const homeTeamObj = teams.find(t => normalize(t.name) === normalize(game.homeTeam));
    const awayTeamObj = teams.find(t => normalize(t.name) === normalize(game.awayTeam));
    const [homeRes, awayRes] = await Promise.all([
      homeTeamObj
        ? supabaseAdmin
            .from('players')
            .select('id,name,jersey_number,points,three_pointers,fouls')
            .eq('team_id', homeTeamObj.id)
            .or('points.gt.0,three_pointers.gt.0,fouls.gt.0')
            .order('points', { ascending: false })
        : { data: [] as PlayerRow[] },
      awayTeamObj
        ? supabaseAdmin
            .from('players')
            .select('id,name,jersey_number,points,three_pointers,fouls')
            .eq('team_id', awayTeamObj.id)
            .or('points.gt.0,three_pointers.gt.0,fouls.gt.0')
            .order('points', { ascending: false })
        : { data: [] as PlayerRow[] },
    ]);
    const toRow = (p: PlayerRow): BoxRow => ({
      player: { id: p.id, name: p.name, jersey_number: p.jersey_number },
      points: p.points ?? 0,
      three_pointers: p.three_pointers ?? 0,
      fouls: p.fouls ?? 0,
    });
    homeBox = ((homeRes.data ?? []) as PlayerRow[]).map(toRow);
    awayBox = ((awayRes.data ?? []) as PlayerRow[]).map(toRow);
  }

  const dateStr    = ROUND_DATES[round] ?? game.date;
  const dayOfWeek  = game.date
    ? (en ? EN_DAYS[new Date(game.date).getDay()] : HE_DAYS[new Date(game.date).getDay()])
    : '';
  const divLabel   = game.division === 'North' ? T('מחוז צפון') : T('מחוז דרום');
  const divColor   = game.division === 'North' ? 'text-blue-400' : 'text-orange-400';
  const divBg      = game.division === 'North' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-orange-500/10 border-orange-500/30';

  const rankColor = (rank?: number) =>
    rank === 1 ? '#e0c97a' : rank === 2 ? '#b0b8c8' : rank === 3 ? '#c87d3a' : '#8aaac8';

  return (
    <div className="space-y-6" dir={en ? 'ltr' : 'rtl'}>
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#5a7a9a] hover:text-orange-400 transition-colors">
        {en ? '← Back to Home' : '← חזרה לדף הבית'}
      </Link>

      {/* Badges */}
      <div className="flex items-center gap-3">
        <span className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-base font-black text-orange-400">
          {T('מחזור')} {round}
        </span>
        <span className={`rounded-xl border px-3 py-1.5 text-base font-black ${divColor} ${divBg}`}>
          {divLabel}
        </span>
      </div>

      {/* Main matchup card */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-6 py-3 flex items-center justify-between">
          <p className="text-base font-bold text-[#8aaac8]">
            {dayOfWeek && <span className="font-black text-white">{en ? `${dayOfWeek} · ` : `יום ${dayOfWeek} · `}</span>}
            {dateStr}
          </p>
          <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
            isPlayed
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
          }`}>
            {isPlayed ? (en ? 'Final' : 'הסתיים') : (en ? 'Upcoming' : 'קרוב')}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-10 sm:py-12">
          {/* Home team */}
          <Link href={`/team/${encodeURIComponent(game.homeTeam)}`} className="group/team flex flex-col items-center gap-3 flex-1 hover:opacity-90 transition-opacity">
            {homeStats?.rank && (
              <span className="text-xs font-black" style={{ color: rankColor(homeStats.rank) }}>
                #{homeStats.rank}
              </span>
            )}
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-white/10 bg-white/[0.05] overflow-hidden flex items-center justify-center shadow-lg group-hover/team:border-orange-500/40 transition-colors">
              {homeLogo
                ? <img src={homeLogo} alt={T(game.homeTeam)} className="h-full w-full object-cover" />
                : <span className="text-3xl font-black text-[#4a6a8a]">{[...T(game.homeTeam)].find(c => c.trim()) ?? '?'}</span>
              }
            </div>
            <div className="text-center">
              <p className={`text-base font-black leading-tight group-hover/team:text-orange-400 transition-colors ${homeWon ? 'text-orange-400' : 'text-white'}`}>{T(game.homeTeam)}</p>
              <p className="mt-0.5 text-xs text-[#5a7a9a]">{en ? 'Home Team' : 'קבוצת בית'}</p>
            </div>
          </Link>

          {/* Final score or VS */}
          {isPlayed ? (
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span className={`font-stats text-4xl sm:text-5xl font-black tabular-nums ${homeWon ? 'text-orange-400' : 'text-[#5a7a9a]'}`}>{homeScore}</span>
                <span className="text-[#5a7a9a] font-black text-2xl">:</span>
                <span className={`font-stats text-4xl sm:text-5xl font-black tabular-nums ${awayWon ? 'text-orange-400' : 'text-[#5a7a9a]'}`}>{awayScore}</span>
              </div>
              {techni && (
                <p className="text-[10px] font-black tracking-wide text-red-400">🔴 {T('הפסד טכני')}</p>
              )}
            </div>
          ) : (
            <span className="text-2xl font-black text-[#2a4a6a] shrink-0">VS</span>
          )}

          {/* Away team */}
          <Link href={`/team/${encodeURIComponent(game.awayTeam)}`} className="group/team flex flex-col items-center gap-3 flex-1 hover:opacity-90 transition-opacity">
            {awayStats?.rank && (
              <span className="text-xs font-black" style={{ color: rankColor(awayStats.rank) }}>
                #{awayStats.rank}
              </span>
            )}
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-white/10 bg-white/[0.05] overflow-hidden flex items-center justify-center shadow-lg group-hover/team:border-orange-500/40 transition-colors">
              {awayLogo
                ? <img src={awayLogo} alt={T(game.awayTeam)} className="h-full w-full object-cover" />
                : <span className="text-3xl font-black text-[#4a6a8a]">{[...T(game.awayTeam)].find(c => c.trim()) ?? '?'}</span>
              }
            </div>
            <div className="text-center">
              <p className={`text-base font-black leading-tight group-hover/team:text-orange-400 transition-colors ${awayWon ? 'text-orange-400' : 'text-white'}`}>{T(game.awayTeam)}</p>
              <p className="mt-0.5 text-xs text-[#5a7a9a]">{en ? 'Away Team' : 'קבוצת חוץ'}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Game info row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#5a7a9a]">📅 {en ? 'Date' : 'תאריך'}</p>
          <p className="text-lg font-black text-white">{dateStr}</p>
          {dayOfWeek && <p className="mt-0.5 text-xs text-[#8aaac8]">{en ? dayOfWeek : `יום ${dayOfWeek}`}</p>}
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#5a7a9a]">⏰ {en ? 'Time' : 'שעה'}</p>
          {gameTime
            ? <p className="text-lg font-black text-white">{gameTime.slice(0, 5)}</p>
            : <><p className="text-lg font-black text-[#3a5a7a]">TBD</p><p className="mt-0.5 text-xs text-[#3a5a7a]">{T('טרם נקבע')}</p></>
          }
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#5a7a9a]">📍 {en ? 'Location' : 'מיקום'}</p>
          {gameLocation
            ? <p className="text-lg font-black text-white">{gameLocation}</p>
            : <><p className="text-lg font-black text-[#3a5a7a]">{en ? 'Coming soon' : 'יתווסף בקרוב'}</p><p className="mt-0.5 text-xs text-[#3a5a7a]">{T('טרם נקבע')}</p></>
          }
        </div>
      </div>

      {/* Stats comparison */}
      {(homeStats || awayStats) && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-base font-black text-white">📊 {en ? 'Team Comparison' : 'השוואת קבוצות'}</h2>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-3 border-b border-white/[0.05] px-5 py-2.5 text-xs font-black uppercase tracking-widest text-[#8aaac8]">
            <span className={en ? 'text-left' : 'text-right'}>{T(game.homeTeam)}</span>
            <span className="text-center">{en ? 'Stat' : 'סטט'}</span>
            <span className={en ? 'text-right' : 'text-left'}>{T(game.awayTeam)}</span>
          </div>

          {[
            { label: en ? 'G (Wins)' : 'מ׳ (ניצחונות)', home: homeStats ? (en ? `${homeStats.wins}W / ${homeStats.losses}L` : `${homeStats.wins}נ / ${homeStats.losses}ה`) : '—', away: awayStats ? (en ? `${awayStats.wins}W / ${awayStats.losses}L` : `${awayStats.wins}נ / ${awayStats.losses}ה`) : '—' },
            { label: en ? 'League Points' : 'נקודות ליגה', home: homeStats?.pts  != null ? String(homeStats.pts)  : '—', away: awayStats?.pts  != null ? String(awayStats.pts)  : '—' },
            { label: en ? 'Point Diff' : 'הפרש נקודות', home: homeStats?.diff != null ? (homeStats.diff > 0 ? `+${homeStats.diff}` : String(homeStats.diff)) : '—', away: awayStats?.diff != null ? (awayStats.diff > 0 ? `+${awayStats.diff}` : String(awayStats.diff)) : '—' },
            { label: en ? 'PPG' : 'ממוצע נק׳ למשחק', home: homeStats?.games ? (homeStats.pf / homeStats.games).toFixed(1) : '—', away: awayStats?.games ? (awayStats.pf / awayStats.games).toFixed(1) : '—' },
            { label: en ? 'OPP PPG' : 'ממוצע ספיגה', home: homeStats?.games ? (homeStats.pa / homeStats.games).toFixed(1) : '—', away: awayStats?.games ? (awayStats.pa / awayStats.games).toFixed(1) : '—' },
          ].map(({ label, home, away }) => (
            <div key={label} className="grid grid-cols-3 border-b border-white/[0.04] px-5 py-3.5 last:border-0">
              <span dir="ltr" className={`text-base font-black text-white ${en ? 'text-left' : 'text-right'}`}>{home}</span>
              <span className="text-center text-xs font-semibold text-[#5a7a9a] self-center">{label}</span>
              <span dir="ltr" className={`text-base font-bold text-[#c8d8e8] ${en ? 'text-right' : 'text-left'}`}>{away}</span>
            </div>
          ))}
        </div>
      )}

      {/* Admin shortcut: jump to player stats editor */}
      {isPlayed && (
        <a
          href="/admin?tab=playerstats"
          className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-2.5 text-xs font-bold text-[#5a7a9a] hover:text-orange-400 hover:border-orange-500/30 transition-colors w-fit"
        >
          ✏️ {en ? 'Edit Player Stats (Admin)' : 'עריכת סטטיסטיקת שחקנים (מנהל)'}
        </a>
      )}

      {/* Box score — per-player stats for finished games */}
      {isPlayed && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-base font-black text-white">📋 {en ? 'Box Score' : 'גיליון סטטיסטיקה'}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-white/[0.05]">
            {/* Home team box */}
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                {homeLogo
                  ? <img src={homeLogo} alt={T(game.homeTeam)} className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover" />
                  : <div className="h-8 w-8 shrink-0 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[10px] font-black text-[#3a5a7a]">{[...T(game.homeTeam)].find(c => c.trim()) ?? '?'}</div>
                }
                <p className={`text-base font-black ${homeWon ? 'text-orange-400' : 'text-white'}`}>{T(game.homeTeam)}</p>
                <span className={`ml-auto font-stats text-3xl font-black tabular-nums ${homeWon ? 'text-orange-400' : 'text-[#8aaac8]'}`}>{homeScore}</span>
              </div>
              {homeBox.length === 0 ? (
                <p className="text-xs text-[#5a7a9a] py-4 text-center">{en ? 'No player stats yet' : 'אין נתוני שחקנים'}</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs font-black uppercase tracking-widest text-[#8aaac8] border-b border-white/[0.06]">
                      <th className={`py-2 ${en ? 'text-left' : 'text-right'}`}>{en ? 'Player' : 'שחקן'}</th>
                      <th className="py-2 text-center w-10">#</th>
                      <th className="py-2 text-center w-10">{T('נק׳')}</th>
                      <th className="py-2 text-center w-10">3PT</th>
                      <th className="py-2 text-center w-10">{en ? 'F' : 'עב'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {homeBox.map((row, i) => (
                      <tr key={i} className="border-b border-white/[0.04] last:border-0">
                        <td className={`py-2 text-sm font-bold text-white ${en ? 'text-left' : 'text-right'}`}>
                          <Link href={row.player ? `/players/${row.player.id}` : '#'} className="hover:text-orange-400 transition-colors">
                            {row.player?.name ?? '—'}
                          </Link>
                        </td>
                        <td className="py-2 text-center text-sm text-[#8aaac8] font-stats tabular-nums">{row.player?.jersey_number ?? '—'}</td>
                        <td className="py-2 text-center font-stats text-base font-black text-orange-400 tabular-nums">{row.points}</td>
                        <td className="py-2 text-center font-stats text-sm font-bold text-[#e0c97a] tabular-nums">{row.three_pointers}</td>
                        <td className="py-2 text-center font-stats text-sm font-bold text-red-400 tabular-nums">{row.fouls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Away team box */}
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                {awayLogo
                  ? <img src={awayLogo} alt={T(game.awayTeam)} className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover" />
                  : <div className="h-8 w-8 shrink-0 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[10px] font-black text-[#3a5a7a]">{[...T(game.awayTeam)].find(c => c.trim()) ?? '?'}</div>
                }
                <p className={`text-base font-black ${awayWon ? 'text-orange-400' : 'text-white'}`}>{T(game.awayTeam)}</p>
                <span className={`ml-auto font-stats text-3xl font-black tabular-nums ${awayWon ? 'text-orange-400' : 'text-[#8aaac8]'}`}>{awayScore}</span>
              </div>
              {awayBox.length === 0 ? (
                <p className="text-xs text-[#5a7a9a] py-4 text-center">{en ? 'No player stats yet' : 'אין נתוני שחקנים'}</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs font-black uppercase tracking-widest text-[#8aaac8] border-b border-white/[0.06]">
                      <th className={`py-2 ${en ? 'text-left' : 'text-right'}`}>{en ? 'Player' : 'שחקן'}</th>
                      <th className="py-2 text-center w-10">#</th>
                      <th className="py-2 text-center w-10">{T('נק׳')}</th>
                      <th className="py-2 text-center w-10">3PT</th>
                      <th className="py-2 text-center w-10">{en ? 'F' : 'עב'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awayBox.map((row, i) => (
                      <tr key={i} className="border-b border-white/[0.04] last:border-0">
                        <td className={`py-2 text-sm font-bold text-white ${en ? 'text-left' : 'text-right'}`}>
                          <Link href={row.player ? `/players/${row.player.id}` : '#'} className="hover:text-orange-400 transition-colors">
                            {row.player?.name ?? '—'}
                          </Link>
                        </td>
                        <td className="py-2 text-center text-sm text-[#8aaac8] font-stats tabular-nums">{row.player?.jersey_number ?? '—'}</td>
                        <td className="py-2 text-center font-stats text-base font-black text-orange-400 tabular-nums">{row.points}</td>
                        <td className="py-2 text-center font-stats text-sm font-bold text-[#e0c97a] tabular-nums">{row.three_pointers}</td>
                        <td className="py-2 text-center font-stats text-sm font-bold text-red-400 tabular-nums">{row.fouls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Top scorer highlight */}
          {(() => {
            const all = [...homeBox.map(r => ({ ...r, side: 'home' as const })), ...awayBox.map(r => ({ ...r, side: 'away' as const }))];
            const top = all.sort((a, b) => b.points - a.points)[0];
            if (!top || top.points === 0 || !top.player) return null;
            const teamName = top.side === 'home' ? game.homeTeam : game.awayTeam;
            return (
              <div className="border-t border-white/[0.06] bg-orange-500/[0.04] px-5 py-3 flex items-center gap-2 text-sm">
                <span className="text-base">🏆</span>
                <span className="font-bold text-[#8aaac8]">{en ? 'Top Scorer:' : 'מוביל הסלים:'}</span>
                <Link href={`/players/${top.player.id}`} className="font-black text-white hover:text-orange-400 transition-colors">
                  {top.player.name}
                </Link>
                <span className="text-[#5a7a9a]">·</span>
                <span className="text-[#5a7a9a] text-xs">{T(teamName)}</span>
                <span className="ml-auto font-stats font-black text-orange-400 text-lg">{top.points}</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Video link */}
      {videoUrl && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-3 text-sm font-bold text-orange-400 hover:bg-orange-500/20 transition-colors"
        >
          🎬 {en ? 'Watch Game Video' : 'צפה בסרטון המשחק'}
        </a>
      )}
    </div>
  );
}
