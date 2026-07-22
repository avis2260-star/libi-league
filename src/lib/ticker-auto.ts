// Auto-generated ticker "spotlight" lines (top scorer / hot streak / title race).
//
// These are computed fresh from the current season's data on every home-page
// render, so they "refresh themselves" each round. The league manager can,
// from the admin "הודעות" tab, toggle each line on/off and edit its prefix
// wording — that config lives in league_settings under key `ticker_auto`
// (JSON), parsed/serialized here.
//
// This module is intentionally PURE (no DB, no React) so it can be unit-tested
// in isolation. The DB-backed wrapper lives in ./ticker-auto-data.ts.

export type AutoTickerType =
  | 'topScorer' | 'hotStreak' | 'titleRace'           // regular season
  | 'seasonTopScorer' | 'cupHolder' | 'playoffsLive'  // season-end / playoffs
  | 'playoffTopScorer' | 'playoffNextGame' | 'playoffResult'; // playoffs only

export type AutoTickerTypeConfig = {
  enabled: boolean;
  /** Hebrew text shown before the live value, e.g. "🏀 קלע המחזור:". */
  prefix: string;
  /** English text shown before the live value, e.g. "🏀 Top scorer:". */
  prefixEn: string;
};

export type AutoTickerConfig = Record<AutoTickerType, AutoTickerTypeConfig>;

/** Render order (also the order shown in the admin panel). */
export const AUTO_TICKER_ORDER: AutoTickerType[] = [
  'topScorer', 'hotStreak', 'titleRace',
  'seasonTopScorer', 'cupHolder', 'playoffsLive',
  'playoffTopScorer', 'playoffNextGame', 'playoffResult',
];

/** Human label per type for the admin UI. */
export const AUTO_TICKER_LABELS: Record<AutoTickerType, string> = {
  topScorer: 'קלע המחזור',
  hotStreak: 'רצף ניצחונות',
  titleRace: 'מאבק צמרת',
  seasonTopScorer: 'קלע העונה',
  cupHolder: 'מחזיקת הגביע',
  playoffsLive: 'פלייאוף',
  playoffTopScorer: 'קלע הפלייאוף',
  playoffNextGame: 'המשחק הבא בפלייאוף',
  playoffResult: 'תוצאת פלייאוף',
};

/** Dot color (key into BG_COLOR_CLASSES on the home page) per type. */
export const AUTO_TICKER_BG: Record<AutoTickerType, string> = {
  topScorer: 'orange',
  hotStreak: 'red',
  titleRace: 'blue',
  seasonTopScorer: 'orange',
  cupHolder: 'green',
  playoffsLive: 'blue',
  playoffTopScorer: 'orange',
  playoffNextGame: 'blue',
  playoffResult: 'red',
};

export const DEFAULT_AUTO_CONFIG: AutoTickerConfig = {
  topScorer: { enabled: true,  prefix: '🏀 קלע המחזור:', prefixEn: '🏀 Top scorer:' },
  hotStreak: { enabled: true,  prefix: '🔥 רצף חם:',     prefixEn: '🔥 Hot streak:' },
  titleRace: { enabled: false, prefix: '⚔️ מאבק צמרת:',  prefixEn: '⚔️ Title race:' },
  // Season-end / playoff lines — only surface once their data exists, so they
  // can stay enabled year-round and simply stay quiet during the regular season.
  seasonTopScorer: { enabled: true, prefix: '🏅 קלע העונה:',    prefixEn: '🏅 Season top scorer:' },
  cupHolder:       { enabled: true, prefix: '🏆 מחזיקת הגביע:', prefixEn: '🏆 Cup Holder:' },
  playoffsLive:    { enabled: true, prefix: '🏆',               prefixEn: '🏆' },
  playoffTopScorer: { enabled: true, prefix: '🏀 קלע הפלייאוף:',   prefixEn: '🏀 Playoff top scorer:' },
  playoffNextGame:  { enabled: true, prefix: '🗓️ הבא בפלייאוף:',  prefixEn: '🗓️ Next playoff game:' },
  playoffResult:    { enabled: true, prefix: '🔥 תוצאת פלייאוף:', prefixEn: '🔥 Playoff result:' },
};

/** Longest prefix we persist (guards against pathological input). */
export const MAX_PREFIX_LEN = 60;

/** A team needs at least this many consecutive wins to count as "hot". */
export const MIN_HOT_STREAK = 3;

/** Title-race line shows only when the top-two gap is within this many table points. */
export const MAX_TITLE_RACE_GAP = 2;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Parse the stored JSON config, merging over defaults so missing/garbled
 * fields fall back safely and newly-added types keep working on old data.
 */
export function parseAutoConfig(raw: string | null | undefined): AutoTickerConfig {
  const out = {} as AutoTickerConfig;
  for (const type of AUTO_TICKER_ORDER) out[type] = { ...DEFAULT_AUTO_CONFIG[type] };
  if (!raw) return out;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return out; }
  if (!isPlainObject(parsed)) return out;

  for (const type of AUTO_TICKER_ORDER) {
    const entry = parsed[type];
    if (!isPlainObject(entry)) continue;
    if (typeof entry.enabled === 'boolean') out[type].enabled = entry.enabled;
    if (typeof entry.prefix === 'string') out[type].prefix = entry.prefix.slice(0, MAX_PREFIX_LEN);
    if (typeof entry.prefixEn === 'string') out[type].prefixEn = entry.prefixEn.slice(0, MAX_PREFIX_LEN);
  }
  return out;
}

/** Normalize a config for persistence (coerce booleans, trim + clamp prefixes). */
export function serializeAutoConfig(config: AutoTickerConfig): AutoTickerConfig {
  const out = {} as AutoTickerConfig;
  for (const type of AUTO_TICKER_ORDER) {
    const c = config[type] ?? DEFAULT_AUTO_CONFIG[type];
    out[type] = {
      enabled: Boolean(c.enabled),
      prefix: String(c.prefix ?? '').trim().slice(0, MAX_PREFIX_LEN),
      prefixEn: String(c.prefixEn ?? '').trim().slice(0, MAX_PREFIX_LEN),
    };
  }
  return out;
}

// ── Streak computation ───────────────────────────────────────────────────────

export type GameResultLike = {
  round: number;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  techni: boolean | null;
};

export type TeamStreak = { name: string; kind: 'W' | 'L'; n: number };

/**
 * Current win/loss streak per team, derived from game_results. Mirrors the
 * algorithm used by the standings page (src/app/standings/page.tsx): results
 * are ordered newest-first by round, a 0:0 row with no techni flag is an
 * unplayed game (skipped), and a 0:0 techni row is a double-forfeit (both
 * teams get an 'L').
 *
 * One entry per team that has played ≥1 game, keyed by the team name exactly
 * as it appears in the rows passed in (the caller resolves to canonical names
 * BEFORE calling, so name variants don't split a team's streak).
 */
export function computeStreaks(games: GameResultLike[]): TeamStreak[] {
  type Entry = { result: 'W' | 'L'; round: number };
  const byTeam = new Map<string, Entry[]>();
  const push = (name: string | null, result: 'W' | 'L', round: number) => {
    if (!name) return;
    const arr = byTeam.get(name) ?? [];
    arr.push({ result, round });
    byTeam.set(name, arr);
  };

  for (const g of games) {
    if (g.home_score == null || g.away_score == null) continue;
    const bothZero = g.home_score === 0 && g.away_score === 0;
    if (bothZero && !g.techni) continue;        // genuinely unplayed
    if (bothZero && g.techni) {                 // double forfeit → both lose
      push(g.home_team, 'L', g.round);
      push(g.away_team, 'L', g.round);
      continue;
    }
    const homeWon = g.home_score > g.away_score;
    push(g.home_team, homeWon ? 'W' : 'L', g.round);
    push(g.away_team, homeWon ? 'L' : 'W', g.round);
  }

  const out: TeamStreak[] = [];
  for (const [name, entries] of byTeam) {
    if (entries.length === 0) continue;
    entries.sort((a, b) => b.round - a.round); // newest first
    const kind = entries[0].result;
    let n = 0;
    for (const e of entries) { if (e.result === kind) n++; else break; }
    out.push({ name, kind, n });
  }
  return out;
}

// ── Last-round high scorer ───────────────────────────────────────────────────

export type GameStatLike = { player_id: string; points: number | null; game_id: string };
export type GameDateLike = { id: string; game_date: string | null };

/**
 * The single-game high scorer of the most recent *played* matchday. Rounds map
 * 1:1 to dates in this league, so "last round" = the latest games.game_date —
 * but we anchor on the latest date that is on/before `todayIso` AND has at
 * least one positive scorer. That deliberately skips:
 *   • future-dated rows (pre-entered or reschedule-drifted games), and
 *   • dates whose only stats are zero-point rows (e.g. fouls-only entries),
 * falling back to the most recent date that actually has a scorer.
 * game_date is an ISO date ('YYYY-MM-DD'), so lexical comparison is
 * chronological. Returns { playerId, points } of the top score, or null.
 */
export function lastRoundHighScorer(
  stats: GameStatLike[],
  games: GameDateLike[],
  todayIso: string,
): { playerId: string; points: number } | null {
  const dateById = new Map<string, string>();
  for (const g of games) if (g.game_date) dateById.set(g.id, g.game_date);

  let latest = '';
  for (const s of stats) {
    const d = dateById.get(s.game_id);
    if (!d || d > todayIso) continue;       // undated or future
    if ((s.points ?? 0) <= 0) continue;     // no points scored
    if (d > latest) latest = d;
  }
  if (!latest) return null;

  let best: { playerId: string; points: number } | null = null;
  for (const s of stats) {
    if (dateById.get(s.game_id) !== latest) continue;
    const pts = s.points ?? 0;
    if (pts > 0 && (!best || pts > best.points)) best = { playerId: s.player_id, points: pts };
  }
  return best;
}

// ── Item builder ───────────────────────────────────────────────────────────

export type AutoTickerBuildInput = {
  config: AutoTickerConfig;
  /** Top scorer of the latest round (name already resolved). null if none. */
  topScorer: { id: string; name: string; points: number } | null;
  /** Standings grouped by division, each pre-sorted by rank ascending, names resolved. */
  divisions: { division: string; rows: { name: string; pts: number }[] }[];
  /** Active streaks (names resolved). */
  streaks: TeamStreak[];
  /** Season cumulative scoring leader. null/omitted = no line. */
  seasonTopScorer?: { id: string; name: string; points: number } | null;
  /** Current cup holder (team name, resolved). null/omitted until the final is decided. */
  cupHolder?: string | null;
  /** True while ≥1 playoff game is still unplayed this season. */
  playoffsActive?: boolean;
  /** Playoff cumulative scoring leader. null/omitted = no line. */
  playoffTopScorer?: { name: string; points: number } | null;
  /** Next scheduled playoff game (names resolved; dateLabel pre-formatted or null). */
  playoffNextGame?: { teamA: string; teamB: string; dateLabel: string | null } | null;
  /** Latest played playoff game (names resolved, home first). */
  playoffResult?: { seriesNumber: number; homeName: string; awayName: string; homeScore: number; awayScore: number } | null;
  /**
   * Active season phase. During the playoffs the regular-season lines
   * (round scorer / hot streak / title race) are suppressed — their data is
   * frozen mid-season and reads stale; during the regular season the
   * playoff-only lines are suppressed. Omitted = no phase gating.
   */
  phase?: 'regular' | 'playoffs' | 'offseason';
};

export type Lang = 'he' | 'en';

export type AutoTickerItem = {
  type: AutoTickerType;
  enabled: boolean;
  prefix: string;    // Hebrew prefix
  prefixEn: string;  // English prefix
  /** Live dynamic part per language, or null when there's nothing to show. */
  valueHe: string | null;
  valueEn: string | null;
  /** Optional deep link (language-independent). */
  href: string | null;
  /** Color key into BG_COLOR_CLASSES. */
  bgColor: string;
};

function joinLine(prefix: string, value: string): string {
  const p = prefix.trim();
  return p ? `${p} ${value}` : value;
}

/**
 * The full line (prefix + value) for the given language, or null when that
 * language has no value to show. Used by the home page at render time.
 */
export function autoTickerMessage(item: AutoTickerItem, lang: Lang): string | null {
  const value = lang === 'en' ? item.valueEn : item.valueHe;
  if (value == null) return null;
  return joinLine(lang === 'en' ? item.prefixEn : item.prefix, value);
}

/**
 * Build one item per auto type. Items are returned for ALL types (so the admin
 * can preview each) and carry BOTH languages, so the caller picks per the
 * site's EN/HE toggle via autoTickerMessage(). The home page filters to
 * `enabled` items with a non-null message for the active language.
 */
export function buildAutoTickerItems(input: AutoTickerBuildInput): AutoTickerItem[] {
  const { config, topScorer, divisions, streaks } = input;

  // Top scorer
  const hasTop = !!topScorer && topScorer.points > 0;
  const topHe = hasTop ? `${topScorer!.name} — ${topScorer!.points} נק׳` : null;
  const topEn = hasTop ? `${topScorer!.name} — ${topScorer!.points} pts` : null;

  // Hot streak — the longest active win streak meeting the threshold
  const hot = streaks
    .filter(s => s.kind === 'W' && s.n >= MIN_HOT_STREAK)
    .sort((a, b) => b.n - a.n)[0] ?? null;
  const hotHe = hot ? `${hot.name} — ${hot.n} ברצף` : null;
  const hotEn = hot ? `${hot.name} — ${hot.n} in a row` : null;

  // Title race — the division with the smallest top-two gap within the cap
  let titleRaceHe: string | null = null;
  let titleRaceEn: string | null = null;
  let bestGap = Infinity;
  for (const d of divisions) {
    if (d.rows.length < 2) continue;
    const gap = d.rows[0].pts - d.rows[1].pts;
    if (gap < 0 || gap > MAX_TITLE_RACE_GAP || gap >= bestGap) continue;
    bestGap = gap;
    const leader = d.rows[0].name;
    const chaser = d.rows[1].name;
    if (gap === 0) {
      titleRaceHe = `${leader} ו-${chaser} צמודים בצמרת`;
      titleRaceEn = `${leader} & ${chaser} are tied at the top`;
    } else {
      titleRaceHe = `${leader} מוביל על ${chaser} ב-${gap} נק׳`;
      titleRaceEn = `${leader} leads ${chaser} by ${gap} pt${gap === 1 ? '' : 's'}`;
    }
  }

  // Season cumulative scoring leader
  const seasonTop = input.seasonTopScorer ?? null;
  const hasSeasonTop = !!seasonTop && seasonTop.points > 0;
  const seasonTopHe = hasSeasonTop ? `${seasonTop!.name} — ${seasonTop!.points} נק׳` : null;
  const seasonTopEn = hasSeasonTop ? `${seasonTop!.name} — ${seasonTop!.points} pts` : null;

  // Cup holder (team name, already resolved)
  const cupHolder = input.cupHolder ?? null;

  // Playoffs underway (≥1 unplayed playoff game)
  const playoffsActive = input.playoffsActive ?? false;
  const playoffsHe = playoffsActive ? 'הפלייאוף יצא לדרך — צפו בעץ' : null;
  const playoffsEn = playoffsActive ? 'Playoffs are underway — see the bracket' : null;

  // Playoff scoring leader
  const poTop = input.playoffTopScorer ?? null;
  const hasPoTop = !!poTop && poTop.points > 0;
  const poTopHe = hasPoTop ? `${poTop!.name} — ${poTop!.points} נק׳` : null;
  const poTopEn = hasPoTop ? `${poTop!.name} — ${poTop!.points} pts` : null;

  // Next playoff game
  const poNext = input.playoffNextGame ?? null;
  const poNextHe = poNext ? `${poNext.teamA} נגד ${poNext.teamB}${poNext.dateLabel ? ` — ${poNext.dateLabel}` : ''}` : null;
  const poNextEn = poNext ? `${poNext.teamA} vs ${poNext.teamB}${poNext.dateLabel ? ` — ${poNext.dateLabel}` : ''}` : null;

  // Latest playoff result
  const poRes = input.playoffResult ?? null;
  const poResHe = poRes ? `${poRes.homeName} ${poRes.homeScore}:${poRes.awayScore} ${poRes.awayName}` : null;
  const poResEn = poResHe;

  const heByType: Record<AutoTickerType, string | null> = {
    topScorer: topHe, hotStreak: hotHe, titleRace: titleRaceHe,
    seasonTopScorer: seasonTopHe, cupHolder, playoffsLive: playoffsHe,
    playoffTopScorer: poTopHe, playoffNextGame: poNextHe, playoffResult: poResHe,
  };
  const enByType: Record<AutoTickerType, string | null> = {
    topScorer: topEn, hotStreak: hotEn, titleRace: titleRaceEn,
    seasonTopScorer: seasonTopEn, cupHolder, playoffsLive: playoffsEn,
    playoffTopScorer: poTopEn, playoffNextGame: poNextEn, playoffResult: poResEn,
  };
  const hrefByType: Record<AutoTickerType, string | null> = {
    topScorer: hasTop ? `/players/${topScorer!.id}` : null,
    hotStreak: '/standings',
    titleRace: '/standings',
    seasonTopScorer: hasSeasonTop ? `/players/${seasonTop!.id}` : null,
    cupHolder: cupHolder ? '/cup' : null,
    playoffsLive: playoffsActive ? '/playoff' : null,
    playoffTopScorer: hasPoTop ? '/playoff/stats' : null,
    playoffNextGame: poNext ? '/playoff' : null,
    playoffResult: poRes ? `/playoff/series/${poRes.seriesNumber}` : null,
  };

  // Phase gating — during the playoffs (or off-season) the regular-season
  // spotlight lines are stale mid-season data; during the regular season the
  // playoff lines don't belong. Nulling the value also nulls the href below.
  const REGULAR_ONLY: AutoTickerType[] = ['topScorer', 'hotStreak', 'titleRace'];
  const PLAYOFF_ONLY: AutoTickerType[] = ['playoffsLive', 'playoffTopScorer', 'playoffNextGame', 'playoffResult'];
  const suppressed = input.phase === 'playoffs' || input.phase === 'offseason'
    ? REGULAR_ONLY
    : input.phase === 'regular' ? PLAYOFF_ONLY : [];
  for (const t of suppressed) { heByType[t] = null; enByType[t] = null; }

  return AUTO_TICKER_ORDER.map((type) => {
    const c = config[type] ?? DEFAULT_AUTO_CONFIG[type];
    const valueHe = heByType[type];
    return {
      type,
      enabled: c.enabled,
      prefix: c.prefix,
      prefixEn: c.prefixEn,
      valueHe,
      valueEn: enByType[type],
      href: valueHe != null ? hrefByType[type] : null,
      bgColor: AUTO_TICKER_BG[type],
    };
  });
}
