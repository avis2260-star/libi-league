import {
  parseAutoConfig,
  serializeAutoConfig,
  computeStreaks,
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
});
