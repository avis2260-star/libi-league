/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

jest.mock('@/components/TranslationProvider', () => ({
  useLang: () => ({ t: (s: string) => s, lang: 'he' }),
}));

import JourneyBracket from '@/components/cup/JourneyBracket';

type G = Parameters<typeof JourneyBracket>[0]['games'][number];
const slot = (id: string, round: string, order: number, n: number, over: Partial<G> = {}): G => ({
  id, round, round_order: order, game_number: n, home_team: 'TBD', away_team: 'TBD',
  home_score: null, away_score: null, date: '', played: false, location: null, ...over,
});

const bracket = (finalOver: Partial<G> = {}): G[] => [
  ...[1, 2, 3, 4].map((n) => slot(`q${n}`, 'רבע גמר', 2, n)),
  slot('s1', 'חצי גמר', 3, 1), slot('s2', 'חצי גמר', 3, 2),
  slot('f', 'גמר', 4, 1, finalOver),
];

describe('JourneyBracket — the cup holder beside the final', () => {
  it('puts the holder card next to the final on wide screens, keeping the banner below for narrow ones', () => {
    render(<JourneyBracket games={bracket()} teamLogos={{}} season="2026-2027" />);
    const side = screen.getByTestId('champion-side');
    expect(side).toHaveClass('hidden', 'min-[1280px]:flex');
    expect(within(side).getByText('🏆 מחזיקת הגביע')).toBeInTheDocument();
    expect(within(side).getByText('2026-2027')).toBeInTheDocument();
    expect(within(side).getByText('טרם נקבע — ממתין לגמר')).toBeInTheDocument();
    expect(screen.getByTestId('champion-below')).toHaveClass('min-[1280px]:hidden');
  });

  it('shows the winner of the final, labelled with the season (not a fixed year)', () => {
    render(
      <JourneyBracket
        teamLogos={{}}
        season="2026-2027"
        games={bracket({ home_team: 'ראשון גפן לציון', away_team: 'ידרסל חדרה', home_score: 81, away_score: 77, played: true })}
      />,
    );
    expect(within(screen.getByTestId('champion-side')).getByText('ראשון גפן לציון')).toBeInTheDocument();
    expect(within(screen.getByTestId('champion-below')).getByText('מחזיקת הגביע 2026-2027')).toBeInTheDocument();
    expect(screen.queryByText(/2025–2026/)).not.toBeInTheDocument();
  });

  it('keeps the holder below the bracket when a bigger cup leaves no room beside the final', () => {
    const big: G[] = [
      ...Array.from({ length: 16 }, (_, i) => slot(`a${i}`, 'סיבוב ראשון', 0, i + 1)),
      ...bracket(),
      ...Array.from({ length: 8 }, (_, i) => slot(`r${i}`, 'שמינית גמר', 1, i + 1)),
    ];
    render(<JourneyBracket games={big} teamLogos={{}} season="2026-2027" />);
    expect(screen.queryByTestId('champion-side')).not.toBeInTheDocument();
    expect(screen.getByTestId('champion-below')).not.toHaveClass('min-[1280px]:hidden');
  });
});
