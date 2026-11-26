/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/app/admin/actions', () => ({
  saveCupSetting: jest.fn().mockResolvedValue({}),
  upsertCupGameStat: jest.fn(),
  saveCupGameQuarters: jest.fn(),
  startCupTournament: jest.fn(),
}));

import CupTab, { type CupGame } from '@/components/admin/CupTab';
import { startCupTournament } from '@/app/admin/actions';

const startMock = startCupTournament as jest.Mock;

const teams = Array.from({ length: 15 }, (_, i) => ({ id: `t${i + 1}`, name: `קבוצה ${i + 1}` }));

function game(over: Partial<CupGame>): CupGame {
  return {
    id: 'g1', round: 'רבע גמר', round_order: 2, game_number: 1,
    home_team: 'TBD', away_team: 'TBD', home_score: null, away_score: null,
    date: null, played: false, home_quarters: null, away_quarters: null,
    video_url: null, location: null, ...over,
  };
}

function renderTab(games: CupGame[], teamIds: string[] = teams.map((t) => t.id)) {
  return render(
    <CupTab season="2026-2027" teamIds={teamIds} teams={teams} games={games} rostersByTeam={{}} cupStats={[]} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('CupTab — start a season tournament', () => {
  it('names the season being edited', () => {
    renderTab([]);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('עונת 2026-2027');
  });

  it('offers to open the tournament when the season has none, suggesting the first round from the teams', () => {
    renderTab([]);
    expect(screen.getByText('🏆 פתח טורניר גביע לעונה 2026-2027')).toBeInTheDocument();
    // 15 teams → round of 16 with 7 games, one team through on a bye
    expect(screen.getByLabelText('סיבוב פתיחה')).toHaveValue('שמינית גמר');
    expect(screen.getByLabelText('משחקים בסיבוב הפתיחה')).toHaveValue(7);
  });

  it('still offers it when the season only has empty TBD slots', () => {
    renderTab([game({})]);
    expect(screen.getByText('🏆 פתח טורניר גביע לעונה 2026-2027')).toBeInTheDocument();
  });

  it('hides it once the season has a real game', () => {
    renderTab([game({ home_team: 'קבוצה 1' })]);
    expect(screen.queryByText(/פתח טורניר גביע/)).not.toBeInTheDocument();
  });

  it('creates the bracket and shows it', async () => {
    startMock.mockResolvedValue({
      games: [
        game({ id: 'a', round: 'שמינית גמר', round_order: 1 }),
        game({ id: 'b', round: 'גמר', round_order: 4 }),
      ],
    });
    renderTab([]);
    await userEvent.click(screen.getByRole('button', { name: '🏆 פתח טורניר' }));

    expect(startMock).toHaveBeenCalledWith({
      season: '2026-2027', firstRound: 'שמינית גמר', firstRoundGames: 7,
      teamIds: teams.map((t) => t.id), date: null,
    });
    await waitFor(() => expect(screen.getByText(/נפתח/)).toBeInTheDocument());
    expect(screen.getByText(/סה״כ 2 משחקים ב-2 סיבובים/)).toBeInTheDocument();
  });

  it('shows the error and keeps the card when the server refuses', async () => {
    startMock.mockResolvedValue({ error: 'לעונת 2026-2027 כבר יש טורניר גביע' });
    renderTab([]);
    await userEvent.click(screen.getByRole('button', { name: '🏆 פתח טורניר' }));
    await waitFor(() => expect(screen.getByText('לעונת 2026-2027 כבר יש טורניר גביע')).toBeInTheDocument());
    expect(screen.getByText('🏆 פתח טורניר גביע לעונה 2026-2027')).toBeInTheDocument();
  });
});

describe('CupTab — game time and postponed games', () => {
  const real = { home_team: 'קבוצה 1', away_team: 'קבוצה 2', date: '2026-11-14' };

  it('shows the time, a postponed badge and the note on the game row', () => {
    renderTab([game({ ...real, game_time: '20:30', delayed: true, delay_note: 'הופסק בגלל מזג האוויר' })]);
    expect(screen.getByText('20:30')).toBeInTheDocument();
    expect(screen.getByText('⏱️ דחוי')).toBeInTheDocument();
    expect(screen.getByText('💬 הופסק בגלל מזג האוויר')).toBeInTheDocument();
  });

  it('hides the note when the game is no longer postponed', () => {
    renderTab([game({ ...real, delayed: false, delay_note: 'ישן' })]);
    expect(screen.queryByText(/ישן/)).not.toBeInTheDocument();
  });

  it('saves the time, postponed flag and a preset note from the edit row', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    renderTab([game({ ...real })]);

    await userEvent.click(screen.getByTitle('ערוך'));
    const time = screen.getByLabelText('שעת המשחק');
    await userEvent.clear(time);
    await userEvent.type(time, '20:30');
    await userEvent.click(screen.getByLabelText(/משחק דחוי/));
    await userEvent.click(screen.getByRole('button', { name: 'הופסק בגלל מזג האוויר' }));
    await userEvent.click(screen.getByRole('button', { name: 'שמור' }));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ id: 'g1', game_time: '20:30', delayed: true, delay_note: 'הופסק בגלל מזג האוויר' });
    await waitFor(() => expect(screen.getByText('💬 הופסק בגלל מזג האוויר')).toBeInTheDocument());
  });
});

describe('CupTab — Excel stats import for a cup game', () => {
  const real = { home_team: 'קבוצה 1', away_team: 'קבוצה 2', home_score: null, away_score: null };
  const rosters = {
    'קבוצה 1': [{ id: 'p1', name: 'יוסי כהן', jersey_number: 7 }],
    'קבוצה 2': [{ id: 'p2', name: 'דני לוי', jersey_number: 9 }],
  };

  function renderWithRosters() {
    return render(
      <CupTab season="2026-2027" teamIds={[]} teams={teams} games={[game({ ...real })]} rostersByTeam={rosters} cupStats={[]} />,
    );
  }

  it('offers the template download and upload in the game stats panel', async () => {
    renderWithRosters();
    await userEvent.click(screen.getByTitle('סטטיסטיקת שחקנים ורבעים'));
    expect(screen.getByText('📊 ייבוא סטטיסטיקה מ-Excel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '⬇️ הורד תבנית' })).toHaveAttribute(
      'href', '/api/admin/cup-stats/template?cupGameId=g1',
    );
  });

  it('uploads the file and shows the imported stats and quarters in place', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: '✅ נשמרו 2 שחקנים · ניקוד רבעים עודכן',
        unmatched: ['זר'],
        stats: [
          { cup_game_id: 'g1', player_id: 'p1', points: 37, three_pointers: 2, fouls: 1 },
          { cup_game_id: 'g1', player_id: 'p2', points: 41, three_pointers: 0, fouls: 4 },
        ],
        game: { ...game({ ...real }), home_quarters: [11, 12, 13, 14], away_quarters: [21, 22, 23, 24] },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    renderWithRosters();
    await userEvent.click(screen.getByTitle('סטטיסטיקת שחקנים ורבעים'));

    const file = new File(['x'], 'scoresheet.xlsx');
    await userEvent.upload(screen.getByLabelText('קובץ סטטיסטיקה'), file);

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/cup-stats/import', expect.objectContaining({ method: 'POST' }));
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get('cupGameId')).toBe('g1');
    expect(await screen.findByText('✅ נשמרו 2 שחקנים · ניקוד רבעים עודכן')).toBeInTheDocument();
    expect(screen.getByText('לא זוהו: זר')).toBeInTheDocument();
    expect(screen.getByDisplayValue('37')).toBeInTheDocument();
    expect(screen.getByDisplayValue('41')).toBeInTheDocument();
    expect(screen.getByDisplayValue('14')).toBeInTheDocument();
    expect(screen.getByDisplayValue('24')).toBeInTheDocument();
  });

  it('shows the error when the import is refused', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'לא זוהה אף שחקן מהקובץ', unmatched: ['א', 'ב'] }),
    }) as unknown as typeof fetch;
    renderWithRosters();
    await userEvent.click(screen.getByTitle('סטטיסטיקת שחקנים ורבעים'));
    await userEvent.upload(screen.getByLabelText('קובץ סטטיסטיקה'), new File(['x'], 'bad.xlsx'));
    expect(await screen.findByText('❌ לא זוהה אף שחקן מהקובץ')).toBeInTheDocument();
    expect(screen.getByText('לא זוהו: א, ב')).toBeInTheDocument();
  });
});

describe('CupTab — round date is only saved on apply', () => {
  it('warns while a picked round date is not saved yet', async () => {
    renderTab([game({ home_team: 'קבוצה 1', away_team: 'קבוצה 2', date: null })]);
    const input = screen.getByDisplayValue('') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'date');
    fireEvent.change(input, { target: { value: '2026-12-05' } });
    expect(screen.getByText(/לא נשמר/)).toBeInTheDocument();
  });

  it('warns when some games in the round still have no date', () => {
    renderTab([
      game({ id: 'g1', game_number: 1, home_team: 'קבוצה 1', away_team: 'קבוצה 2', date: '2026-12-05' }),
      game({ id: 'g2', game_number: 2, home_team: 'קבוצה 3', away_team: 'קבוצה 4', date: null }),
    ]);
    expect(screen.getByText('● 1 משחקים בסיבוב בלי תאריך')).toBeInTheDocument();
  });

  it('shows no warning when every game has the round date', () => {
    renderTab([
      game({ id: 'g1', game_number: 1, home_team: 'קבוצה 1', away_team: 'קבוצה 2', date: '2026-12-05' }),
      game({ id: 'g2', game_number: 2, home_team: 'קבוצה 3', away_team: 'קבוצה 4', date: '2026-12-05' }),
    ]);
    expect(screen.queryByText(/לא נשמר|בלי תאריך/)).not.toBeInTheDocument();
  });
});
