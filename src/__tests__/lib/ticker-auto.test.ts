import {
  parseAutoConfig,
  serializeAutoConfig,
  computeStreaks,
  lastRoundHighScorer,
  buildAutoTickerItems,
  autoTickerMessage,
  DEFAULT_AUTO_CONFIG,
  MAX_PREFIX_LEN,
  MIN_HOT_STREAK,
  type AutoTickerConfig,
  type GameResultLike,
} from '@/lib/ticker-auto';

// ===========================================================================
// parseAutoConfig / serializeAutoConfig
// ===========================================================================

describe('parseAutoConfig', () => {
  it('returns defaults for null / empty / non-JSON / non-object', () => {
    expect(parseAutoConfig(null)).toEqual(DEFAULT_AUTO_CONFIG);
    expect(parseAutoConfig('')).toEqual(DEFAULT_AUTO_CONFIG);
    expect(parseAutoConfig('not json')).toEqual(DEFAULT_AUTO_CONFIG);
    expect(parseAutoConfig('[1,2,3]')).toEqual(DEFAULT_AUTO_CONFIG);
    expect(parseAutoConfig('"a string"')).toEqual(DEFAULT_AUTO_CONFIG);
  });

  it('merges a partial config over defaults (incl. independent he/en prefixes)', () => {
    const cfg = parseAutoConfig(JSON.stringify({
      topScorer: { enabled: false },
      titleRace: { prefix: 'X', prefixEn: 'Y' },
    }));
    expect(cfg.topScorer.enabled).toBe(false);
    expect(cfg.topScorer.prefix).toBe(DEFAULT_AUTO_CONFIG.topScorer.prefix);     // untouched
    expect(cfg.topScorer.prefixEn).toBe(DEFAULT_AUTO_CONFIG.topScorer.prefixEn); // untouched
    expect(cfg.titleRace.prefix).toBe('X');
    expect(cfg.titleRace.prefixEn).toBe('Y');
    expect(cfg.titleRace.enabled).toBe(DEFAULT_AUTO_CONFIG.titleRace.enabled);
  });

  it('ignores wrong-typed fields', () => {
    const cfg = parseAutoConfig(JSON.stringify({ hotStreak: { enabled: 'yes', prefix: 123, prefixEn: {} } }));
    expect(cfg.hotStreak).toEqual(DEFAULT_AUTO_CONFIG.hotStreak);
  });

  it('round-trips through serializeAutoConfig (trim + clamp, both languages)', () => {
    const cfg: AutoTickerConfig = {
      topScorer: { enabled: true,  prefix: '  hi  ',       prefixEn: '  hey  ' },
      hotStreak: { enabled: false, prefix: 'x'.repeat(100), prefixEn: 'y'.repeat(100) },
      titleRace: { enabled: true,  prefix: 'race',          prefixEn: 'race-en' },
      seasonTopScorer: { enabled: true,  prefix: 'season', prefixEn: 'season-en' },
      cupHolder:       { enabled: true,  prefix: 'cup',    prefixEn: 'cup-en' },
      playoffsLive:    { enabled: false, prefix: 'po',     prefixEn: 'po-en' },
      playoffTopScorer: { enabled: true,  prefix: 'po-top',  prefixEn: 'po-top-en' },
      playoffNextGame:  { enabled: true,  prefix: 'po-next', prefixEn: 'po-next-en' },
      playoffResult:    { enabled: false, prefix: 'po-res',  prefixEn: 'po-res-en' },
    };
    const s = serializeAutoConfig(cfg);
    expect(s.topScorer.prefix).toBe('hi');
    expect(s.topScorer.prefixEn).toBe('hey');
    expect(s.hotStreak.prefix.length).toBe(MAX_PREFIX_LEN);
    expect(s.hotStreak.prefixEn.length).toBe(MAX_PREFIX_LEN);
    expect(parseAutoConfig(JSON.stringify(s))).toEqual(s);
  });
});

// ===========================================================================
// computeStreaks
// ===========================================================================

const g = (
  round: number, home: string, away: string,
  hs: number | null, as: number | null, techni = false,
): GameResultLike => ({ round, home_team: home, away_team: away, home_score: hs, away_score: as, techni });

describe('computeStreaks', () => {
  it('computes the current streak newest-first regardless of input order', () => {
    const games = [
      g(2, 'A', 'B', 50, 40), // A win
      g(1, 'A', 'C', 30, 20), // A win
      g(3, 'D', 'A', 10, 60), // A (away) win — latest round
    ];
    const streaks = computeStreaks(games);
    expect(streaks.find(s => s.name === 'A')).toEqual({ name: 'A', kind: 'W', n: 3 });
    expect(streaks.find(s => s.name === 'B')!.kind).toBe('L');
  });

  it('breaks a streak when the latest result flips', () => {
    const games = [g(1, 'A', 'B', 50, 40), g(2, 'A', 'B', 10, 40)]; // latest: A lost
    expect(computeStreaks(games).find(s => s.name === 'A')).toEqual({ name: 'A', kind: 'L', n: 1 });
  });

  it('skips unplayed 0:0 rows but counts a 0:0 techni double-forfeit as L for both', () => {
    expect(computeStreaks([g(1, 'A', 'B', 0, 0, false)])).toEqual([]);
    const dbl = computeStreaks([g(1, 'A', 'B', 0, 0, true)]);
    expect(dbl.find(s => s.name === 'A')!.kind).toBe('L');
    expect(dbl.find(s => s.name === 'B')!.kind).toBe('L');
  });

  it('ignores rows with null scores', () => {
    expect(computeStreaks([g(1, 'A', 'B', null, null)])).toEqual([]);
  });
});

// ===========================================================================
// lastRoundHighScorer
// ===========================================================================

describe('lastRoundHighScorer', () => {
  const games = [
    { id: 'g1', game_date: '2026-05-01' },
    { id: 'g2', game_date: '2026-05-08' }, // latest played matchday
    { id: 'g3', game_date: '2026-05-08' }, // same date, another game
    { id: 'g4', game_date: null },         // undated — ignored
    { id: 'g5', game_date: '2026-06-19' }, // future relative to TODAY
  ];
  const TODAY = '2026-05-31';

  it('picks the top single-game score on the most recent played matchday', () => {
    const stats = [
      { player_id: 'A', points: 40, game_id: 'g1' }, // earlier date — ignored
      { player_id: 'B', points: 22, game_id: 'g2' },
      { player_id: 'C', points: 31, game_id: 'g3' }, // latest played date, highest
      { player_id: 'D', points: 18, game_id: 'g2' },
    ];
    expect(lastRoundHighScorer(stats, games, TODAY)).toEqual({ playerId: 'C', points: 31 });
  });

  it('excludes future-dated games and falls back to the latest played scorer', () => {
    const stats = [
      { player_id: 'B', points: 22, game_id: 'g2' }, // 2026-05-08 (played)
      { player_id: 'X', points: 99, game_id: 'g5' }, // 2026-06-19 (future) — ignored
    ];
    expect(lastRoundHighScorer(stats, games, TODAY)).toEqual({ playerId: 'B', points: 22 });
  });

  it('skips a latest date whose only stats are zero points', () => {
    const stats = [
      { player_id: 'A', points: 16, game_id: 'g1' }, // 2026-05-01 has a scorer
      { player_id: 'Z', points: 0,  game_id: 'g2' }, // 2026-05-08 all zeros → skip
    ];
    expect(lastRoundHighScorer(stats, games, TODAY)).toEqual({ playerId: 'A', points: 16 });
  });

  it('ignores zero and null points', () => {
    const stats = [
      { player_id: 'B', points: 0, game_id: 'g2' },
      { player_id: 'C', points: null, game_id: 'g2' },
    ];
    expect(lastRoundHighScorer(stats, games, TODAY)).toBeNull();
  });

  it('returns null with no stats', () => {
    expect(lastRoundHighScorer([], games, TODAY)).toBeNull();
  });

  it('returns null when stats reference only unknown/undated/future games', () => {
    const stats = [
      { player_id: 'A', points: 25, game_id: 'unknown' },
      { player_id: 'B', points: 10, game_id: 'g4' }, // undated
      { player_id: 'X', points: 99, game_id: 'g5' }, // future
    ];
    expect(lastRoundHighScorer(stats, games, TODAY)).toBeNull();
  });

  it('keeps the first of equal top scores', () => {
    const stats = [
      { player_id: 'B', points: 20, game_id: 'g2' },
      { player_id: 'C', points: 20, game_id: 'g3' },
    ];
    expect(lastRoundHighScorer(stats, games, TODAY)).toEqual({ playerId: 'B', points: 20 });
  });
});

// ===========================================================================
// buildAutoTickerItems (bilingual)
// ===========================================================================

describe('buildAutoTickerItems', () => {
  const find = (items: ReturnType<typeof buildAutoTickerItems>, t: string) => items.find(i => i.type === t)!;

  it('builds the top-scorer line in both languages with a player deep link', () => {
    const items = buildAutoTickerItems({
      config: DEFAULT_AUTO_CONFIG,
      topScorer: { id: 'p1', name: 'יוסי', points: 28 },
      divisions: [],
      streaks: [],
    });
    const top = find(items, 'topScorer');
    expect(top.enabled).toBe(true);
    expect(top.valueHe).toBe('יוסי — 28 נק׳');
    expect(top.valueEn).toBe('יוסי — 28 pts');
    expect(autoTickerMessage(top, 'he')).toBe('🏀 קלע המחזור: יוסי — 28 נק׳');
    expect(autoTickerMessage(top, 'en')).toBe('🏀 Top scorer: יוסי — 28 pts');
    expect(top.href).toBe('/players/p1');
  });

  it('top-scorer is null with no scorer or zero points', () => {
    const none = buildAutoTickerItems({ config: DEFAULT_AUTO_CONFIG, topScorer: null, divisions: [], streaks: [] });
    expect(find(none, 'topScorer').valueHe).toBeNull();
    expect(find(none, 'topScorer').valueEn).toBeNull();
    expect(autoTickerMessage(find(none, 'topScorer'), 'he')).toBeNull();
    expect(autoTickerMessage(find(none, 'topScorer'), 'en')).toBeNull();
    expect(find(none, 'topScorer').href).toBeNull();

    const zero = buildAutoTickerItems({ config: DEFAULT_AUTO_CONFIG, topScorer: { id: 'p', name: 'x', points: 0 }, divisions: [], streaks: [] });
    expect(find(zero, 'topScorer').valueHe).toBeNull();
  });

  it('hot streak picks the longest win streak at or above the threshold', () => {
    const items = buildAutoTickerItems({
      config: DEFAULT_AUTO_CONFIG,
      topScorer: null,
      divisions: [],
      streaks: [
        { name: 'A', kind: 'W', n: 3 },
        { name: 'B', kind: 'W', n: 5 },
        { name: 'C', kind: 'L', n: 9 }, // losing streak — never picked
        { name: 'D', kind: 'W', n: 2 }, // below threshold
      ],
    });
    const hot = find(items, 'hotStreak');
    expect(hot.valueHe).toBe('B — 5 ברצף');
    expect(hot.valueEn).toBe('B — 5 in a row');
    expect(hot.href).toBe('/standings');
  });

  it('no hot streak below the threshold', () => {
    const items = buildAutoTickerItems({
      config: DEFAULT_AUTO_CONFIG, topScorer: null, divisions: [],
      streaks: [{ name: 'A', kind: 'W', n: MIN_HOT_STREAK - 1 }],
    });
    expect(find(items, 'hotStreak').valueHe).toBeNull();
  });

  it('title race shows the closest division within the gap cap (singular pt)', () => {
    const items = buildAutoTickerItems({
      config: { ...DEFAULT_AUTO_CONFIG, titleRace: { enabled: true, prefix: '⚔️', prefixEn: 'Race:' } },
      topScorer: null,
      divisions: [
        { division: 'North', rows: [{ name: 'N1', pts: 20 }, { name: 'N2', pts: 14 }] }, // gap 6 — too big
        { division: 'South', rows: [{ name: 'S1', pts: 18 }, { name: 'S2', pts: 17 }] }, // gap 1
      ],
      streaks: [],
    });
    const tr = find(items, 'titleRace');
    expect(tr.enabled).toBe(true);
    expect(tr.valueHe).toBe('S1 מוביל על S2 ב-1 נק׳');
    expect(tr.valueEn).toBe('S1 leads S2 by 1 pt');
  });

  it('title race pluralizes English points for a 2-point gap', () => {
    const items = buildAutoTickerItems({
      config: DEFAULT_AUTO_CONFIG, topScorer: null, streaks: [],
      divisions: [{ division: 'X', rows: [{ name: 'A', pts: 12 }, { name: 'B', pts: 10 }] }],
    });
    expect(find(items, 'titleRace').valueEn).toBe('A leads B by 2 pts');
  });

  it('title race uses tie phrasing and hides when the gap is too big', () => {
    const tie = buildAutoTickerItems({
      config: DEFAULT_AUTO_CONFIG, topScorer: null, streaks: [],
      divisions: [{ division: 'X', rows: [{ name: 'A', pts: 10 }, { name: 'B', pts: 10 }] }],
    });
    expect(find(tie, 'titleRace').valueHe).toBe('A ו-B צמודים בצמרת');
    expect(find(tie, 'titleRace').valueEn).toBe('A & B are tied at the top');

    const far = buildAutoTickerItems({
      config: DEFAULT_AUTO_CONFIG, topScorer: null, streaks: [],
      divisions: [{ division: 'X', rows: [{ name: 'A', pts: 10 }, { name: 'B', pts: 1 }] }],
    });
    expect(find(far, 'titleRace').valueHe).toBeNull();
  });

  it('keeps a disabled type in the list (enabled=false) but still builds its values for preview', () => {
    const items = buildAutoTickerItems({
      config: { ...DEFAULT_AUTO_CONFIG, topScorer: { enabled: false, prefix: 'P', prefixEn: 'PE' } },
      topScorer: { id: 'p', name: 'x', points: 5 },
      divisions: [],
      streaks: [],
    });
    const top = find(items, 'topScorer');
    expect(top.enabled).toBe(false);
    expect(autoTickerMessage(top, 'he')).toBe('P x — 5 נק׳');
    expect(autoTickerMessage(top, 'en')).toBe('PE x — 5 pts');
  });

  // ── Season-end / playoff lines ──────────────────────────────────────────
  it('builds the season top-scorer, cup-holder and playoffs lines when data is present', () => {
    const items = buildAutoTickerItems({
      config: DEFAULT_AUTO_CONFIG,
      topScorer: null,
      divisions: [],
      streaks: [],
      seasonTopScorer: { id: 'p9', name: 'דני', points: 412 },
      cupHolder: 'ידרסל חדרה',
      playoffsActive: true,
    });

    const season = find(items, 'seasonTopScorer');
    expect(season.valueHe).toBe('דני — 412 נק׳');
    expect(autoTickerMessage(season, 'he')).toBe('🏅 קלע העונה: דני — 412 נק׳');
    expect(season.href).toBe('/players/p9');

    const cup = find(items, 'cupHolder');
    expect(cup.valueHe).toBe('ידרסל חדרה');
    expect(autoTickerMessage(cup, 'he')).toBe('🏆 מחזיקת הגביע: ידרסל חדרה');
    expect(cup.href).toBe('/cup');

    const po = find(items, 'playoffsLive');
    expect(autoTickerMessage(po, 'he')).toBe('🏆 הפלייאוף יצא לדרך — צפו בעץ');
    expect(po.href).toBe('/playoff');
  });

  it('keeps the season-end / playoff lines silent when their data is absent', () => {
    const items = buildAutoTickerItems({ config: DEFAULT_AUTO_CONFIG, topScorer: null, divisions: [], streaks: [] });
    for (const type of ['seasonTopScorer', 'cupHolder', 'playoffsLive']) {
      const it = find(items, type);
      expect(it.valueHe).toBeNull();
      expect(autoTickerMessage(it, 'he')).toBeNull();
      expect(it.href).toBeNull();
    }
  });

  // ── Playoff spotlight lines ─────────────────────────────────────────────
  it('builds the playoff top-scorer / next-game / result lines', () => {
    const items = buildAutoTickerItems({
      config: DEFAULT_AUTO_CONFIG,
      topScorer: null,
      divisions: [],
      streaks: [],
      playoffTopScorer: { name: 'יעקב', points: 43 },
      playoffNextGame: { teamA: 'ראשון גפן לציון', teamB: 'בני מוצקין', dateLabel: '24.7 · 15:00' },
      playoffResult: { seriesNumber: 4, homeName: 'ידרסל חדרה', awayName: 'אופק רחובות', homeScore: 55, awayScore: 45 },
    });

    const top = find(items, 'playoffTopScorer');
    expect(autoTickerMessage(top, 'he')).toBe('🏀 קלע הפלייאוף: יעקב — 43 נק׳');
    expect(top.href).toBe('/playoff/stats');

    const next = find(items, 'playoffNextGame');
    expect(next.valueHe).toBe('ראשון גפן לציון נגד בני מוצקין — 24.7 · 15:00');
    expect(next.valueEn).toBe('ראשון גפן לציון vs בני מוצקין — 24.7 · 15:00');
    expect(next.href).toBe('/playoff');

    const res = find(items, 'playoffResult');
    expect(res.valueHe).toBe('ידרסל חדרה 55:45 אופק רחובות');
    expect(res.href).toBe('/playoff/series/4');
  });

  // ── Phase gating ────────────────────────────────────────────────────────
  it('suppresses regular-season lines during the playoffs and vice versa', () => {
    const base = {
      config: DEFAULT_AUTO_CONFIG,
      topScorer: { id: 'p1', name: 'סהר', points: 23 },
      divisions: [{ division: 'North', rows: [{ name: 'א', pts: 10 }, { name: 'ב', pts: 9 }] }],
      streaks: [{ name: 'בני מוצקין', kind: 'W' as const, n: 8 }],
      playoffsActive: true,
      playoffTopScorer: { name: 'יעקב', points: 43 },
      playoffNextGame: { teamA: 'א', teamB: 'ב', dateLabel: null },
      playoffResult: { seriesNumber: 1, homeName: 'א', awayName: 'ב', homeScore: 70, awayScore: 60 },
    };

    const playoffs = buildAutoTickerItems({ ...base, phase: 'playoffs' });
    for (const type of ['topScorer', 'hotStreak', 'titleRace']) {
      expect(find(playoffs, type).valueHe).toBeNull();
      expect(find(playoffs, type).href).toBeNull();
    }
    expect(find(playoffs, 'playoffTopScorer').valueHe).not.toBeNull();
    expect(find(playoffs, 'playoffNextGame').valueHe).not.toBeNull();
    expect(find(playoffs, 'playoffResult').valueHe).not.toBeNull();
    expect(find(playoffs, 'playoffsLive').valueHe).not.toBeNull();

    const regular = buildAutoTickerItems({ ...base, phase: 'regular' });
    for (const type of ['playoffsLive', 'playoffTopScorer', 'playoffNextGame', 'playoffResult']) {
      expect(find(regular, type).valueHe).toBeNull();
      expect(find(regular, type).href).toBeNull();
    }
    expect(find(regular, 'topScorer').valueHe).not.toBeNull();
    expect(find(regular, 'hotStreak').valueHe).not.toBeNull();

    // No phase given (e.g. old callers) → nothing suppressed.
    const ungated = buildAutoTickerItems(base);
    expect(find(ungated, 'topScorer').valueHe).not.toBeNull();
    expect(find(ungated, 'playoffTopScorer').valueHe).not.toBeNull();
  });
});
