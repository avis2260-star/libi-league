export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NORTH_TABLE, SOUTH_TABLE, CURRENT_ROUND, TOTAL_ROUNDS } from '@/lib/league-data';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import { getTeams } from '@/lib/supabase';
import ScoreboardStrip from '@/components/ScoreboardStrip';
import PlayoffScoreboardStrip, { type PlayoffStripGame } from '@/components/PlayoffScoreboardStrip';
import DelayedGames, { type DelayedPendingCard, type DelayedFinishedCard } from '@/components/DelayedGames';
import { scheduleEntryForFixture } from '@/lib/game-round';
import LastRoundResults from '@/components/LastRoundResults';
import PlayoffResults from '@/components/PlayoffResults';
import UpcomingEvents, { type UpcomingEvent } from '@/components/UpcomingEvents';
import ChampionBanner, { type ChampionBannerProps } from '@/components/ChampionBanner';
import { getSeasonPhaseSetting, resolveSeasonPhase } from '@/lib/season-phase';
import { deriveCupScores, type CupGameLike } from '@/lib/cup-derived-scores';
import { getLang, st } from '@/lib/get-lang';
import { displayName } from '@/lib/names';
import { makeNameResolver } from '@/lib/team-name-resolver';
import { getCurrentSeason } from '@/lib/current-season';
import { getAutoTickerItems } from '@/lib/ticker-auto-data';
import { autoTickerMessage } from '@/lib/ticker-auto';

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

// Admin-chosen reviews (before / after the cup final) for the cup hero card.
// IDs live in league_settings.cup_hero_reviews; only current-season, published
// reviews are surfaced so a stale cross-season pick silently drops out.
type HeroReviewLink = { id: string; title: string };
async function getCupHeroReviews(season: string): Promise<{ before: HeroReviewLink | null; after: HeroReviewLink | null }> {
  try {
    const { data: cfgRow } = await supabaseAdmin
      .from('league_settings')
      .select('value')
      .eq('key', 'cup_hero_reviews')
      .maybeSingle();
    if (!cfgRow?.value) return { before: null, after: null };
    const cfg = JSON.parse(cfgRow.value) as { before?: string | null; after?: string | null };
    const ids = [cfg.before, cfg.after].filter((x): x is string => !!x);
    if (ids.length === 0) return { before: null, after: null };

    const { data } = await supabaseAdmin
      .from('season_reviews')
      .select('id, title')
      .in('id', ids)
      .eq('season', season)
      .eq('is_published', true);
    const byId = new Map(((data ?? []) as { id: string; title: string }[]).map(r => [r.id, r]));
    const pick = (id?: string | null): HeroReviewLink | null =>
      id && byId.has(id) ? { id, title: byId.get(id)!.title } : null;
    return { before: pick(cfg.before), after: pick(cfg.after) };
  } catch {
    return { before: null, after: null };
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

async function getGameDetails(games: { home: string; away: string }[], season: string): Promise<Record<string, { location: string; time: string }>> {
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
      .eq('season', season)
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

// Playoff scoring leaders (top 5 by total playoff points), same shape as
// getTopScorers so the home top-scorers section can render either list. Read
// from playoff_game_stats — kept separate from the regular-season leaderboard.
async function getPlayoffTopScorers(season: string): Promise<TopPlayer[]> {
  try {
    const { data: stats } = await supabaseAdmin
      .from('playoff_game_stats')
      .select('player_id, points, three_pointers, fouls')
      .eq('season', season);
    const rows = (stats ?? []) as { player_id: string; points: number | null; three_pointers: number | null; fouls: number | null }[];
    if (rows.length === 0) return [];

    const agg = new Map<string, { points: number; three_pointers: number; fouls: number }>();
    for (const r of rows) {
      const a = agg.get(r.player_id) ?? { points: 0, three_pointers: 0, fouls: 0 };
      a.points         += r.points         ?? 0;
      a.three_pointers += r.three_pointers ?? 0;
      a.fouls          += r.fouls          ?? 0;
      agg.set(r.player_id, a);
    }
    const top = [...agg.entries()]
      .filter(([, a]) => a.points > 0)
      .sort((x, y) => y[1].points - x[1].points)
      .slice(0, 5);
    if (top.length === 0) return [];

    const { data: players } = await supabaseAdmin
      .from('players')
      .select('id, name, photo_url, jersey_number, team:teams(name)')
      .in('id', top.map(([id]) => id));
    const byId = new Map(((players ?? []) as unknown as {
      id: string; name: string; photo_url: string | null; jersey_number: number | null; team: { name: string } | null;
    }[]).map((p) => [p.id, p]));

    return top.map(([id, a]) => {
      const p = byId.get(id);
      return {
        id,
        name:           p?.name ?? '—',
        photo_url:      p?.photo_url ?? null,
        jersey_number:  p?.jersey_number ?? null,
        team_name:      p?.team?.name ?? null,
        points:         a.points,
        three_pointers: a.three_pointers,
        fouls:          a.fouls,
      };
    });
  } catch {
    return [];
  }
}

// Playoff highlights for the home overview / records / facts when the season is
// over: games played, teams & series counts, and the playoff records (highest
// team score, biggest margin, best single-game scorer). Team names are the
// series' raw names (resolved at render via dbDisplayName). Stage is a key.
type PlayoffStageKey = 'qf' | 'sf' | 'final';
type PlayoffHighlights = {
  gamesPlayed: number;
  teams: number;
  seriesTotal: number;
  highScore:     { score: number; team: string; opp: string; stageKey: PlayoffStageKey } | null;
  biggestMargin: { margin: number; winner: string; loser: string; stageKey: PlayoffStageKey } | null;
  topGame:       { id: string; name: string; points: number; teamName: string | null; stageKey: PlayoffStageKey } | null;
};

async function getPlayoffHighlights(season: string): Promise<PlayoffHighlights> {
  const empty: PlayoffHighlights = { gamesPlayed: 0, teams: 0, seriesTotal: 0, highScore: null, biggestMargin: null, topGame: null };
  try {
    const [{ data: seriesData }, { data: gamesData }, { data: statsData }] = await Promise.all([
      supabaseAdmin.from('playoff_series').select('series_number, team_a, team_b').eq('season', season),
      supabaseAdmin.from('playoff_games').select('series_number, game_number, home_score, away_score, played').eq('season', season),
      supabaseAdmin.from('playoff_game_stats').select('player_id, series_number, points').eq('season', season),
    ]);

    const series = (seriesData ?? []) as { series_number: number; team_a: string | null; team_b: string | null }[];
    const seriesByNum = new Map(series.map((s) => [s.series_number, s]));
    const teamsSet = new Set<string>();
    for (const s of series) {
      if (s.team_a?.trim()) teamsSet.add(s.team_a.trim());
      if (s.team_b?.trim()) teamsSet.add(s.team_b.trim());
    }

    const games = (gamesData ?? []) as { series_number: number; game_number: number; home_score: number | null; away_score: number | null; played: boolean | null }[];
    const played = games.filter((g) => g.played && g.home_score != null && g.away_score != null);

    let highScore: PlayoffHighlights['highScore'] = null;
    let biggestMargin: PlayoffHighlights['biggestMargin'] = null;
    for (const g of played) {
      const s = seriesByNum.get(g.series_number);
      if (!s) continue;
      const homeTeam = (g.game_number === 2 ? s.team_b : s.team_a)?.trim() ?? '';
      const awayTeam = (g.game_number === 2 ? s.team_a : s.team_b)?.trim() ?? '';
      if (!homeTeam || !awayTeam) continue;
      const stageKey = stageKeyForSeries(g.series_number);
      if (g.home_score! > (highScore?.score ?? -1)) highScore = { score: g.home_score!, team: homeTeam, opp: awayTeam, stageKey };
      if (g.away_score! > (highScore?.score ?? -1)) highScore = { score: g.away_score!, team: awayTeam, opp: homeTeam, stageKey };
      const margin = Math.abs(g.home_score! - g.away_score!);
      if (margin > (biggestMargin?.margin ?? -1)) {
        const homeWon = g.home_score! > g.away_score!;
        biggestMargin = { margin, winner: homeWon ? homeTeam : awayTeam, loser: homeWon ? awayTeam : homeTeam, stageKey };
      }
    }

    const stats = (statsData ?? []) as { player_id: string; series_number: number; points: number | null }[];
    let topStat: { player_id: string; series_number: number; points: number } | null = null;
    for (const r of stats) {
      if ((r.points ?? 0) > (topStat?.points ?? -1)) topStat = { player_id: r.player_id, series_number: r.series_number, points: r.points ?? 0 };
    }
    let topGame: PlayoffHighlights['topGame'] = null;
    if (topStat && topStat.points > 0) {
      const { data: pl } = await supabaseAdmin
        .from('players')
        .select('id, name, team:teams(name)')
        .eq('id', topStat.player_id)
        .maybeSingle();
      const p = pl as unknown as { id: string; name: string; team: { name: string } | null } | null;
      topGame = { id: topStat.player_id, name: p?.name ?? '—', points: topStat.points, teamName: p?.team?.name ?? null, stageKey: stageKeyForSeries(topStat.series_number) };
    }

    return { gamesPlayed: played.length, teams: teamsSet.size, seriesTotal: series.length, highScore, biggestMargin, topGame };
  } catch {
    return empty;
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

async function getLiveData(season: string) {
  try {
    const [{ data: standings }, { data: results }] = await Promise.all([
      supabaseAdmin.from('standings').select('rank,name,wins,losses,pts,pf,division').eq('season', season).order('rank'),
      supabaseAdmin.from('game_results').select('round,date,home_team,away_team,home_score,away_score,techni').eq('season', season).order('round'),
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
    // Flag OR forfeit score (20:0) — a forfeit the sheet forgot to flag must
    // still be excluded, else its margin-20 would surface as "biggest win".
    const isTechni = (g: GameRow) =>
      g.techni || (g.home_score === 20 && g.away_score === 0) || (g.home_score === 0 && g.away_score === 20);
    const gamesPlayed  = games.filter((g) => !isTechni(g)).length;
    const currentRound = games.length > 0 ? Math.max(...games.map((g) => g.round)) : CURRENT_ROUND;

    // Season records
    let highScore   = { score: 0, team: '', opp: '', round: 0, date: '' };
    let highCombined = { sh: 0, sa: 0, home: '', away: '', round: 0, date: '' };
    let biggestWin  = { sh: 0, sa: 0, home: '', away: '', round: 0, date: '' };
    let closestCount = 0;

    for (const g of games) {
      if (isTechni(g)) continue;
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

async function getCupFinal(season: string): Promise<CupFinal> {
  try {
    // Multiple 'גמר' rows can exist if the Excel sync inserted a duplicate
    // final — `.maybeSingle()` would error on >1 row. Fetch all and prefer the
    // real, decided final (played + both scores) over any phantom/incomplete one.
    const { data } = await supabaseAdmin
      .from('cup_games')
      .select('date, home_team, away_team, home_score, away_score, played, game_number')
      .eq('season', season)
      .eq('round', 'גמר')
      .order('game_number', { ascending: false });
    const rows = (data ?? []) as NonNullable<CupFinal>[];
    if (rows.length === 0) return null;
    return (
      rows.find((r) => r.played && r.home_score != null && r.away_score != null) ??
      rows.find((r) => r.home_score != null && r.away_score != null) ??
      rows[0]
    );
  } catch { return null; }
}

// ── Champion banner data ─────────────────────────────────────────────────────
// Detects a decided cup final and/or a decided playoff series for the current
// season. The banner picks the most recently decided of the two and renders
// the hero variant for 30 days, then the compact variant. When the admin
// starts a new season the season scope changes and getChampionBanner returns
// null for the new (empty) season — hiding the banner automatically.

const CHAMPION_HERO_DAYS = 30;

type CupChampion = {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  date: string | null;
  video_url: string | null;
  decidedAt: Date;        // best-effort parsed date for the 30-day rule
  // Final box score extras (for the home champion banner panels):
  mvp: { name: string; teamName: string; points: number; threePointers: number; photoUrl: string | null } | null;
  finalRoster: { teamName: string; players: { name: string; points: number; threePointers: number; fouls: number }[] } | null;
};

async function getCupChampion(season: string): Promise<CupChampion | null> {
  try {
    // Cup champion = the team that won the FINAL ('גמר' — exact match,
    // distinct from 'רבע גמר' / 'חצי גמר'). Earlier-round wins don't crown
    // a champion.
    // There should be one final per season, but the Excel cup sync can insert
    // a duplicate/incomplete 'גמר' row (a different team pair). Evaluate ALL
    // final rows and pick the one that is actually DECIDED, so a phantom row
    // can never hide the real champion (previously `.limit(1)` picked the
    // highest game_number even if it was incomplete → banner vanished).
    const { data: finalsData } = await supabaseAdmin
      .from('cup_games')
      .select('id, home_team, away_team, home_score, away_score, date, video_url, played, game_number, home_quarters, away_quarters')
      .eq('season', season)
      .eq('round', 'גמר')
      .order('game_number', { ascending: false });
    type FinalRow = {
      id: string; home_team: string; away_team: string;
      home_score: number | null; away_score: number | null;
      date: string | null; video_url: string | null;
      played: boolean | null; game_number: number | null;
      home_quarters: number[] | null; away_quarters: number[] | null;
    };
    const finals = (finalsData ?? []) as FinalRow[];
    if (finals.length === 0) return null;

    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);

    // Batch-derive scores for any finals that have no explicit score yet.
    const needDerive = finals.filter((f) => f.home_score == null || f.away_score == null);
    let derivedById = new Map<string, { home: number; away: number }>();
    if (needDerive.length > 0) {
      const [{ data: teamsD }, { data: statsD }] = await Promise.all([
        supabaseAdmin.from('teams').select('id, name'),
        supabaseAdmin.from('cup_game_stats').select('cup_game_id, team_id, points').in('cup_game_id', needDerive.map((f) => f.id)),
      ]);
      derivedById = deriveCupScores(
        needDerive as unknown as CupGameLike[],
        (teamsD ?? []) as { id: string; name: string }[],
        (statsD ?? []) as { cup_game_id: string; team_id: string | null; points: number | null }[],
      );
    }

    const decidedFinals: { row: FinalRow; homeScore: number; awayScore: number; decidedAt: Date }[] = [];
    for (const f of finals) {
      let hs = f.home_score;
      let aw = f.away_score;
      if (hs != null && aw != null) {
        // Explicit score — reveal once played OR the scheduled date has passed.
        const parsed = parseFlexibleDate(f.date, season);
        const datePassed = parsed ? parsed.getTime() <= todayMid.getTime() : false;
        if (!f.played && !datePassed) continue;
      } else {
        const d = derivedById.get(f.id);
        if (!d) continue;          // nothing entered for this row
        hs = d.home; aw = d.away;
      }
      if (hs == null || aw == null || hs === aw) continue;  // no winner (incl. 0:0 tie)
      decidedFinals.push({ row: f, homeScore: hs, awayScore: aw, decidedAt: parseFlexibleDate(f.date, season) ?? new Date() });
    }
    if (decidedFinals.length === 0) return null;

    // Most recently decided wins (tiebreak: higher game_number).
    decidedFinals.sort((a, b) =>
      (b.decidedAt.getTime() - a.decidedAt.getTime()) ||
      ((b.row.game_number ?? 0) - (a.row.game_number ?? 0)),
    );
    const data = decidedFinals[0].row;
    const homeScore = decidedFinals[0].homeScore;
    const awayScore = decidedFinals[0].awayScore;

    const championName = homeScore > awayScore ? data.home_team : data.away_team;

    // ── Final box score → MVP (top scorer) + champion's scorers list ────────
    let mvp: CupChampion['mvp'] = null;
    let finalRoster: CupChampion['finalRoster'] = null;
    try {
      const [{ data: statRows }, { data: players }, { data: teams }] = await Promise.all([
        supabaseAdmin.from('cup_game_stats').select('player_id, team_id, points, three_pointers, fouls').eq('cup_game_id', data.id),
        supabaseAdmin.from('players').select('id, name, photo_url'),
        supabaseAdmin.from('teams').select('id, name'),
      ]);
      const rows = (statRows ?? []) as { player_id: string; team_id: string | null; points: number | null; three_pointers: number | null; fouls: number | null }[];
      if (rows.length > 0) {
        const pById = new Map((players ?? []).map((p) => [p.id as string, p as { name: string; photo_url: string | null }]));
        const teamNameById = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));

        // MVP = top scorer of the final (either team).
        const top = [...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
        if (top && (top.points ?? 0) > 0) {
          const pl = pById.get(top.player_id);
          mvp = {
            name:          pl?.name ?? '—',
            teamName:      top.team_id ? (teamNameById.get(top.team_id) ?? '') : '',
            points:        top.points ?? 0,
            threePointers: top.three_pointers ?? 0,
            photoUrl:      pl?.photo_url ?? null,
          };
        }

        // Champion's scorers in the final. Resolve the champion name → team_id
        // (handles the 'ראשון "גפן"' vs 'ראשון גפן' quote variants).
        const resolve = makeNameResolver((teams ?? []) as { id: string; name: string }[]);
        const idByName = new Map((teams ?? []).map((t) => [t.name as string, t.id as string]));
        const championId = idByName.get(resolve(championName)) ?? null;
        if (championId) {
          const champPlayers = rows
            .filter((r) => r.team_id === championId)
            .map((r) => ({
              name:          pById.get(r.player_id)?.name ?? '—',
              points:        r.points ?? 0,
              threePointers: r.three_pointers ?? 0,
              fouls:         r.fouls ?? 0,
            }));
          if (champPlayers.length > 0) finalRoster = { teamName: championName, players: champPlayers };
        }
      }
    } catch { /* box score is optional — banner still shows without panels */ }

    const decidedAt = parseFlexibleDate(data.date, season) ?? new Date();
    return {
      id:         data.id,
      home_team:  data.home_team,
      away_team:  data.away_team,
      home_score: homeScore,
      away_score: awayScore,
      date:       data.date,
      video_url:  (data as { video_url: string | null }).video_url ?? null,
      decidedAt,
      mvp,
      finalRoster,
    };
  } catch { return null; }
}

type PlayoffChampion = {
  seriesNumber: number;
  champion: string;
  opponent: string;
  championIsTeamA: boolean;
  // The deciding game's score, oriented to home/away of that single game:
  decidingGameNumber: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  date: string | null;
  video_url: string | null;
  decidedAt: Date;
};

async function getPlayoffChampion(season: string): Promise<PlayoffChampion | null> {
  try {
    // Highest series_number for the season — that's the final by convention
    // (seriesNum > 6 = 'גמר' per src/app/playoff/series/[num]/page.tsx).
    const { data: series } = await supabaseAdmin
      .from('playoff_series')
      .select('series_number, team_a, team_b')
      .eq('season', season)
      .order('series_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!series || !series.team_a || !series.team_b) return null;
    // Only an actual final crowns a champion. If the admin has only created
    // earlier rounds so far (e.g. just the quarter-finals), the highest series
    // is NOT the final — without this guard the last QF winner got a
    // champion banner while the semis/final were still unplayed.
    if (series.series_number < 7) return null;

    const { data: games } = await supabaseAdmin
      .from('playoff_games')
      .select('game_number, home_score, away_score, played, game_date, video_url')
      .eq('season', season)
      .eq('series_number', series.series_number)
      .order('game_number', { ascending: true });
    const rows = (games ?? []) as { game_number: number; home_score: number | null; away_score: number | null; played: boolean; game_date: string | null; video_url: string | null }[];

    // homeFor(): g2 swaps home/away. Mirrors logic in /playoff/series/[num]/page.tsx.
    const homeForGame = (gNum: number) => gNum === 2 ? series.team_b : series.team_a;

    let winsA = 0, winsB = 0;
    let deciding: typeof rows[number] | null = null;
    for (const g of rows) {
      if (g.home_score == null || g.away_score == null) continue;
      const home = homeForGame(g.game_number);
      const homeWon = g.home_score > g.away_score;
      const aWon = (homeWon && home === series.team_a) || (!homeWon && home !== series.team_a);
      if (aWon) winsA++;
      else      winsB++;
      if (winsA === 2 || winsB === 2) {
        deciding = g;
        break;
      }
    }

    if (!deciding) return null; // series not decided yet
    const championIsTeamA = winsA === 2;
    const champion = championIsTeamA ? series.team_a : series.team_b;
    const opponent = championIsTeamA ? series.team_b : series.team_a;

    const decidedAt = parseFlexibleDate(deciding.game_date, season) ?? new Date();
    return {
      seriesNumber: series.series_number,
      champion,
      opponent,
      championIsTeamA,
      decidingGameNumber: deciding.game_number,
      homeTeam: homeForGame(deciding.game_number),
      awayTeam: homeForGame(deciding.game_number) === series.team_a ? series.team_b : series.team_a,
      homeScore: deciding.home_score!,
      awayScore: deciding.away_score!,
      date:      deciding.game_date,
      video_url: deciding.video_url ?? null,
      decidedAt,
    };
  } catch { return null; }
}

// ── Upcoming playoff games (home-page strip) ─────────────────────────────────
// Returns the next unplayed game of each still-active series, plus a flag for
// whether any playoff games exist at all (used to auto-detect the playoff phase
// when the admin hasn't set it explicitly). Team names are resolved from the
// stored series teams, falling back to the seed label → live standings (so a
// quarter-final "🟠 דרום #1" resolves to the actual #1 seed as soon as the
// regular season table is final). Series whose teams aren't known yet are
// skipped — we never render a half-empty matchup.

type RawPlayoffUpcoming = {
  seriesNumber: number;
  stageKey: 'qf' | 'sf' | 'final';
  gameNumber: number;
  teamA: string;
  teamB: string;
  homeIsTeamA: boolean;
  winsA: number;
  winsB: number;
  date: string | null;
  time: string | null;
  location: string | null;
};

function stageKeyForSeries(n: number): 'qf' | 'sf' | 'final' {
  if (n >= 7) return 'final';   // series 7 = גמר   (matches /playoff convention)
  if (n >= 5) return 'sf';      // series 5-6 = חצי גמר
  return 'qf';                  // series 1-4 = רבע גמר
}

async function getUpcomingPlayoffGames(season: string): Promise<{ games: RawPlayoffUpcoming[]; hasAnyGames: boolean }> {
  try {
    const gameCols = 'series_number, game_number, home_score, away_score, played, game_date, game_time, location';
    const [{ data: seriesData }, gamesRes, { data: standingsData }] = await Promise.all([
      supabaseAdmin.from('playoff_series').select('series_number, team_a, team_b, team_a_label, team_b_label').eq('season', season).order('series_number'),
      supabaseAdmin.from('playoff_games').select(gameCols).eq('season', season).order('series_number').order('game_number'),
      supabaseAdmin.from('standings').select('name, division, rank').eq('season', season).order('rank', { ascending: true }),
    ]);

    // Tolerate the game_time column not existing yet (migration not applied):
    // fall back to the same query without it so the strip never goes blank.
    type GameRow = { series_number: number; game_number: number; home_score: number | null; away_score: number | null; played: boolean | null; game_date: string | null; game_time?: string | null; location: string | null };
    let gamesData = (gamesRes.data ?? null) as GameRow[] | null;
    if (gamesRes.error) {
      gamesData = ((await supabaseAdmin
        .from('playoff_games')
        .select('series_number, game_number, home_score, away_score, played, game_date, location')
        .eq('season', season).order('series_number').order('game_number')).data ?? null) as GameRow[] | null;
    }

    const series = (seriesData ?? []) as { series_number: number; team_a: string | null; team_b: string | null; team_a_label: string | null; team_b_label: string | null }[];
    const games  = (gamesData ?? []) as GameRow[];
    const hasAnyGames = games.length > 0;
    if (series.length === 0) return { games: [], hasAnyGames };

    const standings = (standingsData ?? []) as { name: string; division: string; rank: number }[];
    const resolveFromLabel = (label: string | null): string => {
      if (!label) return '';
      const isNorth = label.includes('צפון');
      const isSouth = label.includes('דרום');
      if (!isNorth && !isSouth) return '';
      const m = label.match(/#(\d+)/);
      if (!m) return '';
      const div  = isNorth ? 'North' : 'South';
      const rank = parseInt(m[1], 10);
      return standings.find((s) => s.division === div && s.rank === rank)?.name ?? '';
    };

    // game 2 swaps home/away (mirrors /playoff homeForGame).
    const homeForGame = (teamA: string, teamB: string, gNum: number) => (gNum === 2 ? teamB : teamA);

    const out: RawPlayoffUpcoming[] = [];
    for (const s of series) {
      const teamA = s.team_a?.trim() || resolveFromLabel(s.team_a_label);
      const teamB = s.team_b?.trim() || resolveFromLabel(s.team_b_label);
      if (!teamA || !teamB) continue;

      const seriesGames = games.filter((g) => g.series_number === s.series_number);

      // Series tally from games with a result (both scores entered counts,
      // even if the admin didn't tick "shown").
      let winsA = 0, winsB = 0;
      for (const g of seriesGames) {
        if (g.home_score == null || g.away_score == null) continue;
        const home    = homeForGame(teamA, teamB, g.game_number);
        const homeWon = g.home_score > g.away_score;
        if ((homeWon && home === teamA) || (!homeWon && home !== teamA)) winsA++;
        else winsB++;
      }

      // Final is a single game; quarters/semis are best-of-3.
      const isFinal = stageKeyForSeries(s.series_number) === 'final';
      const decided = isFinal ? (winsA >= 1 || winsB >= 1) : (winsA >= 2 || winsB >= 2);
      if (decided) continue;

      // Next game = lowest-numbered game without a result yet (no scores and
      // not marked shown).
      const next = [...seriesGames]
        .filter((g) => !g.played && (g.home_score == null || g.away_score == null))
        .sort((a, b) => a.game_number - b.game_number)[0];
      if (!next) continue;

      out.push({
        seriesNumber: s.series_number,
        stageKey:     stageKeyForSeries(s.series_number),
        gameNumber:   next.game_number,
        teamA, teamB,
        homeIsTeamA:  next.game_number !== 2,
        winsA, winsB,
        date:         next.game_date,
        time:         next.game_time ?? null,
        location:     next.location,
      });
    }

    out.sort((a, b) => {
      const da = parseFlexibleDate(a.date, season)?.getTime() ?? Infinity;
      const db = parseFlexibleDate(b.date, season)?.getTime() ?? Infinity;
      return (da - db) || (a.seriesNumber - b.seriesNumber);
    });
    return { games: out.slice(0, 8), hasAnyGames };
  } catch {
    return { games: [], hasAnyGames: false };
  }
}

// ── Delayed / postponed games (home-page surface) ────────────────────────────
// Reads games flagged `delayed` in the admin games table (not game_results),
// resolving each game's round from the static schedule. Defensive: if the
// `delayed` column hasn't been migrated yet the query throws and we return [].

type DelayedGameRow = {
  round: number;
  homeTeam: string;
  awayTeam: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  gameDate: string | null;
  gameTime: string | null;
  location: string | null;
};

async function getDelayedGames(season: string): Promise<DelayedGameRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from('games')
      .select('home_score, away_score, status, game_date, game_time, location, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
      .eq('season', season)
      .eq('delayed', true)
      .order('game_date', { ascending: true });

    type Row = {
      home_score: number | null; away_score: number | null; status: string;
      game_date: string | null; game_time: string | null; location: string | null;
      home_team: { name: string } | { name: string }[] | null;
      away_team: { name: string } | { name: string }[] | null;
    };
    const nameOf = (tm: Row['home_team']): string => {
      if (!tm) return '';
      return Array.isArray(tm) ? (tm[0]?.name ?? '') : (tm.name ?? '');
    };

    const out: DelayedGameRow[] = [];
    for (const r of (data ?? []) as Row[]) {
      const home = nameOf(r.home_team);
      const away = nameOf(r.away_team);
      if (!home || !away) continue;
      out.push({
        round:     scheduleEntryForFixture(home, away)?.round ?? 0,
        homeTeam:  home,
        awayTeam:  away,
        status:    r.status,
        homeScore: r.home_score,
        awayScore: r.away_score,
        gameDate:  r.game_date,
        gameTime:  (r.game_time && r.game_time !== '00:00:00') ? r.game_time.slice(0, 5) : null,
        location:  (r.location && r.location !== 'TBD') ? r.location : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86_400_000);
}

function formatChampionDate(iso: string | null, lang: 'he' | 'en', season: string): string | null {
  const d = parseFlexibleDate(iso, season);
  if (!d) return null;
  try {
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'he-IL', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
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

/* ── Upcoming events feed (league rounds + cup matches) ───────────────── */

type CupRow = {
  id: string;
  round: string;
  home_team: string;
  away_team: string;
  date: string | null;
  played: boolean | null;
  location: string | null;
};

/**
 * Defensive date parser — cup_games.date is a free-text column that holds
 * a mix of ISO ("2026-05-29"), DD.MM.YY ("29.05.26") and DD.MM ("29.05")
 * depending on whether the date came from the date picker or the Excel
 * cup sheet. Returns null for anything we can't make sense of.
 *
 * When the year is missing (DD.MM), we assume the value belongs to the
 * current season's window — preferring the season's second year if the
 * inferred date is earlier than its start.
 */
function parseFlexibleDate(s: string | null | undefined, season: string): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  // ONLY trust the native Date parser for ISO-looking inputs.
  // `new Date("5.6.26")` is silently accepted by V8 as M.D.YY → wrong year.
  // Restricting the fast path to ISO eliminates that ambiguity; everything
  // else falls through to the explicit DD.MM[.YY] branch below.
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(trimmed)) {
    const native = new Date(trimmed);
    if (!isNaN(native.getTime())) return native;
  }

  const m = trimmed.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (!m) return null;

  const day   = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  let   year: number;

  if (m[3]) {
    year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
  } else {
    const seasonMatch = season.match(/^(\d{4})-(\d{4})$/);
    if (seasonMatch) {
      const startYear = parseInt(seasonMatch[1], 10);
      const endYear   = parseInt(seasonMatch[2], 10);
      // Months 9-12 (Sept-Dec) → first calendar year of the season,
      // months 1-8 (Jan-Aug) → second.
      year = month >= 8 ? startYear : endYear;
    } else {
      year = new Date().getFullYear();
    }
  }
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}

async function getUpcomingCupGames(season: string): Promise<CupRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from('cup_games')
      .select('id, round, home_team, away_team, date, played, location')
      .eq('season', season)
      .eq('played', false);
    return (data ?? []) as CupRow[];
  } catch { return []; }
}

/** Days from today within which an upcoming cup match earns the hero-card
 *  treatment. Anything farther out is treated as "not soon enough" and the
 *  section just stays hidden. */
const CUP_HERO_WINDOW_DAYS = 14;

function buildUpcomingCupEvents(opts: {
  season: string;
  todayIso: string;
  cupGames: CupRow[];
  logoLookup: (name: string) => string | null;
  resolveTeamName: (name: string) => string;
  lang: 'he' | 'en';
  maxItems: number;
}): UpcomingEvent[] {
  const { season, todayIso, cupGames, logoLookup, resolveTeamName, lang, maxItems } = opts;
  // Normalize "today" to midnight so daysUntil math doesn't drift by partial-day offsets.
  const today = new Date(todayIso);
  today.setHours(0, 0, 0, 0);
  const events: UpcomingEvent[] = [];

  const heDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const enDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function fmtDay(d: Date) {
    return (lang === 'en' ? enDays : heDays)[d.getDay()];
  }
  function fmtDate(d: Date) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
  }
  function isoOf(d: Date) {
    const y  = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  function daysBetween(target: Date) {
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
  }

  // Unplayed cup games dated today or later, but only those within the
  // hero window (default 14 days). Far-future games are deliberately
  // hidden — the section is meant for "the cup match is approaching",
  // not a season-long timeline.
  for (const c of cupGames) {
    const d = parseFlexibleDate(c.date, season);
    if (!d) continue;
    d.setHours(0, 0, 0, 0);
    const daysUntil = daysBetween(d);
    if (daysUntil < 0 || daysUntil > CUP_HERO_WINDOW_DAYS) continue;

    events.push({
      type: 'cup',
      cupGameId: c.id,
      isoDate: isoOf(d),
      displayDate: fmtDate(d),
      heDayLabel: fmtDay(d),
      daysUntil,
      roundName: c.round,
      homeTeam: resolveTeamName(c.home_team),
      awayTeam: resolveTeamName(c.away_team),
      homeLogo: logoLookup(c.home_team),
      awayLogo: logoLookup(c.away_team),
      location: c.location,
    });
  }

  events.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return events.slice(0, maxItems);
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
  const season = await getCurrentSeason();
  const [liveData, activeAnnouncements, teams, tickerSpeed, topScorers, lang, dbRoundDates, cupFinal, upcomingCup, cupChampion, playoffChampion, autoTickerItems, cupHeroReviews, seasonPhaseSetting, playoffUpcoming, delayedGames, playoffTopScorers, playoffHighlights] = await Promise.all([
    getLiveData(season),
    getActiveAnnouncements(),
    getTeams(),
    getTickerSpeed(),
    getTopScorers(),
    getLang(),
    getRoundDates(),
    getCupFinal(season),
    getUpcomingCupGames(season),
    getCupChampion(season),
    getPlayoffChampion(season),
    getAutoTickerItems(season),
    getCupHeroReviews(season),
    getSeasonPhaseSetting(),
    getUpcomingPlayoffGames(season),
    getDelayedGames(season),
    getPlayoffTopScorers(season),
    getPlayoffHighlights(season),
  ]);

  const nextRoundEarly = liveData.currentRound + 1;
  const nextRoundSchedule = LIBI_SCHEDULE.filter(g => g.round === nextRoundEarly);
  const gameDetails = await getGameDetails(
    nextRoundSchedule.map(g => ({ home: g.homeTeam, away: g.awayTeam })),
    season,
  );
  const T = (he: string) => st(he, lang);

  // Merge static ROUND_DATES with DB values (DB takes priority)
  const ROUND_DATES_MERGED: Record<number, string> = { ...ROUND_DATES, ...dbRoundDates };

  // Build logo lookup
  function norm(s: string) { return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim(); }
  const logoMap: Record<string, string | null> = {};
  for (const t of teams) logoMap[norm(t.name)] = t.logo_url;

  // Single source of truth for team display names: the admin "קבוצות" tab.
  // Every team string we render on this page goes through this resolver,
  // so a rename in admin propagates to scoreboard, records, standings, etc.
  const resolveTeam = makeNameResolver(teams.map(t => ({ id: t.id, name: t.name })));
  const dbDisplayName = (s: string) => resolveTeam(s);

  // ── Champion banner: pick the most recently decided final (cup OR playoff)
  // and decide between the hero (≤ 30 days) and compact variant. Both go
  // away the moment the admin bumps current_season — the queries are scoped
  // to the new season which has no decided final yet.
  const championProps: ChampionBannerProps | null = (() => {
    const now = new Date();

    // Cup candidate
    let cupProps: ChampionBannerProps | null = null;
    if (cupChampion) {
      const homeIsChampion = cupChampion.home_score > cupChampion.away_score;
      const champName    = homeIsChampion ? cupChampion.home_team : cupChampion.away_team;
      const opponentName = homeIsChampion ? cupChampion.away_team : cupChampion.home_team;
      const canonical    = dbDisplayName(champName);
      const opponent     = dbDisplayName(opponentName);
      cupProps = {
        type: 'cup',
        variant: daysBetween(cupChampion.decidedAt, now) < CHAMPION_HERO_DAYS ? 'hero' : 'compact',
        teamName:        canonical,
        teamLogoUrl:     logoMap[norm(canonical)] ?? logoMap[norm(champName)] ?? null,
        opponentName:    opponent,
        homeIsChampion,
        homeScore:       cupChampion.home_score,
        awayScore:       cupChampion.away_score,
        decidedOnLabel:  formatChampionDate(cupChampion.date, lang as 'he' | 'en', season),
        season,
        finalGameHref:   `/cup/game/${cupChampion.id}`,
        bracketHref:     '/cup',
        videoUrl:        cupChampion.video_url,
        lang: lang as 'he' | 'en',
        mvp:             cupChampion.mvp,
        finalRoster:     cupChampion.finalRoster
          ? { teamName: dbDisplayName(cupChampion.finalRoster.teamName), players: cupChampion.finalRoster.players }
          : null,
        beforeReview:    cupHeroReviews.before
          ? { title: cupHeroReviews.before.title, href: `/season-review#review-${cupHeroReviews.before.id}` }
          : null,
        afterReview:     cupHeroReviews.after
          ? { title: cupHeroReviews.after.title, href: `/season-review#review-${cupHeroReviews.after.id}` }
          : null,
      };
    }

    // Playoff candidate
    let playoffProps: ChampionBannerProps | null = null;
    if (playoffChampion) {
      const canonical = dbDisplayName(playoffChampion.champion);
      const opponent  = dbDisplayName(playoffChampion.opponent);
      // homeIsChampion describes the deciding-game orientation, not the series.
      const homeIsChampion = playoffChampion.homeTeam === playoffChampion.champion;
      playoffProps = {
        type: 'league',
        variant: daysBetween(playoffChampion.decidedAt, now) < CHAMPION_HERO_DAYS ? 'hero' : 'compact',
        teamName:        canonical,
        teamLogoUrl:     logoMap[norm(canonical)] ?? logoMap[norm(playoffChampion.champion)] ?? null,
        opponentName:    opponent,
        homeIsChampion,
        homeScore:       playoffChampion.homeScore,
        awayScore:       playoffChampion.awayScore,
        decidedOnLabel:  formatChampionDate(playoffChampion.date, lang as 'he' | 'en', season),
        season,
        finalGameHref:   `/playoff/series/${playoffChampion.seriesNumber}`,
        bracketHref:     '/playoff',
        videoUrl:        playoffChampion.video_url,
        lang: lang as 'he' | 'en',
      };
    }

    // Pick the most recent decided. (Most recent wins per user request.)
    if (cupProps && playoffProps) {
      return (cupChampion!.decidedAt.getTime() >= playoffChampion!.decidedAt.getTime())
        ? cupProps : playoffProps;
    }
    return cupProps ?? playoffProps;
  })();

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

  // ── Season phase + playoff strip ──────────────────────────────────────────
  // Admin's explicit league_settings.season_phase wins; otherwise we auto-flip
  // to 'playoffs' once the regular season is complete and playoff games exist.
  // During playoffs the playoff strip replaces the regular next-round strip
  // (which is empty anyway once nextRound passes TOTAL_ROUNDS).
  // The regular season counts as complete only when every round is in AND no
  // postponed (delayed) game is still awaiting a result — so the playoff
  // transition and the season-summary framing never fire while a makeup game
  // is still pending.
  const hasPendingPostponed = delayedGames.some((g) => g.status !== 'Finished');
  const regularSeasonComplete = currentRound >= TOTAL_ROUNDS && !hasPendingPostponed;
  const seasonPhase = resolveSeasonPhase({
    setting: seasonPhaseSetting,
    regularSeasonComplete,
    hasPlayoffGames: playoffUpcoming.hasAnyGames,
  });

  const heDayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const enDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const playoffStripGames: PlayoffStripGame[] = playoffUpcoming.games.map((g) => {
    const home     = g.homeIsTeamA ? g.teamA : g.teamB;
    const away     = g.homeIsTeamA ? g.teamB : g.teamA;
    const homeName = dbDisplayName(home);
    const awayName = dbDisplayName(away);
    const d = parseFlexibleDate(g.date, season);
    const dateLabel = d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}` : '';
    const dayLabel  = d ? (lang === 'en' ? enDayNames : heDayNames)[d.getDay()] : '';
    const timeLabel = (g.time && g.time !== '00:00:00') ? g.time.slice(0, 5) : '';
    return {
      seriesNumber: g.seriesNumber,
      stageKey:     g.stageKey,
      gameNumber:   g.gameNumber,
      homeTeam:     homeName,
      awayTeam:     awayName,
      homeLogo:     logoMap[norm(homeName)] ?? logoMap[norm(home)] ?? null,
      awayLogo:     logoMap[norm(awayName)] ?? logoMap[norm(away)] ?? null,
      homeWins:     g.homeIsTeamA ? g.winsA : g.winsB,
      awayWins:     g.homeIsTeamA ? g.winsB : g.winsA,
      dateLabel,
      dayLabel,
      timeLabel,
      location:     g.location,
    };
  });
  const showPlayoffStrip = seasonPhase === 'playoffs' && playoffStripGames.length > 0;

  // ── Phase-aware overview ──────────────────────────────────────────────────
  // During the playoffs the home overview is reframed as a regular-season
  // summary, and the "rounds remaining" stat (now 0) becomes a playoff-stage
  // indicator linking to the bracket.
  // Only reframe the overview as "regular season complete" once the season is
  // genuinely finished (all rounds in + no postponed game pending) — even if the
  // admin has flipped the phase to show the playoff strip early.
  // The home sections (overview / records / facts / top-scorers) adapt to the
  // playoffs only once there are DETERMINED playoff games — i.e. games actually
  // played with a result — not merely because the season ended or the phase was
  // flipped. (The upcoming-games playoff strip is separate and still announces
  // scheduled games.)
  const inPlayoffs = seasonPhase === 'playoffs' && regularSeasonComplete && playoffHighlights.gamesPlayed > 0;

  // Top-scorers section: once the season is over (playoffs), swap the league
  // scoring leaders for the playoff leaders — but only when playoff stats exist,
  // so the section never goes empty in the gap before the first playoff game.
  const showPlayoffScorers = inPlayoffs && playoffTopScorers.length > 0;
  const scorers = showPlayoffScorers ? playoffTopScorers : topScorers;
  const scorersTitle = showPlayoffScorers ? 'קלעי הפלייאוף' : 'קלעי הליגה';
  const scorersHref = showPlayoffScorers ? '/playoff/stats' : '/scorers';
  const scorersLinkLabel = showPlayoffScorers
    ? (lang === 'en' ? 'Playoff Scorers →' : 'רשימת קלעי הפלייאוף ←')
    : (lang === 'en' ? 'League Scorers →' : 'רשימת קלעי הליגה ←');
  const playoffStageKey = playoffUpcoming.games.length
    ? (playoffUpcoming.games.some((g) => g.stageKey === 'qf') ? 'qf'
      : playoffUpcoming.games.some((g) => g.stageKey === 'sf') ? 'sf' : 'final')
    : null;
  const PLAYOFF_STAGE_LABEL = {
    he: { qf: 'רבע גמר', sf: 'חצי גמר', final: 'גמר' },
    en: { qf: 'Quarterfinals', sf: 'Semifinals', final: 'Final' },
  } as const;
  const playoffStageLabel = playoffStageKey
    ? PLAYOFF_STAGE_LABEL[lang === 'en' ? 'en' : 'he'][playoffStageKey]
    : (lang === 'en' ? 'In progress' : 'בעיצומו');
  const phLabel = (k: PlayoffStageKey) => PLAYOFF_STAGE_LABEL[lang === 'en' ? 'en' : 'he'][k];

  // Overview / records / facts adapt to the playoffs once the season is over.
  // Records & the facts scorer need actual playoff data, so they gate on it and
  // otherwise fall back to the regular-season versions (never empty).
  const showPlayoffRecords = inPlayoffs && playoffHighlights.gamesPlayed > 0;
  const showPlayoffFacts   = inPlayoffs && playoffTopScorers.length > 0;

  // ── Delayed / postponed games ─────────────────────────────────────────────
  // Pending delayed games surface as a strip until played; finished ones show
  // their result (tagged with the round) only until the next round is played.
  const fmtDelayed = (iso: string | null): { dateLabel: string; dayLabel: string } => {
    const d = parseFlexibleDate(iso, season);
    if (!d) return { dateLabel: '', dayLabel: '' };
    return {
      dateLabel: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      dayLabel: (lang === 'en' ? enDayNames : heDayNames)[d.getDay()],
    };
  };
  const delayedHref = (round: number, home: string) =>
    round > 0 ? `/games/${round}/${encodeURIComponent(home)}` : '/games';

  const delayedPending: DelayedPendingCard[] = delayedGames
    .filter((g) => g.status !== 'Finished')
    .map((g) => {
      const home = dbDisplayName(g.homeTeam);
      const away = dbDisplayName(g.awayTeam);
      const { dateLabel, dayLabel } = fmtDelayed(g.gameDate);
      return {
        round: g.round,
        homeTeam: home, awayTeam: away,
        homeLogo: logoMap[norm(home)] ?? logoMap[norm(g.homeTeam)] ?? null,
        awayLogo: logoMap[norm(away)] ?? logoMap[norm(g.awayTeam)] ?? null,
        dateLabel, dayLabel,
        time: g.gameTime,
        location: g.location,
        href: delayedHref(g.round, home),
      };
    });

  const delayedFinished: DelayedFinishedCard[] = delayedGames
    .filter((g) => g.status === 'Finished' && g.homeScore != null && g.awayScore != null)
    // Keep showing only until the next round is played: while no round later
    // than this game's belongs-to round has results yet (currentRound = max
    // round in game_results). Round 0 = unmatched fixture — keep showing.
    .filter((g) => g.round === 0 || currentRound <= g.round)
    .map((g) => {
      const home = dbDisplayName(g.homeTeam);
      const away = dbDisplayName(g.awayTeam);
      const { dateLabel } = fmtDelayed(g.gameDate);
      return {
        round: g.round,
        homeTeam: home, awayTeam: away,
        homeLogo: logoMap[norm(home)] ?? logoMap[norm(g.homeTeam)] ?? null,
        awayLogo: logoMap[norm(away)] ?? logoMap[norm(g.awayTeam)] ?? null,
        homeScore: g.homeScore!,
        awayScore: g.awayScore!,
        dateLabel,
        href: delayedHref(g.round, home),
      };
    });

  // Build the upcoming cup-games list. Sits between the league scoreboard
  // strip (next-round games above) and the last-round results (below). Pure
  // "what cup matches are coming" reminder — league rounds are already
  // covered by the scoreboard so we don't repeat them here.
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvents = buildUpcomingCupEvents({
    season,
    todayIso,
    cupGames: upcomingCup,
    logoLookup: (name: string) => logoMap[norm(dbDisplayName(name))] ?? logoMap[norm(name)] ?? null,
    resolveTeamName: dbDisplayName,
    lang,
    maxItems: 6,
  });

  const banners   = activeAnnouncements.filter((a) => a.type === 'banner');

  // Ticker = admin announcements first (they're usually the urgent/manual
  // notices), then the auto spotlight lines that refresh themselves each round.
  type TickerItem = { id: string; message: string; bgColor: string; href: string | null };
  const tickerItems: TickerItem[] = [
    ...activeAnnouncements
      .filter((a) => a.type === 'ticker')
      .map((a) => ({ id: a.id, message: a.message, bgColor: a.bg_color, href: null as string | null })),
    ...autoTickerItems.flatMap((it) => {
      if (!it.enabled) return [];
      const message = autoTickerMessage(it, lang as 'he' | 'en');
      return message ? [{ id: `auto-${it.type}`, message, bgColor: it.bgColor, href: it.href }] : [];
    }),
  ];

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

      {/* Tickers (manual announcements + auto spotlight lines).
          Accessibility (WCAG 2.2.2): `.ticker-wrap` pauses the animation on
          hover/focus, the strip is keyboard-focusable so it can be paused
          without a pointer, and reduced-motion users get a static strip (see
          globals.css). Only the first copy is exposed to assistive tech / the
          tab order; copies 2-6 are visual duplicates, hidden + non-focusable. */}
      {tickerItems.length > 0 && (
        <div
          className="ticker-wrap overflow-hidden rounded-lg bg-[#0d1a28] border border-white/[0.07] py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
          tabIndex={0}
          role="marquee"
          aria-label={lang === 'en' ? 'League news ticker — hover or focus to pause' : 'מבזקי הליגה — רחף או התמקד כדי לעצור'}
        >
          {/* Six identical groups (not two): with only two copies the loop
             exposes a visible blank band on the right whenever a single
             copy is narrower than the viewport. Six copies guarantee that
             at least five remain in view at all times, so the strip never
             retreats from the viewport edge. `pe-16` lands the gap at the
             seam between adjacent copies in both LTR and RTL. */}
          <div
            className="flex w-max ticker-track"
            style={{ animation: `marquee ${tickerSpeed}s linear infinite` }}
          >
            {[0, 1, 2, 3, 4, 5].map(copy => (
              <div key={copy} aria-hidden={copy !== 0} className="flex items-center gap-16 pe-16">
                {tickerItems.map(item => {
                  const dot = <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${BG_COLOR_CLASSES[item.bgColor] ?? 'bg-orange-500'}`} />;
                  return item.href ? (
                    <a key={item.id} href={item.href} tabIndex={copy === 0 ? undefined : -1} className="inline-flex items-center gap-2 text-sm font-medium text-[#e8edf5] whitespace-nowrap transition-colors hover:text-orange-300">
                      {dot}{item.message}
                    </a>
                  ) : (
                    <span key={item.id} className="inline-flex items-center gap-2 text-sm font-medium text-[#e8edf5] whitespace-nowrap">
                      {dot}{item.message}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Champion banner (cup or league) ── */}
      {championProps && <ChampionBanner {...championProps} />}

      {/* ── Playoff scoreboard strip (season phase = playoffs) ── */}
      {showPlayoffStrip && <PlayoffScoreboardStrip games={playoffStripGames} />}

      {/* ── NBA-style Scoreboard Strip (regular season) ── */}
      {!showPlayoffStrip && allNextGames.length > 0 && nextRound <= TOTAL_ROUNDS && (
        <ScoreboardStrip
          games={allNextGames}
          nextRound={nextRound}
          nextDate={nextDate}
          heDay={heDay}
          teamRosters={teamRosters}
        />
      )}

      {/* ── Delayed / postponed games (pending strip + make-up results) ── */}
      <DelayedGames pending={delayedPending} finished={delayedFinished} />

      {/* ── Unified upcoming events (rounds + cup, sorted by date) ── */}
      {upcomingEvents.length > 0 && (
        <UpcomingEvents events={upcomingEvents} lang={lang as 'he' | 'en'} />
      )}

      {/* ── Results block — playoff game results once the season is over,
             otherwise the last regular-season round ── */}
      {inPlayoffs ? <PlayoffResults /> : <LastRoundResults />}

      <div>
        <h1 className="text-3xl font-black text-white font-heading">
          {inPlayoffs ? (lang === 'en' ? 'Playoff Overview' : 'סקירת פלייאוף') : T('סקירה כללית')}
        </h1>
        <p className="mt-1 text-sm font-bold text-[#8aaac8] font-body">
          {inPlayoffs
            ? `${lang === 'en' ? 'Season 2025–2026' : 'עונת 2025–2026'} · ${playoffStageLabel}`
            : (lang === 'en' ? `Season 2025–2026 · Through Round ${currentRound}` : `עונת 2025–2026 · עד מחזור ${currentRound}`)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {inPlayoffs ? (
          <>
            <a href="/playoff" className="block hover:opacity-80 transition-opacity">
              <StatCard value={String(playoffHighlights.teams || 8)} label={lang === 'en' ? 'Playoff teams' : 'קבוצות בפלייאוף'} icon="🏀" colorClass="bg-gradient-to-l from-transparent to-orange-500" />
            </a>
            <a href="/playoff/stats" className="block hover:opacity-80 transition-opacity">
              <StatCard value={String(playoffHighlights.gamesPlayed)} label={lang === 'en' ? 'Playoff games' : 'משחקי פלייאוף'} icon="📊" colorClass="bg-gradient-to-l from-transparent to-green-500" />
            </a>
            <StatCard value={String(playoffHighlights.seriesTotal)} label={lang === 'en' ? 'Series' : 'סדרות'} icon="🏆" colorClass="bg-gradient-to-l from-transparent to-yellow-400" />
            <a href="/playoff" className="block hover:opacity-80 transition-opacity">
              <StatCard value={playoffStageLabel} label={lang === 'en' ? 'Stage' : 'שלב'} icon="🗓" colorClass="bg-gradient-to-l from-transparent to-blue-500" />
            </a>
          </>
        ) : (
          <>
            <a href="/teams" className="block hover:opacity-80 transition-opacity">
              <StatCard value="15"                    label={T('קבוצות')}        icon="🏀" colorClass="bg-gradient-to-l from-transparent to-orange-500" />
            </a>
            <a href="/games?filter=finished" className="block hover:opacity-80 transition-opacity">
              <StatCard value={String(gamesPlayed)}   label={T('משחקי ליגה')}    icon="📊" colorClass="bg-gradient-to-l from-transparent to-green-500"  />
            </a>
            <StatCard value={String(currentRound)}  label={T('מחזורים עד כה')} icon="📆" colorClass="bg-gradient-to-l from-transparent to-yellow-400" />
            <StatCard value={String(TOTAL_ROUNDS)}  label={T('מחזורי עונה')}   icon="🗓" colorClass="bg-gradient-to-l from-transparent to-blue-500"   />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[
          { label: inPlayoffs ? (lang === 'en' ? '🥇 North · 1st' : '🥇 מקום ראשון צפון') : T('🥇 מוביל צפון'), team: northLeader },
          { label: inPlayoffs ? (lang === 'en' ? '🥇 South · 1st' : '🥇 מקום ראשון דרום') : T('🥇 מוביל דרום'), team: southLeader },
        ].map(({ label, team }) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.04]" style={{ borderTop: '3px solid #e0c97a' }}>
            <div className="p-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#8aaac8] font-body">{label}</p>
              <Link href={`/team/${encodeURIComponent(dbDisplayName(team.name))}`} className="text-xl font-black text-[#e0c97a] hover:underline underline-offset-2 transition-colors font-heading">{T(dbDisplayName(team.name))}</Link>
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
          {showPlayoffRecords ? (lang === 'en' ? 'Playoff Records' : 'שיאי הפלייאוף') : T('ביצועי שיא עונה')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {showPlayoffRecords ? (
            <>
              {playoffHighlights.highScore && (
                <RecordCard icon="🏀" label={lang === 'en' ? 'Top score in a game' : 'שיא נקודות במשחק'} value={String(playoffHighlights.highScore.score)}
                  sub={`${T(dbDisplayName(playoffHighlights.highScore.team))} ${lang === 'en' ? 'vs' : 'נגד'} ${T(dbDisplayName(playoffHighlights.highScore.opp))}`}
                  detail={phLabel(playoffHighlights.highScore.stageKey)} color="#FF6B1A" />
              )}
              {playoffHighlights.biggestMargin && (
                <RecordCard icon="💥" label={lang === 'en' ? 'Biggest margin' : 'הפרש גדול ביותר'} value={`+${playoffHighlights.biggestMargin.margin}`}
                  sub={`${T(dbDisplayName(playoffHighlights.biggestMargin.winner))} ${lang === 'en' ? 'vs' : 'נגד'} ${T(dbDisplayName(playoffHighlights.biggestMargin.loser))}`}
                  detail={phLabel(playoffHighlights.biggestMargin.stageKey)} color="#4ec97a" />
              )}
              {playoffHighlights.topGame && (
                <a href={`/players/${playoffHighlights.topGame.id}`} className="block hover:opacity-80 transition-opacity">
                  <RecordCard icon="🏅" label={lang === 'en' ? 'Best individual game' : 'ביצוע אישי שיא'} value={String(playoffHighlights.topGame.points)}
                    sub={playoffHighlights.topGame.name}
                    detail={`${playoffHighlights.topGame.teamName ? `${T(dbDisplayName(playoffHighlights.topGame.teamName))} · ` : ''}${phLabel(playoffHighlights.topGame.stageKey)}`} color="#e0c97a" />
                </a>
              )}
              <a href="/playoff/stats" className="block hover:opacity-80 transition-opacity">
                <RecordCard icon="🏀" label={lang === 'en' ? 'Playoff games' : 'משחקי פלייאוף'} value={String(playoffHighlights.gamesPlayed)}
                  sub={lang === 'en' ? 'Played so far' : 'שוחקו עד כה'} detail={lang === 'en' ? 'See playoff stats →' : 'לסטטיסטיקת הפלייאוף ←'} color="#e05a5a" />
              </a>
            </>
          ) : (
            <>
              <RecordCard icon="🏀" label={T('שיא סלים במשחק')} value={String(highScore.score)}
                sub={`${T(dbDisplayName(highScore.team))} ${lang === 'en' ? 'vs' : 'נגד'} ${T(dbDisplayName(highScore.opp))}`}
                detail={`${T('מחזור')} ${highScore.round} · ${highScore.date}`} color="#FF6B1A" />
              <RecordCard icon="🔢" label={T('שיא סלים משני הצדדים')} value={String(highCombined.sh + highCombined.sa)}
                sub={`${T(dbDisplayName(highCombined.home))} ${highCombined.sh} – ${highCombined.sa} ${T(dbDisplayName(highCombined.away))}`}
                detail={`${T('מחזור')} ${highCombined.round} · ${highCombined.date}`} color="#e0c97a" />
              <RecordCard icon="💥" label={T('הפרש גדול ביותר')} value={`+${biggestMargin}`}
                sub={`${T(dbDisplayName(biggestWinner))} ${lang === 'en' ? 'vs' : 'נגד'} ${T(dbDisplayName(biggestLoser))}`}
                detail={`${T('מחזור')} ${biggestWin.round} · ${biggestWin.date}`} color="#4ec97a" />
              <a href="/games?filter=close" className="block hover:opacity-80 transition-opacity">
                <RecordCard icon="📉" label={T('משחקים שהוכרעו ב-3 נקודות או פחות')} value={String(closestCount)}
                  sub={lang === 'en' ? 'Small margin' : 'הפרש קטן'} detail={lang === 'en' ? 'All season so far' : 'כל עונה עד כה'} color="#e05a5a" />
              </a>
            </>
          )}
        </div>
      </section>

      {/* ── Top Scorers ────────────────────────────────────────────────── */}
      {scorers.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white font-heading">
            <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">🏅</span>
            {T(scorersTitle)}
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

            {scorers.map((p, i) => {
              const MEDAL  = ['🥇', '🥈', '🥉'];
              const medal  = MEDAL[i] ?? null;
              const rankColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
              const maxPts = scorers[0].points || 1;
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
                    <p className="break-words text-sm font-bold text-white group-hover:text-orange-300 transition-colors leading-tight font-heading">
                      {displayName(p.name, lang)}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {p.jersey_number !== null && (
                        <span className="text-[10px] font-bold text-orange-400/70 shrink-0 font-stats">#{p.jersey_number}</span>
                      )}
                      {p.team_name && (
                        <span className="min-w-0 break-words text-[11px] font-bold text-[#8aaac8] font-body">{displayName(p.team_name, lang)}</span>
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
            <a href={scorersHref} className="text-sm font-bold text-[#8aaac8] hover:text-orange-400 transition-colors">
              {scorersLinkLabel}
            </a>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.04]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-base font-bold text-[#e0c97a] font-heading">📋 {inPlayoffs ? (lang === 'en' ? 'Playoff Facts' : 'עובדות פלייאוף') : T('עובדות עונה')}</h2>
        </div>
        <div className="grid grid-cols-1 divide-y divide-white/[0.05] sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
          {showPlayoffFacts ? (
            <Link href={`/players/${playoffTopScorers[0].id}`} className="group block p-5 transition-colors hover:bg-white/[0.03]">
              <p className="mb-1 text-sm font-bold text-[#8aaac8] font-body">{lang === 'en' ? 'Playoff top scorer' : 'מוביל קלעי הפלייאוף'}</p>
              <p className="text-base font-black text-green-400 group-hover:underline underline-offset-2 transition-colors font-heading">{playoffTopScorers[0].name}</p>
              <p className="text-sm font-bold text-[#8aaac8] font-stats">
                {playoffTopScorers[0].points} <span className="font-body">{T('נק׳')}</span>
              </p>
            </Link>
          ) : (
            <div className="p-5">
              <p className="mb-1 text-sm font-bold text-[#8aaac8] font-body">{T('מוביל סלים בליגה')}</p>
              <Link href={`/team/${encodeURIComponent(dbDisplayName(leagueTopScorer.name))}`} className="text-base font-black text-green-400 hover:underline underline-offset-2 transition-colors font-heading">
                {T(dbDisplayName(leagueTopScorer.name))}
              </Link>
              <p className="text-sm font-bold text-[#8aaac8] font-stats">
                {leagueTopScorer.pf ?? 0} <span className="font-body">{T('סלים')}</span>
              </p>
            </div>
          )}
          {inPlayoffs && playoffHighlights.highScore ? (
            // During the playoffs the middle fact swaps the cup final for a
            // playoff record — the highest single-team score so far.
            <Link href="/playoff" className="group block p-5 transition-colors hover:bg-white/[0.03]">
              <p className="mb-1 text-sm font-bold text-[#8aaac8] font-body">
                {lang === 'en' ? 'Top playoff score' : 'הניקוד הגבוה בפלייאוף'}
                <span className="ms-1 text-[#e0c97a] opacity-0 transition-opacity group-hover:opacity-100">←</span>
              </p>
              <p className="text-base font-black text-[#e0c97a] transition-colors group-hover:text-yellow-300 font-heading">
                <span className="font-heading">{T(dbDisplayName(playoffHighlights.highScore.team))}</span>{' '}
                <span className="font-stats">{playoffHighlights.highScore.score}</span>
              </p>
              <p className="text-sm font-bold text-[#8aaac8] font-body">
                {lang === 'en' ? 'vs ' : 'מול '}{T(dbDisplayName(playoffHighlights.highScore.opp))}
              </p>
            </Link>
          ) : (
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
          )}
          {inPlayoffs ? (
            <Link href="/playoff" className="group block p-5 transition-colors hover:bg-white/[0.03]">
              <p className="mb-1 text-sm font-bold text-[#8aaac8] font-body">
                {lang === 'en' ? 'Playoffs' : 'פלייאוף'}
                <span className="ms-1 text-[#e0c97a] opacity-0 transition-opacity group-hover:opacity-100">←</span>
              </p>
              <p className="text-2xl font-black text-[#e0c97a] font-heading transition-colors group-hover:text-yellow-300">{playoffStageLabel}</p>
              <p className="text-sm font-bold text-[#8aaac8] font-body">{lang === 'en' ? 'See the bracket' : 'צפו בעץ הפלייאוף'}</p>
            </Link>
          ) : (
            <div className="p-5">
              <p className="mb-1 text-sm font-bold text-[#8aaac8] font-body">{T('מחזורים שנותרו')}</p>
              <p className="text-3xl font-black text-blue-400 font-stats">{TOTAL_ROUNDS - currentRound}</p>
              <p className="text-sm font-bold text-[#8aaac8] font-body">{lang === 'en' ? `out of ${TOTAL_ROUNDS} rounds` : `מתוך ${TOTAL_ROUNDS} מחזורים`}</p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
