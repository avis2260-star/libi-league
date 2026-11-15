import { latestCupRoundResults, type CupResultGame } from '@/lib/cup-round-results';

let n = 0;
const g = (round: string, order: number, num: number, home: string, away: string, hs: number | null, as: number | null): CupResultGame => ({
  id: `g${++n}`, round, round_order: order, game_number: num, home_team: home, away_team: away, home_score: hs, away_score: as,
});

describe('latestCupRoundResults', () => {
  it('returns nothing until a game has a result', () => {
    expect(latestCupRoundResults([])).toBeNull();
    expect(latestCupRoundResults([g('שמינית גמר', 1, 1, 'א', 'ב', null, null)])).toBeNull();
  });

  it("lists the first round's scored games in bracket order", () => {
    const res = latestCupRoundResults([
      g('שמינית גמר', 1, 2, 'ג', 'ד', 60, 58),
      g('שמינית גמר', 1, 1, 'א', 'ב', 70, 72),
      g('שמינית גמר', 1, 3, 'ה', 'ו', null, null), // not played yet
      g('רבע גמר', 2, 1, 'TBD', 'TBD', null, null),
    ]);
    expect(res?.round).toBe('שמינית גמר');
    expect(res?.games.map((x) => [x.home_team, x.home_score, x.away_score])).toEqual([['א', 70, 72], ['ג', 60, 58]]);
  });

  it('moves on to a later round once it has results', () => {
    const res = latestCupRoundResults([
      g('שמינית גמר', 1, 1, 'א', 'ב', 70, 72),
      g('רבע גמר', 2, 1, 'ב', 'ג', 80, 75),
    ]);
    expect(res?.round).toBe('רבע גמר');
    expect(res?.games).toHaveLength(1);
  });

  it('uses a derived score for a game entered only as stats, but never over a typed one', () => {
    const typed = g('שמינית גמר', 1, 1, 'א', 'ב', 70, 72);
    const statsOnly = g('שמינית גמר', 1, 2, 'ג', 'ד', null, null);
    const res = latestCupRoundResults([typed, statsOnly], new Map([
      [typed.id, { home: 1, away: 2 }],
      [statsOnly.id, { home: 55, away: 50 }],
    ]));
    expect(res?.games.map((x) => [x.home_score, x.away_score])).toEqual([[70, 72], [55, 50]]);
  });

  it('ignores undrawn TBD slots even with a score', () => {
    expect(latestCupRoundResults([g('רבע גמר', 2, 1, 'TBD', 'TBD', 0, 0)])).toBeNull();
  });
});
