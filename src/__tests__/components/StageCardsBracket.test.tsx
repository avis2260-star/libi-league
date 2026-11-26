/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/TranslationProvider', () => ({
  useLang: () => ({ t: (s: string) => s, lang: 'he' }),
}));

import StageCardsBracket from '@/components/cup/StageCardsBracket';

const base = {
  round: 'שמינית גמר', round_order: 1, home_score: null, away_score: null,
  date: '14.11', played: false, location: null,
};

describe('StageCardsBracket — time and postponed games', () => {
  it("shows a game's time and the postponed note", () => {
    render(
      <StageCardsBracket
        teamLogos={{}}
        games={[
          { ...base, id: 'a', game_number: 1, home_team: 'גלי בת-ים', away_team: 'ראשון גפן לציון', game_time: '20:30' },
          {
            ...base, id: 'b', game_number: 2, home_team: 'חולון', away_team: 'גוטלמן השרון',
            delayed: true, delay_note: 'הופסק בגלל מזג האוויר',
          },
        ]}
      />,
    );
    expect(screen.getByText('⏰ 20:30')).toBeInTheDocument();
    expect(screen.getByText('⏱️ נדחה')).toBeInTheDocument();
    expect(screen.getByText('· הופסק בגלל מזג האוויר')).toBeInTheDocument();
  });

  it('shows nothing extra for a game with no time and not postponed', () => {
    render(
      <StageCardsBracket
        teamLogos={{}}
        games={[{ ...base, id: 'a', game_number: 1, home_team: 'א', away_team: 'ב' }]}
      />,
    );
    expect(screen.queryByText(/⏰|⏱️/)).not.toBeInTheDocument();
  });
});

describe('StageCardsBracket — round dates', () => {
  it("dates a round from any of its games and formats it", () => {
    render(
      <StageCardsBracket
        teamLogos={{}}
        season="2026-2027"
        games={[
          { ...base, id: 'q1', round: 'רבע גמר', round_order: 2, game_number: 1, home_team: 'TBD', away_team: 'TBD', date: '' },
          { ...base, id: 'q2', round: 'רבע גמר', round_order: 2, game_number: 2, home_team: 'TBD', away_team: 'TBD', date: '2026-12-05', game_time: '20:30' },
          { ...base, id: 's1', round: 'חצי גמר', round_order: 3, game_number: 1, home_team: 'TBD', away_team: 'TBD', date: '' },
        ]}
      />,
    );
    expect(screen.getByText('📅 שבת 05.12 · 20:30')).toBeInTheDocument();
    expect(screen.getByText('תאריך טרם נקבע')).toBeInTheDocument(); // the semi-final has none
  });
});
