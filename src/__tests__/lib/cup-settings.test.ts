import { cupTeamsKey, cupTeamsKeysFor, pickCupTeamIds, LEGACY_CUP_TEAMS_KEY } from '@/lib/cup-settings';

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

  it("does not use another season's own list", () => {
    expect(pickCupTeamIds([{ key: 'cup_tournament_teams:2025-2026', value: '["x"]' }], '2026-2027')).toEqual([]);
  });

  it('returns an empty list for nothing saved or malformed JSON', () => {
    expect(pickCupTeamIds(null, '2026-2027')).toEqual([]);
    expect(pickCupTeamIds([{ key: 'cup_tournament_teams:2026-2027', value: 'not json' }], '2026-2027')).toEqual([]);
    expect(pickCupTeamIds([{ key: 'cup_tournament_teams:2026-2027', value: '[1,"t",null]' }], '2026-2027')).toEqual(['t']);
  });
});
