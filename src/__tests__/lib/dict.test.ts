import { DICT } from '@/lib/dict';

// ---------------------------------------------------------------------------
// DICT integrity tests
//
// These are "smoke tests" for the translation dictionary itself. They don't
// care about specific translations – they guard against accidental corruption
// (empty values, missing keys) that would silently break the English UI.
// ---------------------------------------------------------------------------

describe('DICT translation dictionary', () => {
  const entries = Object.entries(DICT);

  it('contains at least 100 entries', () => {
    // Sanity check – if someone accidentally blanks the file this fails fast.
    expect(entries.length).toBeGreaterThanOrEqual(100);
  });

  it('every value is a non-empty string', () => {
    const bad = entries.filter(([, v]) => typeof v !== 'string' || v.trim() === '');
    expect(bad).toHaveLength(0);
  });

  it('no value is null or undefined', () => {
    const nullish = entries.filter(([, v]) => v == null);
    expect(nullish).toHaveLength(0);
  });

  it('all keys are non-empty strings', () => {
    const badKeys = entries.filter(([k]) => typeof k !== 'string' || k.trim() === '');
    expect(badKeys).toHaveLength(0);
  });

  describe('core navigation terms are translated', () => {
    const NAV_KEYS: [string, string][] = [
      ['בית', 'Home'],
      ['משחקים', 'Games'],
      ['טבלאות', 'Standings'],
      ['שחקנים', 'Players'],
      ['קבוצות', 'Teams'],
      ['גביע', 'Cup'],
      ['פלייאוף', 'Playoff'],
      ['תוצאות', 'Results'],
    ];

    test.each(NAV_KEYS)('DICT["%s"] === "%s"', (he, en) => {
      expect(DICT[he]).toBe(en);
    });
  });

  describe('core stats terms are translated', () => {
    const STATS_KEYS: [string, string][] = [
      ['נקודות', 'Points'],
      ['פאולים', 'Fouls'],
      ['נצחונות', 'Wins'],
      ['הפסדים', 'Losses'],
    ];

    test.each(STATS_KEYS)('DICT["%s"] === "%s"', (he, en) => {
      expect(DICT[he]).toBe(en);
    });
  });

  it('contains Hebrew team name entries with English translations', () => {
    // A handful of team aliases that the UI relies on for display
    expect(DICT['אדיס אשדוד']).toBe('Addis Ashdod');
    expect(DICT['בני נתניה']).toBe('Bnei Netanya');
  });
});
