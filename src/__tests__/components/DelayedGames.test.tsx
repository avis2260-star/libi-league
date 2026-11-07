/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/TranslationProvider', () => ({
  useLang: () => ({ t: (s: string) => s, lang: 'he' }),
}));

import DelayedGames, { type DelayedPendingCard, type DelayedFinishedCard } from '@/components/DelayedGames';

const pending: DelayedPendingCard = {
  round: 4, homeTeam: 'שועלי אדיס אשדוד', awayTeam: 'אופק רחובות', homeLogo: null, awayLogo: null,
  dateLabel: '05.12', dayLabel: 'שבת', time: null, location: null,
  note: 'הופסק בגלל מזג האוויר', href: '/games/4/x',
};
const finished: DelayedFinishedCard = {
  round: 3, homeTeam: 'א', awayTeam: 'ב', homeLogo: null, awayLogo: null,
  homeScore: 70, awayScore: 60, dateLabel: '01.12', note: 'הושלם לאחר הפסקה', href: '/games/3/a',
};

describe('DelayedGames', () => {
  it("shows the admin's note on postponed and make-up cards", () => {
    render(<DelayedGames pending={[pending]} finished={[finished]} />);
    expect(screen.getByText('💬 הופסק בגלל מזג האוויר')).toBeInTheDocument();
    expect(screen.getByText('💬 הושלם לאחר הפסקה')).toBeInTheDocument();
  });

  it('shows no note line when there is none', () => {
    render(<DelayedGames pending={[{ ...pending, note: null }]} finished={[]} />);
    expect(screen.queryByText(/💬/)).not.toBeInTheDocument();
  });
});
