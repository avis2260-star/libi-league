/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import CupRoundResults from '@/components/CupRoundResults';

const games = [
  { id: 'a', homeTeam: 'גלי בת-ים', awayTeam: 'ראשון גפן לציון', homeScore: 70, awayScore: 72 },
  { id: 'b', homeTeam: 'אופק רחובות', awayTeam: 'אוריה ירושלים', homeScore: 81, awayScore: 64 },
  { id: 'c', homeTeam: 'חולון', awayTeam: 'גוטלמן השרון', homeScore: 59, awayScore: 61 },
];

function setReducedMotion(reduce: boolean) {
  window.matchMedia = jest.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes('reduce'), media: q, addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(), onchange: null, dispatchEvent: jest.fn(),
  }));
}

beforeEach(() => { jest.useFakeTimers(); setReducedMotion(false); });
afterEach(() => jest.useRealTimers());

describe('CupRoundResults (season facts)', () => {
  it('shows the round and its first game, linking to the game page', () => {
    render(<CupRoundResults lang="he" round="שמינית גמר" games={games} />);
    expect(screen.getByText('גביע · שמינית גמר')).toBeInTheDocument();
    expect(screen.getByText('גלי בת-ים').closest('a')).toHaveAttribute('href', '/cup/game/a');
    expect(screen.getByText('משחק 1 מתוך 3')).toBeInTheDocument();
  });

  it('rotates through the games on its own', () => {
    render(<CupRoundResults lang="he" round="שמינית גמר" games={games} />);
    act(() => { jest.advanceTimersByTime(4500); });
    expect(screen.getByText('אופק רחובות')).toBeInTheDocument();
    expect(screen.getByText('משחק 2 מתוך 3')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(9000); });
    expect(screen.getByText('גלי בת-ים')).toBeInTheDocument(); // wrapped around
  });

  it('pauses while hovered and jumps to a game from its dot', () => {
    const { container } = render(<CupRoundResults lang="he" round="שמינית גמר" games={games} />);
    fireEvent.mouseEnter(container.firstChild as Element);
    act(() => { jest.advanceTimersByTime(10000); });
    expect(screen.getByText('משחק 1 מתוך 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'משחק 3' }));
    expect(screen.getByText('חולון')).toBeInTheDocument();
  });

  it('does not rotate for visitors who prefer reduced motion', () => {
    setReducedMotion(true);
    render(<CupRoundResults lang="he" round="שמינית גמר" games={games} />);
    act(() => { jest.advanceTimersByTime(10000); });
    expect(screen.getByText('משחק 1 מתוך 3')).toBeInTheDocument();
  });

  it('shows a single game without dots', () => {
    render(<CupRoundResults lang="en" round="Final" games={[games[0]]} />);
    expect(screen.getByText('Cup · Final')).toBeInTheDocument();
    expect(screen.getByText('Game 1 of 1')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
