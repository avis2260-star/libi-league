/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeasonSchedulePanel from '@/components/admin/SeasonSchedulePanel';
import type { ScheduleEntry } from '@/lib/libi-schedule';

const schedule: ScheduleEntry[] = [
  { round: 2, date: '2026-10-31', homeTeam: 'גלי בת-ים', awayTeam: 'חולון', division: 'North' },
  { round: 1, date: '2026-10-24', homeTeam: 'חולון', awayTeam: 'בני נתניה', division: 'North', time: '20:30:00' },
  { round: 1, date: '2026-10-24', homeTeam: 'אופק רחובות', awayTeam: 'קריית מלאכי', division: 'South' },
];

describe('SeasonSchedulePanel', () => {
  it('lists every round, ascending, with the dates of both divisions', () => {
    render(<SeasonSchedulePanel season="2026-2027" schedule={schedule} />);

    expect(screen.getByText('📅 תאריכי המשחקים · עונת 2026-2027')).toBeInTheDocument();
    expect(screen.getByText(/2 מחזורים · 3 משחקים/)).toBeInTheDocument();

    const summaries = screen.getAllByText(/^מחזור \d+$/);
    expect(summaries.map((s) => s.textContent)).toEqual(['מחזור 1', 'מחזור 2']);

    const round1 = summaries[0].closest('summary')!;
    expect(within(round1).getByText('צפון: 24.10.2026 (שבת)')).toBeInTheDocument();
    expect(within(round1).getByText('דרום: 24.10.2026 (שבת)')).toBeInTheDocument();

    const round2 = summaries[1].closest('summary')!;
    expect(within(round2).getByText('דרום: אין משחקים')).toBeInTheDocument();
  });

  it("shows each division's fixtures inside the round", () => {
    render(<SeasonSchedulePanel season="2026-2027" schedule={schedule} />);
    const round1 = screen.getByText('מחזור 1').closest('details')!;
    expect(within(round1).getByText('מחוז צפון · 1 משחקים')).toBeInTheDocument();
    expect(within(round1).getByText('מחוז דרום · 1 משחקים')).toBeInTheDocument();
    expect(within(round1).getByText('20:30')).toBeInTheDocument();
  });

  it('explains an empty season and disables the export', () => {
    render(<SeasonSchedulePanel season="2026-2027" schedule={[]} />);
    expect(screen.getByText(/עדיין אין לוח משחקים לעונה זו/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📥 ייצוא ל-Excel' })).toBeDisabled();
  });

  describe('export', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('downloads the workbook for the season', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });
      URL.createObjectURL = jest.fn().mockReturnValue('blob:schedule');
      URL.revokeObjectURL = jest.fn();
      const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      render(<SeasonSchedulePanel season="2026-2027" schedule={schedule} />);
      await user.click(screen.getByRole('button', { name: '📥 ייצוא ל-Excel' }));

      await waitFor(() => expect(click).toHaveBeenCalled());
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/export-schedule?season=2026-2027');
      expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe('לוח משחקים 2026-2027.xlsx');
      click.mockRestore();
    });

    it('shows the server error when the export fails', async () => {
      const user = userEvent.setup();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'אין לוח משחקים לעונת 2026-2027' }),
      });

      render(<SeasonSchedulePanel season="2026-2027" schedule={schedule} />);
      await user.click(screen.getByRole('button', { name: '📥 ייצוא ל-Excel' }));

      expect(await screen.findByText('אין לוח משחקים לעונת 2026-2027')).toBeInTheDocument();
    });
  });
});
