import {
  cupTeamsKey, cupTeamsKeysFor, pickCupTeamIds, LEGACY_CUP_TEAMS_KEY,
  buildCupSkeleton, isPlaceholderTeam, cupGameTime,
} from '@/lib/cup-settings';

describe('cup team list per season', () => {
  it('keys the list by season, loading the old shared key as the fallback', () => {
    expect(cupTeamsKey('2026-2027')).toBe('cup_tournament_teams:2026-2027');
    expect(cupTeamsKeysFor('2026-2027')).toEqual(['cup_tournament_teams:2026-2027', LEGACY_CUP_TEAMS_KEY]);
  });

  it("prefers the season's own list", () => {
    const rows = [
      { key: LEGACY_CUP_TEAMS_KEY, value: '["old1","old2"]' },
      { key: 'cup_tournament_teams:2026-2027', value: '["new1"]' },
    ];
    expect(pickCupTeamIds(rows, '2026-2027')).toEqual(['new1']);
  });

  it('falls back to the list saved before lists were kept per season', () => {
    expect(pickCupTeamIds([{ key: LEGACY_CUP_TEAMS_KEY, value: '["old1"]' }], '2025-2026')).toEqual(['old1']);
  });

  it('gives seasons after the shared-list era an empty list instead of the old one', () => {
    const rows = [{ key: LEGACY_CUP_TEAMS_KEY, value: '["old1"]' }];
    expect(pickCupTeamIds(rows, '2026-2027')).toEqual(['old1']);
    expect(pickCupTeamIds(rows, '2027-2028')).toEqual([]);
  });

  it("does not use another season's own list", () => {
    expect(pickCupTeamIds([{ key: 'cup_tournament_teams:2025-2026', value: '["x"]' }], '2026-2027')).toEqual([]);
  });

  it('returns an empty list for nothing saved or malformed JSON', () => {
    expect(pickCupTeamIds(null, '2026-2027')).toEqual([]);
    expect(pickCupTeamIds([{ key: 'cup_tournament_teams:2026-2027', value: 'not json' }], '2026-2027')).toEqual([]);
    expect(pickCupTeamIds([{ key: 'cup_tournament_teams:2026-2027', value: '[1,"t",null]' }], '2026-2027')).toEqual(['t']);
  });
});

describe('buildCupSkeleton', () => {
  const count = (slots: ReturnType<typeof buildCupSkeleton>) =>
    slots.reduce<Record<string, number>>((m, s) => ({ ...m, [s.round]: (m[s.round] ?? 0) + 1 }), {});

  it('builds every round from the opening round down to the final', () => {
    const slots = buildCupSkeleton('שמינית גמר', 7);
    expect(count(slots)).toEqual({ 'שמינית גמר': 7, 'רבע גמר': 4, 'חצי גמר': 2, 'גמר': 1 });
    expect(slots.filter((s) => s.round === 'רבע גמר').map((s) => s.game_number)).toEqual([1, 2, 3, 4]);
    expect(slots.find((s) => s.round === 'גמר')).toMatchObject({ round_order: 4, game_number: 1 });
  });

  it('starts at a later round when the field is smaller', () => {
    expect(count(buildCupSkeleton('רבע גמר', 4))).toEqual({ 'רבע גמר': 4, 'חצי גמר': 2, 'גמר': 1 });
    const semis = buildCupSkeleton('חצי גמר', 2);
    expect(count(semis)).toEqual({ 'חצי גמר': 2, 'גמר': 1 });
  });

  it("numbers rounds by their fixed place in the cup, like the Excel import", () => {
    const orderOf = (slots: ReturnType<typeof buildCupSkeleton>) =>
      Object.fromEntries(slots.map((s) => [s.round, s.round_order]));
    expect(orderOf(buildCupSkeleton('שמינית גמר', 8))).toEqual({ 'שמינית גמר': 1, 'רבע גמר': 2, 'חצי גמר': 3, 'גמר': 4 });
    expect(orderOf(buildCupSkeleton('רבע גמר', 4))).toEqual({ 'רבע גמר': 2, 'חצי גמר': 3, 'גמר': 4 });
  });

  it('keeps the opening-round game count within the round size', () => {
    expect(count(buildCupSkeleton('רבע גמר', 9))['רבע גמר']).toBe(4);
    expect(count(buildCupSkeleton('רבע גמר', 0))['רבע גמר']).toBe(1);
    expect(count(buildCupSkeleton('רבע גמר', NaN))['רבע גמר']).toBe(4);
  });
});

describe('isPlaceholderTeam', () => {
  it('treats empty and TBD names as an unfilled slot', () => {
    expect(isPlaceholderTeam('TBD')).toBe(true);
    expect(isPlaceholderTeam(' tbd ')).toBe(true);
    expect(isPlaceholderTeam('')).toBe(true);
    expect(isPlaceholderTeam(null)).toBe(true);
    expect(isPlaceholderTeam('בני מוצקין')).toBe(false);
  });
});

describe('cupGameTime', () => {
  it('reads HH:MM and HH:MM:SS as HH:MM', () => {
    expect(cupGameTime('20:30')).toBe('20:30');
    expect(cupGameTime('8:05')).toBe('08:05');
    expect(cupGameTime('20:30:00')).toBe('20:30');
  });

  it('returns null for nothing or a non-time', () => {
    expect(cupGameTime(null)).toBeNull();
    expect(cupGameTime('')).toBeNull();
    expect(cupGameTime('TBD')).toBeNull();
    expect(cupGameTime('24:00')).toBeNull();
  });
});
