'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { GameStatus } from '@/types';
import { revalidatePath } from 'next/cache';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';

type ActionResult = { error?: string };

// ── Bulk game import ──────────────────────────────────────────────────────────

export type ImportResult = {
  inserted: number;
  skipped: number;
  error?: string;
  missingTeams?: string[];
};

export async function bulkImportGames(): Promise<ImportResult> {
  // 1. Load all teams from DB
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .select('id, name');

  if (teamsError) return { inserted: 0, skipped: 0, error: teamsError.message };
  if (!teams?.length) {
    return {
      inserted: 0,
      skipped: 0,
      error: 'No teams found in the database. Please add your 15 teams first.',
    };
  }

  // 2. Build name → UUID map
  const teamMap = new Map<string, string>(teams.map((t) => [t.name.trim(), t.id]));

  // 3. Check for missing teams
  const allTeamNames = [...new Set(LIBI_SCHEDULE.flatMap((g) => [g.homeTeam, g.awayTeam]))];
  const missing = allTeamNames.filter((name) => !teamMap.has(name));
  if (missing.length > 0) {
    return { inserted: 0, skipped: 0, missingTeams: missing };
  }

  // 4. Load existing games to skip duplicates (match on home_team_id + away_team_id + game_date)
  const { data: existing } = await supabaseAdmin
    .from('games')
    .select('home_team_id, away_team_id, game_date');

  const existingSet = new Set(
    (existing ?? []).map((g) => `${g.home_team_id}|${g.away_team_id}|${g.game_date}`),
  );

  // 5. Build rows to insert
  const rows = [];
  let skipped = 0;

  for (const entry of LIBI_SCHEDULE) {
    const homeId = teamMap.get(entry.homeTeam)!;
    const awayId = teamMap.get(entry.awayTeam)!;
    const key = `${homeId}|${awayId}|${entry.date}`;

    if (existingSet.has(key)) {
      skipped++;
      continue;
    }

    rows.push({
      home_team_id: homeId,
      away_team_id: awayId,
      game_date: entry.date,
      game_time: '19:00:00',
      location: 'TBD',
      home_score: 0,
      away_score: 0,
      status: 'Scheduled' as GameStatus,
    });
  }

  if (rows.length === 0) {
    return { inserted: 0, skipped };
  }

  // 6. Insert new games in one batch
  const { error: insertError } = await supabaseAdmin.from('games').insert(rows);
  if (insertError) return { inserted: 0, skipped, error: insertError.message };

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/games');

  return { inserted: rows.length, skipped };
}

// ── Game score + status ───────────────────────────────────────────────────────

export async function updateGameScore(
  gameId: string,
  homeScore: number,
  awayScore: number,
  status: GameStatus,
  gameTime?: string,
  location?: string,
): Promise<ActionResult> {
  if (homeScore < 0 || awayScore < 0) return { error: 'Scores cannot be negative.' };

  const update: Record<string, unknown> = { home_score: homeScore, away_score: awayScore, status };
  if (gameTime !== undefined) update.game_time = gameTime;
  if (location !== undefined) update.location  = location;

  const { error } = await supabaseAdmin
    .from('games')
    .update(update)
    .eq('id', gameId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/games');
  revalidatePath('/standings');
  return {};
}

// ── Game time + location ──────────────────────────────────────────────────────

export async function updateGameDetails(
  gameId: string,
  gameTime: string,
  location: string,
): Promise<ActionResult> {
  const update: Record<string, unknown> = {
    game_time: gameTime || '00:00:00',
    location:  location || 'TBD',
  };

  const { error } = await supabaseAdmin
    .from('games')
    .update(update)
    .eq('id', gameId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/games');
  return {};
}

// ── Reset ALL games time + location ──────────────────────────────────────────

export async function resetAllGameDetails(): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('games')
    .update({ game_time: '00:00:00', location: 'TBD' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // matches all rows

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/games');
  return {};
}

// ── Reset Season ──────────────────────────────────────────────────────────────

export type ResetSeasonOptions = {
  resetGames: boolean;
  resetPlayerStats: boolean;
  resetStandings: boolean;
  resetPlayoff: boolean;
};

export type ResetSeasonResult = {
  error?: string;
  done: string[];
};

export async function resetSeason(opts: ResetSeasonOptions): Promise<ResetSeasonResult> {
  const done: string[] = [];

  if (opts.resetGames) {
    const { error } = await supabaseAdmin
      .from('games')
      .update({
        home_score: null,
        away_score: null,
        played: false,
        game_time: '00:00:00',
        location: 'TBD',
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return { error: `שגיאה באיפוס משחקים: ${error.message}`, done };
    done.push('משחקים אופסו');
  }

  if (opts.resetPlayerStats) {
    const { error } = await supabaseAdmin
      .from('players')
      .update({ points: 0, three_pointers: 0, fouls: 0 })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return { error: `שגיאה באיפוס שחקנים: ${error.message}`, done };
    done.push('סטטיסטיקת שחקנים אופסה');
  }

  if (opts.resetStandings) {
    const { error } = await supabaseAdmin
      .from('standings')
      .update({ wins: 0, losses: 0, points_for: 0, points_against: 0, draws: 0 })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return { error: `שגיאה באיפוס טבלה: ${error.message}`, done };
    done.push('טבלת הליגה אופסה');
  }

  if (opts.resetPlayoff) {
    const { error: e1 } = await supabaseAdmin
      .from('playoff_games')
      .delete()
      .neq('id', 0);
    if (e1) return { error: `שגיאה במחיקת משחקי פלייאוף: ${e1.message}`, done };

    const { error: e2 } = await supabaseAdmin
      .from('playoff_series')
      .delete()
      .neq('series_number', 0);
    if (e2) return { error: `שגיאה במחיקת סדרות פלייאוף: ${e2.message}`, done };
    done.push('פלייאוף נמחק');
  }

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/games');
  revalidatePath('/playoff');
  return { done };
}

// ── Video URL ─────────────────────────────────────────────────────────────────

export async function updateVideoUrl(
  gameId: string,
  videoUrl: string,
): Promise<ActionResult> {
  const trimmed = videoUrl.trim();

  // Basic URL validation (allow empty to clear)
  if (trimmed && !/^https?:\/\/.+/.test(trimmed)) {
    return { error: 'Please enter a valid URL starting with http:// or https://' };
  }

  const { error } = await supabaseAdmin
    .from('games')
    .update({ video_url: trimmed || null })
    .eq('id', gameId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  return {};
}

// ── Game submission (public scoresheet upload) ────────────────────────────────

export type SubmitGameResultInput = {
  gameId: string;
  submittedBy: string;
  homeScore: number;
  awayScore: number;
  extractedStats: object;
  confidenceScore: number;
  qualityStatus: 'pass' | 'fail';
  status: 'pending' | 'needs_review';
  scoresheetImageUrl?: string;
};

export async function submitGameResult(input: SubmitGameResultInput): Promise<ActionResult> {
  // Enforce lock: only one active submission per game
  const { data: existing } = await supabaseAdmin
    .from('game_submissions')
    .select('id')
    .eq('game_id', input.gameId)
    .in('status', ['pending', 'needs_review', 'approved'])
    .limit(1);

  if (existing?.length) {
    return { error: 'משחק זה כבר הוגש ונמצא בבדיקה. פנה למנהל הליגה לביטול.' };
  }

  const { error } = await supabaseAdmin.from('game_submissions').insert({
    game_id: input.gameId,
    submitted_by: input.submittedBy,
    home_score: input.homeScore,
    away_score: input.awayScore,
    extracted_stats: input.extractedStats,
    confidence_score: input.confidenceScore,
    quality_status: input.qualityStatus,
    status: input.status,
    scoresheet_image_url: input.scoresheetImageUrl ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/submit');
  return {};
}

export async function approveSubmission(submissionId: string): Promise<ActionResult> {
  // Fetch submission
  const { data: sub, error: fetchErr } = await supabaseAdmin
    .from('game_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (fetchErr || !sub) return { error: 'הגשה לא נמצאה' };

  // Apply score to the game
  const { error: gameErr } = await supabaseAdmin
    .from('games')
    .update({
      home_score: sub.home_score,
      away_score: sub.away_score,
      status: 'Finished',
    })
    .eq('id', sub.game_id);

  if (gameErr) return { error: gameErr.message };

  // ── Update player stats from extracted_stats ──────────────────────────────
  const stats = sub.extracted_stats as {
    home_players?: { name: string; points?: number; three_pointers?: number; fouls?: number }[];
    away_players?: { name: string; points?: number; three_pointers?: number; fouls?: number }[];
  } | null;

  if (stats) {
    const allPlayers = [
      ...(stats.home_players ?? []),
      ...(stats.away_players ?? []),
    ];

    for (const ep of allPlayers) {
      if (!ep.name || ep.name === '?') continue;

      // Find player by name (case-insensitive)
      const { data: found } = await supabaseAdmin
        .from('players')
        .select('id, points, three_pointers, fouls')
        .ilike('name', ep.name.trim())
        .maybeSingle();

      if (found) {
        await supabaseAdmin
          .from('players')
          .update({
            points:         (found.points        ?? 0) + (ep.points         ?? 0),
            three_pointers: (found.three_pointers ?? 0) + (ep.three_pointers ?? 0),
            fouls:          (found.fouls          ?? 0) + (ep.fouls          ?? 0),
            updated_at:     new Date().toISOString(),
          })
          .eq('id', found.id);
      }
    }
  }

  // Mark submission approved
  const { error } = await supabaseAdmin
    .from('game_submissions')
    .update({ status: 'approved' })
    .eq('id', submissionId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/results');
  revalidatePath('/standings');
  revalidatePath('/players');
  return {};
}

export async function rejectSubmission(submissionId: string, notes?: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('game_submissions')
    .update({ status: 'rejected', review_notes: notes ?? null })
    .eq('id', submissionId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  return {};
}

export async function clearSubmission(submissionId: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('game_submissions')
    .delete()
    .eq('id', submissionId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/submit');
  return {};
}

export async function changeSubmissionStatus(
  submissionId: string,
  status: 'pending' | 'needs_review' | 'approved' | 'rejected',
  notes?: string
): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('game_submissions')
    .update({ status, review_notes: notes ?? null })
    .eq('id', submissionId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/submit');
  return {};
}

// ── Ticker speed ─────────────────────────────────────────────────────────────

export async function saveTickerSpeed(seconds: number): Promise<ActionResult> {
  const clamped = Math.max(5, Math.min(120, Math.round(seconds)));
  const { error } = await supabaseAdmin
    .from('league_settings')
    .upsert({ key: 'ticker_speed', value: String(clamped) }, { onConflict: 'key' });

  if (error) return { error: error.message };
  revalidatePath('/');
  return {};
}

// ── Terms & Privacy text ──────────────────────────────────────────────────────

export async function saveTermsSetting(
  key: 'terms_of_use' | 'privacy_policy',
  value: string,
): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('league_settings')
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) return { error: error.message };
  revalidatePath('/terms');
  return {};
}

// ── Contact messages ─────────────────────────────────────────────────────────

export async function markMessageRead(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('contact_submissions')
    .update({ is_read: true })
    .eq('id', id);

  if (error) return { error: error.message };
  return {};
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('contact_submissions')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return {};
}

// ── Box score (per-game player stats) ────────────────────────────────────────

export type PlayerStatInput = {
  playerId: string;
  teamId: string;
  points: number;
  threePt: number;
  fouls: number;
};

export async function saveBoxScore(
  gameId: string,
  stats: PlayerStatInput[],
): Promise<ActionResult> {
  if (!stats.length) return { error: 'No stats provided.' };

  const rows = stats.map((s) => ({
    game_id: gameId,
    player_id: s.playerId,
    team_id: s.teamId,
    points: Math.max(0, s.points),
    three_pointers: Math.max(0, s.threePt),
    fouls: Math.max(0, s.fouls),
  }));

  const { error } = await supabaseAdmin
    .from('game_stats')
    .upsert(rows, { onConflict: 'game_id,player_id' });

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/players');
  return {};
}
