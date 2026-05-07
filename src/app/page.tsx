export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NORTH_TABLE, SOUTH_TABLE, CURRENT_ROUND, TOTAL_ROUNDS } from '@/lib/league-data';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import { getTeams } from '@/lib/supabase';
import ScoreboardStrip from '@/components/ScoreboardStrip';
import LastRoundResults from '@/components/LastRoundResults';
import { getLang, st } from '@/lib/get-lang';

const ROUND_DATES: Record<number, string> = {
  1: '01.11.25', 2: '08.11.25', 3: '29.11.25', 4:  '20.12.25',
  5: '10.01.26', 6: '17.01.26', 7: '07.02.26', 8:  '21.02.26',
  9: '24.04.26', 10: '01.05.26', 11: '08.05.26',
  12: '05.06.26', 13: '12.06.26', 14: '19.06.26',
};

type Standing = { rank: number; name: string; wins: number; losses: number; pts: number; pf: number; division: string };
type GameRow  = { round: number; date: string; home_team: string; away_team: string; home_score: number; away_score: number; techni: boolean };

type ActiveAnnouncement = { id: string; message: string; type: string; bg_color: string };

const BG_COLOR_CLASSES: Record<string, string> = {
  orange: 'bg-orange-500',
  red: 'bg-red-600',
  blue: 'bg-blue-600',
  green: 'bg-green-600',
};

async function getActiveAnnouncements(): Promise<ActiveAnnouncement[]> {
  try {
    const { data } = await supabaseAdmin
      .from('announcements')
      .select('id,message,type,bg_color')
      .eq('active', true)
      .order('created_at', { ascending: false });
    return (data ?? []) as ActiveAnnouncement[];
  } catch {
    return [];
  }
}

type TopPlayer = {
  id: string;
  name: string;
  photo_url: string | null;
  jersey_number: number | null;
  team_name: string | null;
  points: number;
  three_pointers: number;
  fouls: number;
};

type RosterEntry = { name: string; jersey_number: number | null };

// Key: "homeTeamName|awayTeamName" → { location, time }
//
// We deliberately do NOT key by date. The DB `games.game_date` can drift from
// the canonical LIBI_SCHEDULE date (e.g. after a reschedule, the row keeps its
// old date until the next Excel sync). Keying by team pair only — which is
// unique per matchup per round — survives those drifts so admin-entered
// time/location still surfaces in the public UI.
// Fuzzy team-name resolver: tries exact normalized match first, then
// falls back to substring match in either direction. This is what allows
// schedule names like "אדיס אשדוד" to resolve to DB team
// "שועלי אדיס אשדוד" (or vice versa).
function resolveTeamId(
  name: string,
  norm: (s: string) => string,
  teams: { id: string; name: string }[],
): string | null {
  const target = norm(name);
  if (!target) return null;
  const exact = teams.find((t) => norm(t.name) === target);
  if (exact) return exact.id;
  const sub = teams.find((t) => {
    const n = norm(t.name);
    return n.includes(target) || target.includes(n);
  });
  return sub?.id ?? null;
}

async function getGameDetails(games: { home: string; away: string }[]): Promise<Record<string, { location: string; time: string }>> {
  if (!games.length) return {};
  try {
    const { data: teamsData } = await supabaseAdmin.from('teams').select('id, name');
    if (!teamsData) return {};
    function norm(s: string) { return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }

    const ids = new Set<string>();
    // Track which schedule name resolves to which DB team id so we can
    // re-key the result back to the schedule name later.
    const scheduleNameToId = new Map<string, string>();
    for (const g of games) {
      const hId = resolveTeamId(g.home, norm, teamsData);
      const aId = resolveTeamId(g.away, norm, teamsData);
      if (hId) { ids.add(hId); scheduleNameToId.set(g.home, hId); }
      if (aId) { ids.add(aId); scheduleNameToId.set(g.away, aId); }
    }
    if (!ids.size) return {};

    const { data: dbGames } = await supabaseAdmin
      .from('games')
      .select('home_team_id, away_team_id, game_date, game_time, location')
      .in('home_team_id', [...ids])
      .in('away_team_id', [...ids])
      .order('game_date', { ascending: true });

    // Build id → schedule-name lookup so the result keys match what the
    // page builds with normKey(g.homeTeam)|normKey(g.awayTeam).
    const idToScheduleName = new Map<string, string>();
    for (const [scheduleName, id] of scheduleNameToId) {
      idToScheduleName.set(id, scheduleName);
    }

    const result: Record<string, { location: string; time: string }> = {};
    // Iterate in date-asc order so that, if two rows exist for the same
    // matchup (rare — only after a reschedule that left both rows behind),
    // the newer row's data wins by overwriting the older.
    for (const g of dbGames ?? []) {
      const homeScheduleName = idToScheduleName.get(g.home_team_id);
      const awayScheduleName = idToScheduleName.get(g.away_team_id);
      if (!homeScheduleName || !awayScheduleName) continue;
      const key  = `${norm(homeScheduleName)}|${norm(awayScheduleName)}`;
      const loc  = (g.location && g.location !== 'TBD') ? g.location : '';
      const time = (g.game_time && g.game_time !== '00:00:00') ? g.game_time.slice(0, 5) : '';
      if (loc || time) result[key] = { location: loc, time };
    }
    return result;
  } catch { return {}; }
}

async function getTeamRosters(teamNames: string[]): Promise<Record<string, RosterEntry[]>> {
  if (!teamNames.length) return {};
  try {
    const { data: teamsData } = await supabaseAdmin
      .from('teams')
      .select('id, name');
    if (!teamsData) return {};

    function norm(s: string) { return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }

    // Map each requested schedule name to the matching DB team id, using
    // exact-then-substring resolution so naming drift (e.g. schedule says
    // "אדיס אשדוד", DB row is "שועלי אדיס אשדוד") doesn't drop the roster.
    const scheduleNameToId = new Map<string, string>();
    const ids = new Set<string>();
    for (const tn of teamNames) {
      const id = resolveTeamId(tn, norm, teamsData);
      if (id) {
        scheduleNameToId.set(tn, id);
        ids.add(id);
      }
    }
    if (!ids.size) return {};

    const { data: playersData } = await supabaseAdmin
      .from('players')
      .select('name, jersey_number, team_id')
      .eq('is_active', true)
      .in('team_id', [...ids])
      .order('jersey_number', { ascending: true });

    // Reverse map: db team id → original schedule name(s). One DB team
    // could potentially be matched by multiple schedule names; route
    // players to every matching original key so all keys see the roster.
    const idToScheduleNames = new Map<string, string[]>();
    for (const [scheduleName, id] of scheduleNameToId) {
      const arr = idToScheduleNames.get(id) ?? [];
      arr.push(scheduleName);
      idToScheduleNames.set(id, arr);
    }

    const rosters: Record<string, RosterEntry[]> = {};
    for (const p of playersData ?? []) {
      const originals = idToScheduleNames.get(p.team_id) ?? [];
      for (const original of originals) {
        if (!rosters[original]) rosters[original] = [];
        rosters[original].push({ name: p.name, jersey_number: p.jersey_number });
      }
    }
    return rosters;
  } catch {
    return {};
  }
}

async function getTopScorers(): Promise<TopPlayer[]> {
  try {
    const { data } = await supabaseAdmin
      .from('players')
      .select('id, name, photo_url, jersey_number, points, three_pointers, fouls, team:teams(name)')
      .eq('is_active', true)
      .gt('points', 0)
      .order('points', { ascending: false })
      .limit(5);

    return ((data ?? []) as unknown as {
      id: string; name: string; photo_url: string | null; jersey_number: number | null;
      points: number; three_pointers: number; fouls: number;
      team: { name: string } | null;
    }[]).map(p => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      jersey_number: p.jersey_number,
      team_name: p.team?.name ?? null,
      points: p.points,
      three_pointers: p.three_pointers,
      fouls: p.fouls,
    }));
  } catch {
    return [];
  }
}

async function getTickerSpeed(): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('value')
      .eq('key', 'ticker_speed')
      .maybeSingle();
    return data?.value ? parseInt(data.value, 10) : 25;
  } catch {
    return 25;
  }
}

async function getLiveData() {
  try {
    const [{ data: standings }, { data: results }] = await Promise.all([
      supabaseAdmin.from('standings').select('rank,name,wins,losses,pts,pf,division').order('rank'),
      supabaseAdmin.from('game_results').select('round,date,home_team,away_team,home_score,away_score,techni').order('round'),
    ]);

    if (!standings || standings.length === 0) throw new Error('no standings');

    const north = (standings as Standing[]).filter((s) => s.division === 'North');
    const south = (standings as Standing[]).filter((s) => s.division === 'South');
    const northLeader = north[0] ?? NORTH_TABLE[0];
    const southLeader = south[0] ?? SOUTH_TABLE[0];
    // Top "basket scorer" team per division — highest accumulated points-for (pf)
    const southTopScorer = [...south].sort((a, b) => (b.pf ?? 0) - (a.pf ?? 0))[0] ?? SOUTH_TABLE[0];
    const northTopScorer = [...north].sort((a, b) => (b.pf ?? 0) - (a.pf ?? 0))[0] ?? NORTH_TABLE[0];

    const games = (results ?? []) as GameRow[];
    const gamesPlayed  = games.filter((g) => !g.techni).length;
    const currentRound = games.length > 0 ? Math.max(...games.map((g) => g.round)) : CURRENT_ROUND;

    // Season records
    let highScore   = { score: 0, team: '', opp: '', round: 0, date: '' };
    let highCombined = { sh: 0, sa: 0, home: '', away: '', round: 0, date: '' };
    let biggestWin  = { sh: 0, sa: 0, home: '', away: '', round: 0, date: '' };
    let closestCount = 0;

    for (const g of games) {
      if (g.techni) continue;
      const combined = g.home_score + g.away_score;
      const margin   = Math.abs(g.home_score - g.away_score);

      if (g.home_score > highScore.score) highScore = { score: g.home_score, team: g.home_team, opp: g.away_team, round: g.round, date: g.date };
      if (g.away_score > highScore.score) highScore = { score: g.away_score, team: g.away_team, opp: g.home_team, round: g.round, date: g.date };
      if (combined > highCombined.sh + highCombined.sa) highCombined = { sh: g.home_score, sa: g.away_score, home: g.home_team, away: g.away_team, round: g.round, date: g.date };
      if (margin > Math.abs(biggestWin.sh - biggestWin.sa)) biggestWin = { sh: g.home_score, sa: g.away_score, home: g.home_team, away: g.away_team, round: g.round, date: g.date };
      if (margin <= 3) closestCount++;
    }

    return { northLeader, southLeader, southTopScorer, northTopScorer, gamesPlayed, currentRound, highScore, highCombined, biggestWin, closestCount };
  } catch {
    // fallback to static data
    const fbSouthTop = [...SOUTH_TABLE].sort((a, b) => (b.pf ?? 0) - (a.pf ?? 0))[0];
    const fbNorthTop = [...NORTH_TABLE].sort((a, b) => (b.pf ?? 0) - (a.pf ?? 0))[0];
    return {
      northLeader: NORTH_TABLE[0],
      southLeader: SOUTH_TABLE[0],
      southTopScorer: fbSouthTop,
      northTopScorer: fbNorthTop,
      gamesPlayed: 56,
      currentRound: CURRENT_ROUND,
      highScore:    { score: 81, team: 'חולון', opp: 'כ.ע. בת-ים', round: 7, date: '07.02.26' },
      highCombined: { sh: 75, sa: 57, home: 'גוטלמן השרון', away: 'כ.ע. בת-ים', round: 4, date: '20.12.25' },
      biggestWin:   { sh: 75, sa: 57, home: 'גוטלמן השרון', away: 'כ.ע. בת-ים', round: 4, date: '20.12.25' },
      closestCount: 4,
    };
  }
}

type CupFinal = { date: string; home_team: string; away_team: string; home_score: number | null; away_score: number | null; played: boolean } | null;

async function getCupFinal(): Promise<CupFinal> {
  try {
    const { data } = await supabaseAdmin
      .from('cup_games')
      .select('date, home_team, away_team, home_score, away_score, played')
      .eq('round', 'גמר')
      .maybeSingle();
    return data as CupFinal;
  } catch { return null; }
}

async function getRoundDates(): Promise<Record<number, string>> {
  try {
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('value')
      .eq('key', 'round_dates')
      .maybeSingle();
    if (!data?.value) return {};
    const parsed = JSON.parse(data.value) as Record<string, string>;
    const result: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[parseInt(k)] = String(v);
    }
    return result;
  } catch { return {}; }
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon, colorClass }: { value: string; label: string; icon: string; colorClass: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5">
      <div className={`absolute top-0 right-0 left-0 h-0.5 ${colorClass}`} />
      <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#8aaac8] font-body">{icon} {label}</p>
      <p className="text-3xl font-black text-white font-stats">{value}</p>
    </div>
  );
}

function RecordCard({ icon, label, value, sub, detail, color }: { icon: string; label: string; value: string; sub: string; detail: string; color: string }) {
  return (
    <div className="relative rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5" style={{ borderRightWidth: 4, borderRightColor: color }}>
      <div className="mb-2 text-2xl">{icon}</div>
      <p className="mb-1 text-[11px] font-bold tracking-wide text-[#8aaac8] font-body">{label}</p>
      <p dir="ltr" className="text-3xl font-black leading-none text-right font-stats" style={{ color }}>{value}</p>
      <p className="mt-2 text-base font-bold text-[#c8d8e8] font-heading">{sub}</p>
      <p className="mt-1 text-sm font-bold text-[#8aaac8] font-body">{detail}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [liveData, activeAnnouncements, teams, tickerSpeed, topScorers, lang, dbRoundDates, cupFinal] = await Promise.all([
    getLiveData(),
    getActiveAnnouncements(),
    getTeams(),
    getTickerSpeed(),
    getTopScorers(),
    getLang(),
    getRoundDates(),
    getCupFinal(),
  ]);

  const nextRoundEarly = liveData.currentRound + 1;
  const nextRoundSchedule = LIBI_SCHEDULE.filter(g => g.round === nextRoundEarly);
  const gameDetails = await getGameDetails(
    nextRoundSchedule.map(g => ({ home: g.homeTeam, away: g.awayTeam }))
  );
  const T = (he: string) => st(he, lang);

  // Merge static ROUND_DATES with DB values (DB takes priority)
  const ROUND_DATES_MERGED: Record<number, string> = { ...ROUND_DATES, ...dbRoundDates };

  // Build logo lookup
  function norm(s: string) { return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim(); }
  const logoMap: Record<string, string | null> = {};
  for (const t of teams) logoMap[norm(t.name)] = t.logo_url;

  // Resolve a schedule team name to its current DB name. The admin "קבוצות"
  // tab is the single source of truth for display names — anything the
  // admin renames must show on the public UI. Falls back to exact-then-
  // substring match against the teams table.
  function dbDisplayName(scheduleName: string): string {
    function nm(s: string) { return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    const target = nm(scheduleName);
    if (!target) return scheduleName;
    const exact = teams.find((t) => nm(t.name) === target);
    if (exact) return exact.name;
    const sub = teams.find((t) => {
      const n = nm(t.name);
      return n.includes(target) || target.includes(n);
    });
    return sub?.name ?? scheduleName;
  }

  const {
    northLeader, southLeader,
    southTopScorer, northTopScorer,
    gamesPlayed, currentRound,
    highScore, highCombined, biggestWin, closestCount,
  } = liveData;

  // Overall league scoring leader — whichever division top has more baskets
  const leagueTopScorer = (northTopScorer.pf ?? 0) >= (southTopScorer.pf ?? 0)
    ? northTopScorer
    : southTopScorer;

  const biggestMargin = Math.abs(biggestWin.sh - biggestWin.sa);
  const biggestWinner = biggestWin.sh > biggestWin.sa ? biggestWin.home : biggestWin.away;
  const biggestLoser  = biggestWin.sh > biggestWin.sa ? biggestWin.away : biggestWin.home;

  const nextRound = currentRound + 1;
  const nextDate  = ROUND_DATES_MERGED[nextRound] ?? '';

  // Scoreboard strip — all games for next round combined, with DB location/time.
  // Team names are resolved through the DB so admin renames (Teams tab) take
  // effect on the public UI immediately.
  function normKey(s: string) { return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  const allNextGames: { home: string; away: string; div: 'North' | 'South'; homeLogo: string | null; awayLogo: string | null; location?: string; time?: string }[] = [
    ...LIBI_SCHEDULE.filter((g) => g.round === nextRound && g.division === 'South').map(g => {
      const home = dbDisplayName(g.homeTeam);
      const away = dbDisplayName(g.awayTeam);
      const det = gameDetails[`${normKey(g.homeTeam)}|${normKey(g.awayTeam)}`];
      return { home, away, div: 'South' as const,
        homeLogo: logoMap[norm(home)] ?? logoMap[norm(g.homeTeam)] ?? null,
        awayLogo: logoMap[norm(away)] ?? logoMap[norm(g.awayTeam)] ?? null,
        location: det?.location, time: det?.time };
    }),
    ...LIBI_SCHEDULE.filter((g) => g.round === nextRound && g.division === 'North').map(g => {
      const home = dbDisplayName(g.homeTeam);
      const away = dbDisplayName(g.awayTeam);
      const det = gameDetails[`${normKey(g.homeTeam)}|${normKey(g.awayTeam)}`];
      return { home, away, div: 'North' as const,
        homeLogo: logoMap[norm(home)] ?? logoMap[norm(g.homeTeam)] ?? null,
        awayLogo: logoMap[norm(away)] ?? logoMap[norm(g.awayTeam)] ?? null,
        location: det?.location, time: det?.time };
    }),
  ];
  const nextDateRaw = LIBI_SCHEDULE.find(g => g.round === nextRound)?.date ?? '';
  const heDay = nextDateRaw
    ? (lang === 'en'
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(nextDateRaw).getDay()]
        : ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][new Date(nextDateRaw).getDay()])
    : '';

  // Fetch rosters for teams playing next round
  const nextRoundTeamNames = allNextGames.flatMap(g => [g.home, g.away]);
  const teamRosters = await getTeamRosters(nextRoundTeamNames);

  const banners   = activeAnnouncements.filter((a) => a.type === 'banner');
  const tickers   = activeAnnouncements.filter((a) => a.type === 'ticker');

  return (
    <div className="space-y-8">
      {/* Banners */}
      {banners.map((ann) => (
        <div
          key={ann.id}
          className={`w-full px-4 py-3 text-center text-sm font-bold text-white ${BG_COLOR_CLASSES[ann.bg_color] ?? 'bg-orange-500'}`}
        >
          {ann.message}
        </div>
      ))}

      {/* Tickers */}
      {tickers.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-[#0d1a28] border border-white/[0.07] py-2">
          {/* Two identical groups — pr-16 on each ensures seam gap == inter-item gap */}
          <div
            className="flex w-max"
            style={{ animation: `marquee ${tickerSpeed}s linear infinite` }}
          >
            {[0, 1].map(copy => (
              <div key={copy} className="flex items-center gap-16 pr-16">
                {tickers.map(ann => (
                  <span key={ann.id} className="inline-flex items-center gap-2 text-sm font-medium text-[#e8edf5] whitespace-nowrap">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${BG_COLOR_CLASSES[ann.bg_color] ?? 'bg-orange-500'}`} />
                    {ann.message}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NBA-style Scoreboard Strip ── */}
      {allNextGames.length > 0 && nextRound <= TOTAL_ROUNDS && (
        <ScoreboardStrip
          games={allNextGames}
          nextRound={nextRound}
          nextDate={nextDate}
          heDay={heDay}
          teamRosters={teamRosters}
        />
      )}

      {/* ── Last Round Results ── */}
      <LastRoundResults />

      <div>
        <h1 className="text-3xl font-black text-white font-heading">{T('סקירה כללית')}</h1>
        <p className="mt-1 text-sm font-bold text-[#8aaac8] font-body">{lang === 'en' ? `Season 2025–2026 · Through Round ${currentRound}` : `עונת 2025–2026 · עד מחזור ${currentRound}`}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <a href="/teams" className="block hover:opacity-80 transition-opacity">
          <StatCard value="15"                    label={T('קבוצות')}        icon="🏀" colorClass="bg-gradient-to-l from-transparent to-orange-500" />
        </a>
        <a href="/games?filter=finished" className="block hover:opacity-80 transition-opacity">
          <StatCard value={String(gamesPlayed)}   label={T('משחקי ליגה')}    icon="📊" colorClass="bg-gradient-to-l from-transparent to-green-500"  />
        </a>
        <StatCard value={String(currentRound)}  label={T('מחזורים עד כה')} icon="📆" colorClass="bg-gradient-to-l from-transparent to-yellow-400" />
        <StatCard value={String(TOTAL_ROUNDS)}  label={T('מחזורי עונה')}   icon="🗓" colorClass="bg-gradient-to-l from-transparent to-blue-500"   />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[
          { label: T('🥇 מוביל צפון'), team: northLeader },
          { label: T('🥇 מוביל דרום'), team: southLeader },
        ].map(({ label, team }) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.04]" style={{ borderTop: '3px solid #e0c97a' }}>
            <div className="p-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#8aaac8] font-body">{label}</p>
              <Link href={`/team/${encodeURIComponent(team.name)}`} className="text-xl font-black text-[#e0c97a] hover:underline underline-offset-2 transition-colors font-heading">{T(team.name)}</Link>
              <p className="mt-1 text-sm font-bold text-[#8aaac8] font-body">
                {lang === 'en' ? `${team.wins}W / ${team.losses}L · ` : `${team.wins}נ / ${team.losses}ה · `}
                <span className="font-bold text-orange-400 font-stats">{team.pts} {lang === 'en' ? 'pts' : 'נקודות'}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white font-heading">
          <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">🏆</span>
          {T('ביצועי שיא עונה')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RecordCard icon="🏀" label={T('שיא סלים במשחק')} value={String(highScore.score)}
            sub={`${T(highScore.team)} ${lang === 'en' ? 'vs' : 'נגד'} ${T(highScore.opp)}`}
            detail={`${T('מחזור')} ${highScore.round} · ${highScore.date}`} color="#FF6B1A" />
          <RecordCard icon="🔢" label={T('שיא סלים משני הצדדים')} value={String(highCombined.sh + highCombined.sa)}
            sub={`${T(highCombined.home)} ${highCombined.sh} – ${highCombined.sa} ${T(highCombined.away)}`}
            detail={`${T('מחזור')} ${highCombined.round} · ${highCombined.date}`} color="#e0c97a" />
          <RecordCard icon="💥" label={T('הפרש גדול ביותר')} value={`+${biggestMargin}`}
            sub={`${T(biggestWinner)} ${lang === 'en' ? 'vs' : 'נגד'} ${T(biggestLoser)}`}
            detail={`${T('מחזור')} ${biggestWin.round} · ${biggestWin.date}`} color="#4ec97a" />
          <a href="/games?filter=close" className="block hover:opacity-80 transition-opacity">
            <RecordCard icon="📉" label={T('משחקים שהוכרעו ב-3 נקודות או פחות')} value={String(closestCount)}
              sub={lang === 'en' ? 'Small margin' : 'הפרש קטן'} detail={lang === 'en' ? 'All season so far' : 'כל עונה עד כה'} color="#e05a5a" />
          </a>
        </div>
      </section>

      {/* ── Top Scorers ────────────────────────────────────────────────── */}
      {topScorers.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white font-heading">
            <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">🏅</span>
            {T('קלעי הליגה')}
          </h2>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
            {/* Column header — desktop only */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] text-[11px] font-black uppercase tracking-widest text-[#8aaac8]">
              <span className="w-6 shrink-0 text-center">#</span>
              <span className="w-9 shrink-0" />
              <span className="flex-1">{lang === 'en' ? 'Player' : 'שחקן'}</span>
              <span className="w-12 text-center">{T('נק׳')}</span>
              <span className="w-12 text-center">{T('3נק׳')}</span>
              <span className="w-12 text-center">{T('פאולים')}</span>
            </div>

            {topScorers.map((p, i) => {
              const MEDAL  = ['🥇', '🥈', '🥉'];
              const medal  = MEDAL[i] ?? null;
              const rankColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
              const maxPts = topScorers[0].points || 1;
              return (
                <a
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Rank */}
                  <span className={`w-6 shrink-0 text-center text-sm font-black ${rankColors[i] ?? 'text-[#5a7a9a]'}`}>
                    {medal ?? <span className="text-xs font-black text-[#8aaac8]">{i + 1}</span>}
                  </span>

                  {/* Avatar */}
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-black text-[#4a6a8a]">
                        {p.name.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Name + team + bar */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold text-white group-hover:text-orange-300 transition-colors leading-tight font-heading">
                      {p.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {p.jersey_number !== null && (
                        <span className="text-[10px] font-bold text-orange-400/70 shrink-0 font-stats">#{p.jersey_number}</span>
                      )}
                      {p.team_name && (
                        <span className="truncate text-[11px] font-bold text-[#8aaac8] font-body">{T(p.team_name)}</span>
                      )}
                    </div>
                    <div className="mt-1 h-0.5 w-full rounded-full bg-white/[0.06]">
                      <div
                        className="h-0.5 rounded-full bg-gradient-to-l from-orange-500 to-orange-700"
                        style={{ width: `${Math.round((p.points / maxPts) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Points */}
                  <div className="w-10 sm:w-12 shrink-0 text-center">
                    <p className="text-base font-black text-orange-400 font-stats">{p.points}</p>
                    <p className="text-[10px] font-bold text-[#8aaac8] font-body">{T('נק׳')}</p>
                  </div>

                  {/* 3PT */}
                  <div className="w-10 sm:w-12 shrink-0 text-center">
                    <p className="text-sm font-black text-sky-400 font-stats">{p.three_pointers}</p>
                    <p className="text-[10px] font-bold text-[#8aaac8] font-body">{T('3נק׳')}</p>
                  </div>

                  {/* Fouls */}
                  <div className="w-10 sm:w-12 shrink-0 text-center">
                    <p className="text-sm font-black text-rose-400 font-stats">{p.fouls}</p>
                    <p className="text-[10px] font-bold text-[#8aaac8] font-body">{T('פאולים')}</p>
                  </div>
                </a>
              );
            })}
          </div>
          <div className="mt-2 text-right">
            <a href="/scorers" className="text-sm font-bold text-[#8aaac8] hover:text-orange-400 transition-colors">
              {lang === 'en' ? 'League Scorers →' : 'רשימת קלעי הליגה ←'}
            </a>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-bold text-[#e0c97a] font-heading">📋 {T('עובדות עונה')}</h2>
        </div>
        <div className="grid grid-cols-1 divide-y divide-white/[0.05] sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
          <div className="p-5">
            <p className="mb-1 text-sm font-bold text-[#8aaac8] font-body">{T('מוביל סלים בליגה')}</p>
            <Link href={`/team/${encodeURIComponent(leagueTopScorer.name)}`} className="text-base font-black text-green-400 hover:underline underline-offset-2 transition-colors font-heading">
              {T(leagueTopScorer.name)}
            </Link>
            <p className="text-sm font-bold text-[#8aaac8] font-stats">
              {leagueTopScorer.pf ?? 0} <span className="font-body">{T('סלים')}</span>
            </p>
          </div>
          <Link href="/cup" className="group block p-5 transition-colors hover:bg-white/[0.03]">
            <p className="mb-1 text-sm font-bold text-[#8aaac8] font-body">
              {T('גמר הגביע')}
              <span className="ms-1 text-[#e0c97a] opacity-0 transition-opacity group-hover:opacity-100">←</span>
            </p>
            {cupFinal ? (
              <>
                <p className="text-base font-black text-[#e0c97a] transition-colors group-hover:text-yellow-300 font-heading">
                  {cupFinal.played && cupFinal.home_score !== null
                    ? <><span className="font-heading">{T(cupFinal.home_team)}</span> <span className="font-stats">{cupFinal.home_score}–{cupFinal.away_score}</span> <span className="font-heading">{T(cupFinal.away_team)}</span></>
                    : cupFinal.date || '—'}
                </p>
                <p className="text-sm font-bold text-[#8aaac8] font-body">
                  {cupFinal.played
                    ? (lang === 'en' ? 'Final result' : `${cupFinal.date}`)
                    : `${T(cupFinal.home_team)} vs ${T(cupFinal.away_team)}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-black text-[#e0c97a] transition-colors group-hover:text-yellow-300">—</p>
                <p className="text-sm font-bold text-[#8aaac8] font-body">{lang === 'en' ? 'TBD' : 'טרם נקבע'}</p>
              </>
            )}
          </Link>
          <div className="p-5">
            <p className="mb-1 text-sm font-bold text-[#8aaac8] font-body">{T('מחזורים שנותרו')}</p>
            <p className="text-3xl font-black text-blue-400 font-stats">{TOTAL_ROUNDS - currentRound}</p>
            <p className="text-sm font-bold text-[#8aaac8] font-body">{lang === 'en' ? `out of ${TOTAL_ROUNDS} rounds` : `מתוך ${TOTAL_ROUNDS} מחזורים`}</p>
          </div>
        </div>
      </section>

    </div>
  );
}
