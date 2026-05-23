import { normalizeName, findPlayerForExtracted, PlayerRow } from '@/lib/match-player';

// ---------------------------------------------------------------------------
// Helpers – minimal Supabase query-builder mock
//
// findPlayerForExtracted accepts a SupabaseClient parameter, so we don't need
// to mock any module. We create a lightweight "thenable builder" that both:
//   • resolves via .maybeSingle() (for exact/jersey/global queries), and
//   • resolves when awaited directly (for the roster list query).
// ---------------------------------------------------------------------------

type BuilderResponse = { data: PlayerRow | PlayerRow[] | null };

function makeBuilder(response: BuilderResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    ilike: () => builder,
    // Terminal: .maybeSingle() — returns a single row or null
    maybeSingle: () => Promise.resolve(response),
    // Thenable protocol — makes `await builder` work for the roster query
    // (which is awaited without .maybeSingle())
    then: (onFulfilled: (v: BuilderResponse) => unknown, onRejected: (e: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
  };
  return builder;
}

/**
 * Create a mock Supabase client whose `from()` returns builders in order.
 *
 * Call sequence inside findPlayerForExtracted (when teamId present, jersey present):
 *   1st from() → team-exact  (ilike → maybeSingle)
 *   2nd from() → team-jersey (eq jersey → maybeSingle)
 *   3rd from() → team-roster (eq team_id → awaited directly)
 *   4th from() → global-exact (ilike → maybeSingle)
 *
 * When jersey is absent, team-jersey is skipped so indices shift by -1.
 * When teamId is absent, only the global-exact call is made.
 */
function createMockClient(builders: ReturnType<typeof makeBuilder>[]) {
  let i = 0;
  return {
    from: jest.fn(() => builders[i++] ?? makeBuilder({ data: null })),
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAYER_A: PlayerRow = { id: 'pa', team_id: 'team-1', name: 'יוסי כהן', jersey_number: 7 };
const PLAYER_B: PlayerRow = { id: 'pb', team_id: 'team-1', name: 'דוד לוי', jersey_number: 23 };
const PLAYER_C: PlayerRow = { id: 'pc', team_id: 'team-2', name: 'מוישה גרינברג', jersey_number: 5 };

// ---------------------------------------------------------------------------
// normalizeName
// ---------------------------------------------------------------------------

describe('normalizeName', () => {
  it('converts to lowercase', () => {
    expect(normalizeName('HELLO')).toBe('hello');
  });

  it('strips Hebrew single geresh (׳)', () => {
    expect(normalizeName("יוסי׳")).toBe('יוסי');
  });

  it('strips Hebrew double-geresh (״)', () => {
    expect(normalizeName('יוסי״ כהן')).toBe('יוסי כהן');
  });

  it('strips straight double-quotes', () => {
    expect(normalizeName('"יוסי"')).toBe('יוסי');
  });

  it('does NOT strip curly double-quotes (not in the regex – documents current behaviour)', () => {
    // normalizeName only strips the ASCII double-quote (U+0022), not the curly
    // variants (U+201C / U+201D). This test locks in that behaviour so any
    // future change to the regex is a deliberate, visible decision.
    const result = normalizeName('“יוסי”'); // “ and “
    expect(result).toBe('“יוסי”');
  });

  it('strips backticks', () => {
    expect(normalizeName('`יוסי`')).toBe('יוסי');
  });

  it('strips dots', () => {
    expect(normalizeName('י.כ.')).toBe('יכ');
  });

  it('strips hyphens (concatenates surrounding text)', () => {
    // Hyphens are removed without inserting a space
    expect(normalizeName('יוסי-כהן')).toBe('יוסיכהן');
  });

  it('strips underscores', () => {
    expect(normalizeName('יוסי_כהן')).toBe('יוסיכהן');
  });

  it('collapses multiple spaces into one', () => {
    expect(normalizeName('יוסי   כהן')).toBe('יוסי כהן');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeName('  יוסי כהן  ')).toBe('יוסי כהן');
  });

  it('handles empty string', () => {
    expect(normalizeName('')).toBe('');
  });

  it('handles a string of only stripped characters', () => {
    expect(normalizeName('.')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// findPlayerForExtracted – early returns (no DB calls)
// ---------------------------------------------------------------------------

describe('findPlayerForExtracted – early returns', () => {
  it('returns no-match for an empty name', async () => {
    const client = createMockClient([]);
    const result = await findPlayerForExtracted(client as never, { name: '' }, 'team-1');
    expect(result).toEqual({ player: null, via: 'no-match' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('returns no-match for a whitespace-only name', async () => {
    const client = createMockClient([]);
    const result = await findPlayerForExtracted(client as never, { name: '   ' }, 'team-1');
    expect(result).toEqual({ player: null, via: 'no-match' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('returns no-match for the sentinel "?" value', async () => {
    const client = createMockClient([]);
    const result = await findPlayerForExtracted(client as never, { name: '?' }, 'team-1');
    expect(result).toEqual({ player: null, via: 'no-match' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('returns no-match when name is null/undefined', async () => {
    const client = createMockClient([]);
    const result = await findPlayerForExtracted(client as never, { name: null }, 'team-1');
    expect(result).toEqual({ player: null, via: 'no-match' });
  });
});

// ---------------------------------------------------------------------------
// findPlayerForExtracted – team-scoped matching strategies
// ---------------------------------------------------------------------------

describe('findPlayerForExtracted – team-exact match', () => {
  it('returns the player via "team-exact" when the DB ilike query succeeds', async () => {
    // Sequence: team-exact succeeds → no further calls
    const client = createMockClient([
      makeBuilder({ data: PLAYER_A }), // team-exact
    ]);

    const result = await findPlayerForExtracted(
      client as never,
      { name: 'יוסי כהן' },
      'team-1',
    );

    expect(result).toEqual({ player: PLAYER_A, via: 'team-exact' });
    expect(client.from).toHaveBeenCalledTimes(1);
  });
});

describe('findPlayerForExtracted – team-jersey match', () => {
  it('returns the player via "team-jersey" when exact fails but jersey matches', async () => {
    // Sequence: team-exact null → team-jersey succeeds
    const client = createMockClient([
      makeBuilder({ data: null }),     // team-exact → miss
      makeBuilder({ data: PLAYER_A }), // team-jersey → hit (jersey #7)
    ]);

    const result = await findPlayerForExtracted(
      client as never,
      { name: 'unknown name', jersey: 7 },
      'team-1',
    );

    expect(result).toEqual({ player: PLAYER_A, via: 'team-jersey' });
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it('skips the jersey query when jersey is absent', async () => {
    // With no jersey, we go straight from team-exact to team-roster
    const client = createMockClient([
      makeBuilder({ data: null }),              // team-exact → miss
      makeBuilder({ data: [PLAYER_A, PLAYER_B] }), // team-roster (no jersey query)
    ]);

    // The name matches PLAYER_A after normalization
    const result = await findPlayerForExtracted(
      client as never,
      { name: 'יוסי כהן' }, // no jersey field
      'team-1',
    );

    expect(result.via).toBe('team-normalized');
    expect(client.from).toHaveBeenCalledTimes(2);
  });
});

describe('findPlayerForExtracted – team-normalized match', () => {
  it('returns the player via "team-normalized" when name matches after normalization', async () => {
    // Exact fails (geresh in the extracted name). Roster is fetched and the
    // normalized comparison succeeds.
    const client = createMockClient([
      makeBuilder({ data: null }),                  // team-exact → miss (geresh)
      makeBuilder({ data: [PLAYER_A, PLAYER_B] }),  // team-roster
    ]);

    // 'יוסי׳ כהן' normalizes to 'יוסי כהן', matching PLAYER_A.name
    const result = await findPlayerForExtracted(
      client as never,
      { name: 'יוסי׳ כהן' },
      'team-1',
    );

    expect(result).toEqual({ player: PLAYER_A, via: 'team-normalized' });
  });

  it('returns the player via "team-substring" when only a partial name is given', async () => {
    // OCR sometimes captures only the last name. 'כהן' is a substring of
    // normalizeName('יוסי כהן') = 'יוסי כהן', so substring match fires.
    const client = createMockClient([
      makeBuilder({ data: null }),                  // team-exact → miss
      makeBuilder({ data: [PLAYER_A, PLAYER_B] }),  // team-roster
    ]);

    const result = await findPlayerForExtracted(
      client as never,
      { name: 'כהן' }, // last-name only
      'team-1',
    );

    expect(result).toEqual({ player: PLAYER_A, via: 'team-substring' });
  });

  it('returns no-match when the roster is empty', async () => {
    const client = createMockClient([
      makeBuilder({ data: null }),  // team-exact → miss
      makeBuilder({ data: [] }),    // team-roster → empty
      makeBuilder({ data: null }),  // global-exact → miss
    ]);

    const result = await findPlayerForExtracted(
      client as never,
      { name: 'שחקן לא קיים' },
      'team-1',
    );

    expect(result).toEqual({ player: null, via: 'no-match' });
  });
});

// ---------------------------------------------------------------------------
// findPlayerForExtracted – global fallback
// ---------------------------------------------------------------------------

describe('findPlayerForExtracted – global exact fallback', () => {
  it('returns the player via "exact" when all team queries fail', async () => {
    // Sequence: team-exact null → team-roster empty → global-exact hit
    const client = createMockClient([
      makeBuilder({ data: null }),     // team-exact → miss
      makeBuilder({ data: [] }),       // team-roster → empty
      makeBuilder({ data: PLAYER_C }), // global-exact → hit
    ]);

    const result = await findPlayerForExtracted(
      client as never,
      { name: 'מוישה גרינברג' },
      'team-1',
    );

    expect(result).toEqual({ player: PLAYER_C, via: 'exact' });
  });

  it('returns the player via "exact" when teamId is null (skips all team queries)', async () => {
    // No teamId → only global query is attempted
    const client = createMockClient([
      makeBuilder({ data: PLAYER_C }), // global-exact
    ]);

    const result = await findPlayerForExtracted(
      client as never,
      { name: 'מוישה גרינברג' },
      null, // no team
    );

    expect(result).toEqual({ player: PLAYER_C, via: 'exact' });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it('returns no-match when teamId is null and global query also misses', async () => {
    const client = createMockClient([
      makeBuilder({ data: null }), // global-exact → miss
    ]);

    const result = await findPlayerForExtracted(
      client as never,
      { name: 'שם שלא קיים' },
      null,
    );

    expect(result).toEqual({ player: null, via: 'no-match' });
  });
});
