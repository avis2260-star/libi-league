/**
 * Tests for src/app/admin/actions.ts — the admin server-action layer that
 * drives game management, the submission-approval workflow, season lifecycle,
 * settings, and contact-message handling.
 *
 * Mocking strategy:
 *   - supabaseAdmin.from() → chainable queryResult() builder
 *   - next/cache.revalidatePath → no-op spy
 *   - current-season → fixed season + cache-clear spy
 *   - match-player.findPlayerForExtracted → controllable per test
 */

jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/current-season', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue('2024-2025'),
  clearCurrentSeasonCache: jest.fn(),
}));
jest.mock('@/lib/match-player', () => ({
  findPlayerForExtracted: jest.fn().mockResolvedValue({ player: null, via: 'no-match' }),
}));

import { supabaseAdmin } from '@/lib/supabase-admin';
import { clearCurrentSeasonCache } from '@/lib/current-season';
import { findPlayerForExtracted } from '@/lib/match-player';
import { queryResult } from '../helpers/supabase-mock';
import {
  updateGameScore,
  updateGameDetails,
  resetAllGameDetails,
  resetSeason,
  startNewSeason,
  updateVideoUrl,
  submitGameResult,
  approveSubmission,
  rejectSubmission,
  clearSubmission,
  changeSubmissionStatus,
  upsertPlayerGameStat,
  saveTickerSpeed,
  saveTermsSetting,
  saveAccessibilitySetting,
  saveCupSetting,
  saveAboutSetting,
  markMessageRead,
  setMessageHandled,
  deleteMessage,
  saveBoxScore,
  bulkImportGames,
} from '@/app/admin/actions';

const fromMock = supabaseAdmin.from as jest.Mock;
const findPlayerMock = findPlayerForExtracted as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockReturnValue(queryResult({ data: [], error: null }));
  findPlayerMock.mockResolvedValue({ player: null, via: 'no-match' });
});

// ===========================================================================
// updateGameScore
// ===========================================================================

describe('updateGameScore', () => {
  it('rejects a negative home score without touching the DB', async () => {
    const res = await updateGameScore('g1', -1, 50, 'Finished');
    expect(res).toEqual({ error: 'Scores cannot be negative.' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects a negative away score', async () => {
    const res = await updateGameScore('g1', 50, -5, 'Finished');
    expect(res).toEqual({ error: 'Scores cannot be negative.' });
  });

  it('updates scores and returns an empty result on success', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await updateGameScore('g1', 80, 70, 'Finished');
    expect(res).toEqual({});
  });

  it('returns the DB error message on failure', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'update failed' } }));
    const res = await updateGameScore('g1', 80, 70, 'Finished');
    expect(res).toEqual({ error: 'update failed' });
  });
});

// ===========================================================================
// updateGameDetails
// ===========================================================================

describe('updateGameDetails', () => {
  it('updates time and location and returns empty on success', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await updateGameDetails('g1', '20:00', 'Arena');
    expect(res).toEqual({});
  });

  it('returns the DB error message on failure', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'nope' } }));
    const res = await updateGameDetails('g1', '20:00', 'Arena');
    expect(res).toEqual({ error: 'nope' });
  });
});

// ===========================================================================
// resetAllGameDetails
// ===========================================================================

describe('resetAllGameDetails', () => {
  it('returns empty on success', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await resetAllGameDetails()).toEqual({});
  });

  it('propagates a DB error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'reset failed' } }));
    expect(await resetAllGameDetails()).toEqual({ error: 'reset failed' });
  });
});

// ===========================================================================
// resetSeason
// ===========================================================================

describe('resetSeason', () => {
  const noop = { resetGames: false, resetPlayerStats: false, resetStandings: false, resetPlayoff: false };

  it('does nothing and returns an empty done list when all flags are false', async () => {
    const res = await resetSeason(noop);
    expect(res.done).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('resets only the selected sections', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await resetSeason({ ...noop, resetGames: true, resetStandings: true });
    expect(res.done).toContain('משחקים אופסו');
    expect(res.done).toContain('טבלת הליגה אופסה');
    expect(res.done).not.toContain('סטטיסטיקת שחקנים אופסה');
  });

  it('runs both playoff deletes when resetPlayoff is set', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    const res = await resetSeason({ ...noop, resetPlayoff: true });
    expect(res.done).toContain('פלייאוף נמחק');
  });

  it('aborts with an error if a section fails, keeping prior done entries', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ error: null }))                          // games ok
      .mockReturnValueOnce(queryResult({ error: { message: 'players boom' } }));  // player stats fail
    const res = await resetSeason({ ...noop, resetGames: true, resetPlayerStats: true });
    expect(res.error).toContain('players boom');
    expect(res.done).toEqual(['משחקים אופסו']);
  });
});

// ===========================================================================
// startNewSeason
// ===========================================================================

describe('startNewSeason', () => {
  it('rejects a malformed season string', async () => {
    const res = await startNewSeason('2026');
    expect(res.error).toContain('פורמט');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects when the new season equals the current one', async () => {
    const res = await startNewSeason('2024-2025'); // mock current is 2024-2025
    expect(res.error).toContain('כבר מסומנת');
  });

  it('bumps the season, clears the cache, and returns prev/current', async () => {
    fromMock.mockReturnValue(queryResult({ data: [], error: null }));
    const res = await startNewSeason('2026-2027');
    expect(res).toMatchObject({ previous: '2024-2025', current: '2026-2027' });
    expect(clearCurrentSeasonCache).toHaveBeenCalled();
  });

  it('returns the DB error when the settings upsert fails', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'upsert failed' } }));
    const res = await startNewSeason('2026-2027');
    expect(res).toEqual({ error: 'upsert failed' });
  });
});

// ===========================================================================
// updateVideoUrl
// ===========================================================================

describe('updateVideoUrl', () => {
  it('rejects a non-http(s) URL', async () => {
    const res = await updateVideoUrl('g1', 'ftp://x');
    expect(res.error).toContain('valid URL');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('accepts an empty string (clears the video) and succeeds', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await updateVideoUrl('g1', '')).toEqual({});
  });

  it('accepts a valid https URL', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await updateVideoUrl('g1', 'https://youtu.be/abc')).toEqual({});
  });

  it('propagates a DB error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'bad' } }));
    expect(await updateVideoUrl('g1', 'https://x.com')).toEqual({ error: 'bad' });
  });
});

// ===========================================================================
// submitGameResult
// ===========================================================================

describe('submitGameResult', () => {
  const input = {
    gameId: 'g1', submittedBy: 'ref', homeScore: 80, awayScore: 70,
    extractedStats: {}, confidenceScore: 9,
    qualityStatus: 'pass' as const, status: 'pending' as const,
  };

  it('blocks a second submission when one is already active', async () => {
    fromMock.mockReturnValue(queryResult({ data: [{ id: 'existing' }], error: null }));
    const res = await submitGameResult(input);
    expect(res.error).toContain('כבר הוגש');
  });

  it('inserts a new submission when none is active', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: [], error: null }))  // lock check → none
      .mockReturnValueOnce(queryResult({ error: null }));           // insert
    const res = await submitGameResult(input);
    expect(res).toEqual({});
  });

  it('propagates a DB error from the insert', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: [], error: null }))
      .mockReturnValueOnce(queryResult({ error: { message: 'insert failed' } }));
    const res = await submitGameResult(input);
    expect(res).toEqual({ error: 'insert failed' });
  });
});

// ===========================================================================
// approveSubmission
// ===========================================================================

describe('approveSubmission', () => {
  it('returns an error when the submission is not found', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: { message: 'x' } }));
    const res = await approveSubmission('missing');
    expect(res).toEqual({ error: 'הגשה לא נמצאה' });
  });

  it('applies the score and marks approved when there are no player stats', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({                       // fetch submission
        data: { id: 's1', game_id: 'g1', home_score: 80, away_score: 70, extracted_stats: null },
        error: null,
      }))
      .mockReturnValueOnce(queryResult({ error: null }))       // game update
      .mockReturnValueOnce(queryResult({ error: null }));      // submission status update
    const res = await approveSubmission('s1');
    expect(res).toEqual({});
  });

  it('returns the game-update error when applying the score fails', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({
        data: { id: 's1', game_id: 'g1', home_score: 80, away_score: 70, extracted_stats: null },
        error: null,
      }))
      .mockReturnValueOnce(queryResult({ error: { message: 'game update failed' } }));
    const res = await approveSubmission('s1');
    expect(res).toEqual({ error: 'game update failed' });
  });

  it('writes game_stats for a matched player and recalculates totals', async () => {
    const stats = { home_players: [{ name: 'יוסי', points: 20 }], away_players: [] };
    findPlayerMock.mockResolvedValue({ player: { id: 'p1', team_id: 't1' }, via: 'exact' });

    fromMock
      .mockReturnValueOnce(queryResult({                       // fetch submission
        data: { id: 's1', game_id: 'g1', home_score: 80, away_score: 70, extracted_stats: stats },
        error: null,
      }))
      .mockReturnValueOnce(queryResult({ error: null }))       // game update
      .mockReturnValueOnce(queryResult({ data: { home_team_id: 't1', away_team_id: 't2' }, error: null })) // game teams
      .mockReturnValueOnce(queryResult({ error: null }))       // game_stats upsert
      .mockReturnValueOnce(queryResult({ data: [{ points: 20, three_pointers: 0, fouls: 0 }], error: null })) // recalc select
      .mockReturnValueOnce(queryResult({ error: null }))       // recalc player update
      .mockReturnValueOnce(queryResult({ error: null }));      // submission status update

    const res = await approveSubmission('s1');
    expect(res).toEqual({});
    expect(findPlayerMock).toHaveBeenCalled();
  });
});

// ===========================================================================
// rejectSubmission / clearSubmission / changeSubmissionStatus
// ===========================================================================

describe('rejectSubmission', () => {
  it('updates the submission to rejected and returns empty', async () => {
    // revokeApprovalEffects runs first (maybeSingle → null short-circuits it),
    // then the status update.
    fromMock
      .mockReturnValueOnce(queryResult({ data: null, error: null })) // revoke: sub lookup → none
      .mockReturnValue(queryResult({ error: null }));                // status update
    const res = await rejectSubmission('s1', 'bad scoresheet');
    expect(res).toEqual({});
  });
});

describe('clearSubmission', () => {
  it('deletes the submission and returns empty', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await clearSubmission('s1')).toEqual({});
  });

  it('propagates a delete error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'delete failed' } }));
    expect(await clearSubmission('s1')).toEqual({ error: 'delete failed' });
  });
});

describe('changeSubmissionStatus', () => {
  it('delegates to approveSubmission when the new status is approved', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: { message: 'x' } }));
    const res = await changeSubmissionStatus('s1', 'approved');
    // approveSubmission with a missing submission returns this specific error
    expect(res).toEqual({ error: 'הגשה לא נמצאה' });
  });

  it('revokes effects then updates status for non-approved transitions', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: null, error: null })) // revoke: sub lookup → none
      .mockReturnValue(queryResult({ error: null }));                // status update
    const res = await changeSubmissionStatus('s1', 'pending');
    expect(res).toEqual({});
  });
});

// ===========================================================================
// upsertPlayerGameStat
// ===========================================================================

describe('upsertPlayerGameStat', () => {
  const base = { playerId: 'p1', gameId: 'g1', points: 20, threePointers: 2, fouls: 1 };

  it('rejects when player or game id is missing', async () => {
    expect(await upsertPlayerGameStat({ ...base, playerId: '' })).toEqual({ error: 'player + game required' });
    expect(await upsertPlayerGameStat({ ...base, gameId: '' })).toEqual({ error: 'player + game required' });
  });

  it('returns an error when the player is not found', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: null }));
    const res = await upsertPlayerGameStat(base);
    expect(res).toEqual({ error: 'player not found' });
  });

  it('rejects when the player has no team', async () => {
    fromMock.mockReturnValue(queryResult({ data: { id: 'p1', team_id: null, points: 0, three_pointers: 0, fouls: 0 }, error: null }));
    const res = await upsertPlayerGameStat(base);
    expect(res.error).toContain('no team');
  });

  it('upserts the per-game row and applies the delta to season totals', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: { id: 'p1', team_id: 't1', points: 0, three_pointers: 0, fouls: 0 }, error: null })) // player read
      .mockReturnValueOnce(queryResult({ data: null, error: null }))   // existing game_stats → none
      .mockReturnValueOnce(queryResult({ error: null }))               // game_stats upsert
      .mockReturnValueOnce(queryResult({ error: null }));              // players update (delta)
    const res = await upsertPlayerGameStat(base);
    expect(res).toEqual({});
  });

  it('deletes the per-game row when all stats are zeroed and a row exists', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ data: { id: 'p1', team_id: 't1', points: 20, three_pointers: 0, fouls: 0 }, error: null })) // player read
      .mockReturnValueOnce(queryResult({ data: { points: 20, three_pointers: 0, fouls: 0 }, error: null })) // existing row
      .mockReturnValueOnce(queryResult({ error: null }))   // game_stats delete
      .mockReturnValueOnce(queryResult({ error: null }));  // players update (delta -20)
    const res = await upsertPlayerGameStat({ ...base, points: 0, threePointers: 0, fouls: 0 });
    expect(res).toEqual({});
  });
});

// ===========================================================================
// league_settings savers
// ===========================================================================

describe('settings savers', () => {
  it('saveTickerSpeed clamps and upserts', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await saveTickerSpeed(200)).toEqual({}); // clamped to 120 internally
  });

  it('saveTickerSpeed propagates a DB error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'boom' } }));
    expect(await saveTickerSpeed(30)).toEqual({ error: 'boom' });
  });

  it('saveTermsSetting upserts the given key', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await saveTermsSetting('terms_of_use', 'text')).toEqual({});
  });

  it('saveAccessibilitySetting upserts', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await saveAccessibilitySetting('accessibility_coordinator_name', 'Dana')).toEqual({});
  });

  it('saveCupSetting upserts', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await saveCupSetting('cup_tournament_teams', '["t1","t2"]')).toEqual({});
  });

  it('saveAboutSetting upserts', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await saveAboutSetting('about_story', 'Once upon a time')).toEqual({});
  });

  it('saveAboutSetting propagates a DB error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'nope' } }));
    expect(await saveAboutSetting('about_story', 'x')).toEqual({ error: 'nope' });
  });
});

// ===========================================================================
// contact messages
// ===========================================================================

describe('contact-message actions', () => {
  it('markMessageRead updates is_read', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await markMessageRead('m1')).toEqual({});
  });

  it('setMessageHandled(true) succeeds', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await setMessageHandled('m1', true)).toEqual({});
  });

  it('setMessageHandled(false) succeeds', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await setMessageHandled('m1', false)).toEqual({});
  });

  it('deleteMessage removes the row', async () => {
    fromMock.mockReturnValue(queryResult({ error: null }));
    expect(await deleteMessage('m1')).toEqual({});
  });

  it('deleteMessage propagates a DB error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'fail' } }));
    expect(await deleteMessage('m1')).toEqual({ error: 'fail' });
  });
});

// ===========================================================================
// saveBoxScore
// ===========================================================================

describe('saveBoxScore', () => {
  it('rejects an empty stats array', async () => {
    expect(await saveBoxScore('g1', [])).toEqual({ error: 'No stats provided.' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('upserts rows and recalculates totals on success', async () => {
    fromMock
      .mockReturnValueOnce(queryResult({ error: null }))                        // game_stats upsert
      .mockReturnValue(queryResult({ data: [{ points: 10, three_pointers: 1, fouls: 0 }], error: null })); // recalc
    const res = await saveBoxScore('g1', [
      { playerId: 'p1', teamId: 't1', points: 10, threePt: 1, fouls: 0 },
    ]);
    expect(res).toEqual({});
  });

  it('propagates the upsert error', async () => {
    fromMock.mockReturnValue(queryResult({ error: { message: 'upsert failed' } }));
    const res = await saveBoxScore('g1', [
      { playerId: 'p1', teamId: 't1', points: 10, threePt: 1, fouls: 0 },
    ]);
    expect(res).toEqual({ error: 'upsert failed' });
  });
});

// ===========================================================================
// bulkImportGames
// ===========================================================================

describe('bulkImportGames', () => {
  it('errors when there are no teams in the DB', async () => {
    fromMock.mockReturnValue(queryResult({ data: [], error: null }));
    const res = await bulkImportGames();
    expect(res.error).toContain('No teams');
  });

  it('reports missing teams when the schedule references unknown names', async () => {
    // Only one team present → most schedule teams are missing.
    fromMock.mockReturnValue(queryResult({ data: [{ id: 't1', name: 'חולון' }], error: null }));
    const res = await bulkImportGames();
    expect(res.missingTeams && res.missingTeams.length).toBeGreaterThan(0);
    expect(res.inserted).toBe(0);
  });

  it('propagates a teams-load error', async () => {
    fromMock.mockReturnValue(queryResult({ data: null, error: { message: 'teams load failed' } }));
    const res = await bulkImportGames();
    expect(res.error).toBe('teams load failed');
  });
});
