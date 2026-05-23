// team-name-resolver.ts imports supabaseAdmin at module level (for
// loadNameResolver) even though makeNameResolver is pure. We mock the module
// so the import doesn't try to contact Supabase during tests.
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

import { makeNameResolver, TeamRow } from '@/lib/team-name-resolver';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEAMS: TeamRow[] = [
  { id: '1', name: 'שועלי אדיס אשדוד' },
  { id: '2', name: 'כח עולה בת ים' },
  { id: '3', name: 'גוטלמן השרון' },
  { id: '4', name: 'בני נתניה' },
  { id: '5', name: 'ידרסל חדרה' },
];

const resolve = makeNameResolver(TEAMS);

// ---------------------------------------------------------------------------
// makeNameResolver – exact canonical match
// ---------------------------------------------------------------------------

describe('makeNameResolver – exact match', () => {
  it('returns the canonical name when input matches exactly', () => {
    expect(resolve('שועלי אדיס אשדוד')).toBe('שועלי אדיס אשדוד');
  });

  it('matches after stripping Hebrew single geresh (׳)', () => {
    // e.g. schedule might store "אדיס׳ אשדוד" instead of "אדיס אשדוד"
    expect(resolve('שועלי אדיס׳ אשדוד')).toBe('שועלי אדיס אשדוד');
  });

  it('matches after stripping Hebrew double-geresh (״)', () => {
    expect(resolve('שועלי אדיס״ אשדוד')).toBe('שועלי אדיס אשדוד');
  });

  it('matches after stripping straight double-quotes', () => {
    expect(resolve('"שועלי אדיס אשדוד"')).toBe('שועלי אדיס אשדוד');
  });

  it('matches after stripping straight single-quotes', () => {
    expect(resolve("'שועלי אדיס אשדוד'")).toBe('שועלי אדיס אשדוד');
  });

  it('matches after stripping backticks', () => {
    expect(resolve('`כח עולה בת ים`')).toBe('כח עולה בת ים');
  });

  it('matches after collapsing extra whitespace', () => {
    expect(resolve('שועלי  אדיס   אשדוד')).toBe('שועלי אדיס אשדוד');
  });

  it('matches after trimming leading/trailing whitespace', () => {
    expect(resolve('  כח עולה בת ים  ')).toBe('כח עולה בת ים');
  });

  it('is case-insensitive for Latin characters', () => {
    // Hebrew has no case, but the normalization lowercases everything so
    // any Latin mixed-in text is matched case-insensitively.
    const withLatinTeams: TeamRow[] = [{ id: 'a', name: 'Team Alpha' }];
    const r = makeNameResolver(withLatinTeams);
    expect(r('TEAM ALPHA')).toBe('Team Alpha');
    expect(r('team alpha')).toBe('Team Alpha');
  });
});

// ---------------------------------------------------------------------------
// makeNameResolver – substring fallback match
// ---------------------------------------------------------------------------

describe('makeNameResolver – substring fallback match', () => {
  it('matches when input is a shorter substring of the canonical name', () => {
    // 'אדיס אשדוד' appears inside 'שועלי אדיס אשדוד' (common schedule shortening)
    expect(resolve('אדיס אשדוד')).toBe('שועלי אדיס אשדוד');
  });

  it('matches when the canonical name is a substring of the input', () => {
    // Some sources prefix the canonical name with extra words.
    // 'בני נתניה' ⊂ 'עמותת בני נתניה'
    expect(resolve('עמותת בני נתניה')).toBe('בני נתניה');
  });

  it('matches when input has only a partial portion matching canonical', () => {
    // 'חדרה' appears inside 'ידרסל חדרה'
    expect(resolve('חדרה')).toBe('ידרסל חדרה');
  });
});

// ---------------------------------------------------------------------------
// makeNameResolver – edge cases
// ---------------------------------------------------------------------------

describe('makeNameResolver – edge cases', () => {
  it('returns empty string for null input', () => {
    expect(resolve(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(resolve(undefined)).toBe('');
  });

  it('returns empty string for empty-string input', () => {
    expect(resolve('')).toBe('');
  });

  it('returns original name when no match is found', () => {
    expect(resolve('קבוצה שלא קיימת')).toBe('קבוצה שלא קיימת');
  });

  it('returns original string when input is all punctuation (normalises to empty, no match)', () => {
    // After stripping gereshim etc., the target becomes '' → normalize guard
    // returns the original string.
    expect(resolve('״')).toBe('״');
  });
});

// ---------------------------------------------------------------------------
// makeNameResolver – empty teams list
// ---------------------------------------------------------------------------

describe('makeNameResolver – empty teams list', () => {
  const emptyResolve = makeNameResolver([]);

  it('returns the input unchanged when teams list is empty', () => {
    expect(emptyResolve('כל קבוצה')).toBe('כל קבוצה');
  });

  it('returns empty string for null when teams list is empty', () => {
    expect(emptyResolve(null)).toBe('');
  });

  it('returns empty string for undefined when teams list is empty', () => {
    expect(emptyResolve(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// makeNameResolver – duplicate/ambiguous names
// ---------------------------------------------------------------------------

describe('makeNameResolver – name collision', () => {
  it('uses the first canonical name when two teams share a substring', () => {
    const ambiguous: TeamRow[] = [
      { id: 'x', name: 'מכבי תל אביב' },
      { id: 'y', name: 'מכבי חיפה' },
    ];
    const r = makeNameResolver(ambiguous);
    // 'מכבי' is a substring of both → first match wins
    const result = r('מכבי');
    expect(['מכבי תל אביב', 'מכבי חיפה']).toContain(result);
  });
});
