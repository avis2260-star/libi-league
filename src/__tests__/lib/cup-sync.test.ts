import { planCupSync, type SeasonCupGame, type OtherSeasonCupGame } from '@/lib/cup-sync';
import type { CupGameRow } from '@/lib/excel-sync-parsers';

const order: Record<string, number> = { 'שמינית גמר': 1, 'רבע גמר': 2, 'חצי גמר': 3, 'גמר': 4 };

function sheet(round: string, home: string, away: string, hs: number | null = null, as: number | null = null): CupGameRow {
  return {
    round, round_order: order[round], game_number: 1, home_team: home, away_team: away,
    home_score: hs, away_score: as, date: '05.12', played: hs !== null && as !== null,
  };
}

let nextId = 0;
function slot(round: string, game_number: number, over: Partial<SeasonCupGame> = {}): SeasonCupGame {
  return {
    id: `s${++nextId}`, round, game_number, home_team: 'TBD', away_team: 'TBD',
    home_score: null, away_score: null, played: false, ...over,
  };
}

function last(round: string, home: string, away: string, hs: number, as: number): OtherSeasonCupGame {
  return { round, home_team: home, away_team: away, home_score: hs, away_score: as };
}

describe('planCupSync', () => {
  it('inserts the sheet games into an empty season, numbered within each round', () => {
    const plan = planCupSync(
      [sheet('רבע גמר', 'א', 'ב'), sheet('רבע גמר', 'ג', 'ד'), sheet('גמר', 'א', 'ג')],
      [], [],
    );
    expect(plan.fill).toEqual([]);
    expect(plan.insert.map((g) => [g.round, g.game_number])).toEqual([['רבע גמר', 1], ['רבע גמר', 2], ['גמר', 1]]);
    expect(plan.staleSkipped).toBe(0);
  });

  it("fills the empty TBD slots of a tournament the admin opened instead of doubling the bracket", () => {
    const qf1 = slot('רבע גמר', 1);
    const qf2 = slot('רבע גמר', 2);
    const fin = slot('גמר', 1);
    const plan = planCupSync(
      [sheet('רבע גמר', 'א', 'ב', 70, 60), sheet('רבע גמר', 'ג', 'ד'), sheet('גמר', 'א', 'ג')],
      [qf1, qf2, slot('חצי גמר', 1), fin],
      [],
    );
    expect(plan.insert).toEqual([]);
    expect(plan.fill.map((f) => [f.id, f.game.home_team, f.game.game_number])).toEqual([
      [qf1.id, 'א', 1],
      [qf2.id, 'ג', 2],
      [fin.id, 'א', 1], // the empty final slot is filled, not treated as "a final exists"
    ]);
    expect(plan.fill[0].game).toMatchObject({ home_score: 70, away_score: 60, played: true });
  });

  it('inserts past the slots once a round has no empty one left', () => {
    const plan = planCupSync(
      [sheet('רבע גמר', 'א', 'ב'), sheet('רבע גמר', 'ג', 'ד')],
      [slot('רבע גמר', 1), slot('רבע גמר', 2, { home_team: 'ה', away_team: 'ו' })],
      [],
    );
    expect(plan.fill).toHaveLength(1);
    expect(plan.insert.map((g) => g.game_number)).toEqual([3]);
  });

  it("does not bring last season's results into the new season", () => {
    const plan = planCupSync(
      [
        sheet('רבע גמר', 'א', 'ב', 70, 60), // last year's result, same teams and score
        sheet('רבע גמר', 'ב', 'א', 60, 70), // the same game with home/away swapped
        sheet('רבע גמר', 'ג', 'ד', 80, 75), // a real new game
      ],
      [],
      [last('רבע גמר', 'א', 'ב', 70, 60)],
    );
    expect(plan.staleSkipped).toBe(2);
    expect(plan.insert.map((g) => g.home_team)).toEqual(['ג']);
  });

  it('still adds a rematch of last season when it is a new game', () => {
    const plan = planCupSync(
      [
        sheet('רבע גמר', 'א', 'ב'),         // not played yet
        sheet('חצי גמר', 'א', 'ב', 70, 60), // same score, different round
        sheet('גמר', 'א', 'ב', 71, 60),      // same round, different score
      ],
      [],
      [last('חצי גמר', 'א', 'ב', 71, 60), last('רבע גמר', 'א', 'ב', 70, 60), last('גמר', 'א', 'ב', 70, 60)],
    );
    expect(plan.staleSkipped).toBe(0);
  });

  it('leaves games the season already has untouched', () => {
    const plan = planCupSync(
      [sheet('רבע גמר', 'א', 'ב', 99, 1)],
      [slot('רבע גמר', 1, { home_team: 'ב', away_team: 'א' }), slot('רבע גמר', 2)],
      [],
    );
    expect(plan).toEqual({ insert: [], fill: [], staleSkipped: 0 });
  });

  it('never adds a second final when the season has a real one', () => {
    const plan = planCupSync(
      [sheet('גמר', 'ג', 'ד')],
      [slot('גמר', 1, { home_team: 'א', away_team: 'ב' })],
      [],
    );
    expect(plan.insert).toEqual([]);
    expect(plan.fill).toEqual([]);
  });

  it('ignores TBD rows in the sheet', () => {
    const plan = planCupSync([sheet('גמר', 'TBD', 'TBD')], [slot('גמר', 1)], []);
    expect(plan).toEqual({ insert: [], fill: [], staleSkipped: 0 });
  });
});
