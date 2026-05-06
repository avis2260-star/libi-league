'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { GameStatus } from '@/types';
import { revalidatePath } from 'next/cache';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import { findPlayerForExtracted, type ExtractedPlayer } from '@/lib/match-player';

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

  // ── Upsert per-game player stats into game_stats ──────────────────────────
  type ExtractedRow = {
    name: string; jersey?: number | null;
    points?: number; three_pointers?: number; fouls?: number;
    played?: boolean;
  };
  const stats = sub.extracted_stats as {
    home_players?: ExtractedRow[];
    away_players?: ExtractedRow[];
  } | null;

  if (stats) {
    // Need home/away team IDs to scope the matcher to the correct roster
    const { data: gameRow } = await supabaseAdmin
      .from('games')
      .select('home_team_id, away_team_id')
      .eq('id', sub.game_id)
      .maybeSingle();

    const homeTeamId = gameRow?.home_team_id ?? null;
    const awayTeamId = gameRow?.away_team_id ?? null;

    const tagged: { ep: ExtractedRow; teamId: string | null }[] = [
      ...(stats.home_players ?? []).map((ep) => ({ ep, teamId: homeTeamId })),
      ...(stats.away_players ?? []).map((ep) => ({ ep, teamId: awayTeamId })),
    ];

    const affectedPlayerIds: string[] = [];

    for (const { ep, teamId } of tagged) {
      if (!ep.name || ep.name === '?') continue;
      // New behavior: if `played` is explicitly false, skip this player.
      // Backward compat: undefined `played` (older submissions) → treat as played.
      if (ep.played === false) continue;

      const result = await findPlayerForExtracted(
        supabaseAdmin,
        ep as ExtractedPlayer,
        teamId,
      );

      if (result.player) {
        // Write per-game row so the player profile page shows this game
        await supabaseAdmin
          .from('game_stats')
          .upsert({
            game_id:        sub.game_id,
            player_id:      result.player.id,
            team_id:        result.player.team_id,
            points:         ep.points         ?? 0,
            three_pointers: ep.three_pointers ?? 0,
            fouls:          ep.fouls          ?? 0,
          }, { onConflict: 'game_id,player_id' });

        affectedPlayerIds.push(result.player.id);
      }
    }

    // Recalculate each player's season totals from game_stats (source of truth)
    await recalcPlayerTotals(affectedPlayerIds);
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

// ── Helper: recalculate players.points/three_pointers/fouls from game_stats ──

async function recalcPlayerTotals(playerIds: string[]): Promise<void> {
  for (const playerId of playerIds) {
    const { data: rows, error: selErr } = await supabaseAdmin
      .from('game_stats')
      .select('points, three_pointers, fouls')
      .eq('player_id', playerId);

    if (selErr) {
      console.error('[recalcPlayerTotals] select game_stats failed:', selErr);
      continue;
    }

    const totals = {
      points:         (rows ?? []).reduce((n, r) => n + (r.points         ?? 0), 0),
      three_pointers: (rows ?? []).reduce((n, r) => n + (r.three_pointers ?? 0), 0),
      fouls:          (rows ?? []).reduce((n, r) => n + (r.fouls          ?? 0), 0),
    };

    // Only update the three core columns — no games_played / updated_at
    // (those may not exist in the DB if the ALTER TABLE SQL wasn't run)
    const { error: updErr } = await supabaseAdmin
      .from('players')
      .update(totals)
      .eq('id', playerId);

    if (updErr) {
      console.error('[recalcPlayerTotals] update player failed:', playerId, updErr);
    }
  }
}

// ── Helper: undo approval effects (game_stats + player totals + game score) ───

async function revokeApprovalEffects(submissionId: string): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from('game_submissions')
    .select('game_id, extracted_stats')
    .eq('id', submissionId)
    .maybeSingle();

  if (!sub) return;

  // ── Step 1: grab player IDs from game_stats BEFORE deleting ──────────────
  // (reliable for submissions approved with the new code)
  const { data: gsRows } = await supabaseAdmin
    .from('game_stats')
    .select('player_id')
    .eq('game_id', sub.game_id);

  const idsFromGameStats = new Set<string>((gsRows ?? []).map((r) => r.player_id));

  // ── Step 2: delete game_stats rows for this game ──────────────────────────
  const { error: delErr } = await supabaseAdmin
    .from('game_stats')
    .delete()
    .eq('game_id', sub.game_id);
  if (delErr) console.error('[revokeApprovalEffects] delete game_stats failed:', delErr);

  // ── Step 3: find players from extracted_stats ─────────────────────────────
  // Needed for old submissions that were approved before game_stats was written.
  // Also catches any players whose IDs weren't in game_stats.
  const idsFromExtracted = new Set<string>();
  const stats = sub.extracted_stats as {
    home_players?: { name?: string }[];
    away_players?: { name?: string }[];
  } | null;

  if (stats) {
    const allPlayers = [...(stats.home_players ?? []), ...(stats.away_players ?? [])];
    for (const ep of allPlayers) {
      if (!ep.name || ep.name === '?') continue;
      const { data: found } = await supabaseAdmin
        .from('players')
        .select('id')
        .ilike('name', ep.name.trim())
        .maybeSingle();
      if (found) idsFromExtracted.add(found.id);
    }
  }

  const allAffected = [...new Set([...idsFromGameStats, ...idsFromExtracted])];

  // ── Step 4: recalculate totals from remaining game_stats ──────────────────
  // This sets each player's stats to sum of their OTHER approved games.
  // If they had no other games, this correctly sets everything to 0.
  await recalcPlayerTotals(allAffected);

  // ── Step 5: safety net — for players found via extracted_stats whose       ──
  // stats were written directly to players table (old-style approval),        ──
  // force-zero them if game_stats is still empty after recalc.               ──
  for (const playerId of idsFromExtracted) {
    if (!idsFromGameStats.has(playerId)) {
      // Check if they have any remaining game_stats
      const { count } = await supabaseAdmin
        .from('game_stats')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', playerId);

      if ((count ?? 0) === 0) {
        const { error: zeroErr } = await supabaseAdmin
          .from('players')
          .update({ points: 0, three_pointers: 0, fouls: 0 })
          .eq('id', playerId);
        if (zeroErr) console.error('[revokeApprovalEffects] zero player failed:', playerId, zeroErr);
      }
    }
  }

  // ── Step 6: reset game back to Scheduled ─────────────────────────────────
  const { error: gameErr } = await supabaseAdmin
    .from('games')
    .update({ home_score: 0, away_score: 0, status: 'Scheduled' })
    .eq('id', sub.game_id);
  if (gameErr) console.error('[revokeApprovalEffects] reset game failed:', gameErr);
}

export async function rejectSubmission(submissionId: string, notes?: string): Promise<ActionResult> {
  // Undo any stats/score written when this submission was previously approved
  await revokeApprovalEffects(submissionId);

  const { error } = await supabaseAdmin
    .from('game_submissions')
    .update({ status: 'rejected', review_notes: notes ?? null })
    .eq('id', submissionId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/players');
  revalidatePath('/');
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
  notes?: string,
): Promise<ActionResult> {
  // Approving → run full pipeline (game score + game_stats + player totals)
  if (status === 'approved') {
    return approveSubmission(submissionId);
  }

  // Moving away from approved (or rejecting) → undo all effects first
  await revokeApprovalEffects(submissionId);

  const { error } = await supabaseAdmin
    .from('game_submissions')
    .update({ status, review_notes: notes ?? null })
    .eq('id', submissionId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/submit');
  revalidatePath('/players');
  revalidatePath('/');
  return {};
}

// ── Admin: directly edit a player's season stats ─────────────────────────────

export async function updatePlayerStats(
  playerId: string,
  points: number,
  threePointers: number,
  fouls: number,
): Promise<ActionResult> {
  if (!playerId) return { error: 'Player ID required' };

  const clean = {
    points:         Math.max(0, Math.floor(points)),
    three_pointers: Math.max(0, Math.floor(threePointers)),
    fouls:          Math.max(0, Math.floor(fouls)),
  };

  const { error } = await supabaseAdmin
    .from('players')
    .update(clean)
    .eq('id', playerId);

  if (error) {
    console.error('[updatePlayerStats] failed:', error);
    return { error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/players');
  revalidatePath(`/players/${playerId}`);
  revalidatePath('/scorers');
  revalidatePath('/');
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

// ── Reprocess approved submissions ────────────────────────────────────────────
//
// Re-runs the player-name matcher against every approved submission and
// rewrites the game_stats rows. Use this after improving the matcher (or
// after correcting player names in the DB) to backfill stats for players
// whose box scores were silently dropped because their name didn't match.

export type ReprocessReport = {
  submissionsProcessed: number;
  gamesUpdated: number;
  playersMatched: number;
  unmatched: { submissionId: string; gameDate: string; teamSide: 'home' | 'away'; name: string; jersey: number | null }[];
  error?: string;
};

export async function reprocessApprovedSubmissions(): Promise<ReprocessReport> {
  const report: ReprocessReport = {
    submissionsProcessed: 0,
    gamesUpdated: 0,
    playersMatched: 0,
    unmatched: [],
  };

  type SubLite = {
    id: string;
    game_id: string;
    extracted_stats: {
      home_players?: { name?: string; jersey?: number | null; points?: number; three_pointers?: number; fouls?: number; played?: boolean }[];
      away_players?: { name?: string; jersey?: number | null; points?: number; three_pointers?: number; fouls?: number; played?: boolean }[];
    } | null;
    game: { game_date: string; home_team_id: string | null; away_team_id: string | null } | null;
  };

  const { data: subs, error: fetchErr } = await supabaseAdmin
    .from('game_submissions')
    .select(`
      id, game_id, extracted_stats,
      game:games(game_date, home_team_id, away_team_id)
    `)
    .eq('status', 'approved');

  if (fetchErr) {
    report.error = fetchErr.message;
    return report;
  }

  const allAffectedPlayerIds = new Set<string>();

  for (const subRaw of (subs ?? []) as unknown as SubLite[]) {
    report.submissionsProcessed++;

    const stats = subRaw.extracted_stats;
    if (!stats) continue;

    const homeTeamId = subRaw.game?.home_team_id ?? null;
    const awayTeamId = subRaw.game?.away_team_id ?? null;
    const gameDate = subRaw.game?.game_date ?? '';

    // Wipe existing game_stats for this game so we can rewrite cleanly
    await supabaseAdmin.from('game_stats').delete().eq('game_id', subRaw.game_id);

    type RawPlayer = { name?: string; jersey?: number | null; points?: number; three_pointers?: number; fouls?: number; played?: boolean };
    const tagged: { ep: RawPlayer; teamId: string | null; side: 'home' | 'away' }[] = [
      ...(stats.home_players ?? []).map((ep) => ({ ep: ep as RawPlayer, teamId: homeTeamId, side: 'home' as const })),
      ...(stats.away_players ?? []).map((ep) => ({ ep: ep as RawPlayer, teamId: awayTeamId, side: 'away' as const })),
    ];

    let touched = false;

    for (const { ep, teamId, side } of tagged) {
      if (!ep.name || ep.name === '?') continue;
      if (ep.played === false) continue;

      const result = await findPlayerForExtracted(
        supabaseAdmin,
        ep as ExtractedPlayer,
        teamId,
      );

      if (result.player) {
        await supabaseAdmin.from('game_stats').upsert({
          game_id:        subRaw.game_id,
          player_id:      result.player.id,
          team_id:        result.player.team_id,
          points:         ep.points         ?? 0,
          three_pointers: ep.three_pointers ?? 0,
          fouls:          ep.fouls          ?? 0,
        }, { onConflict: 'game_id,player_id' });

        allAffectedPlayerIds.add(result.player.id);
        report.playersMatched++;
        touched = true;
      } else {
        report.unmatched.push({
          submissionId: subRaw.id,
          gameDate,
          teamSide: side,
          name: ep.name,
          jersey: ep.jersey ?? null,
        });
      }
    }

    if (touched) report.gamesUpdated++;
  }

  // Recalculate season totals for every player we touched, plus zero out
  // players whose stats came only from old (deleted) game_stats rows.
  const allPlayerIds = new Set<string>(allAffectedPlayerIds);
  // Also include any player who currently has non-zero totals so we re-derive
  // their value from the new game_stats data instead of trusting stale numbers.
  const { data: nonZero } = await supabaseAdmin
    .from('players')
    .select('id')
    .or('points.gt.0,three_pointers.gt.0,fouls.gt.0');
  for (const p of (nonZero ?? []) as { id: string }[]) allPlayerIds.add(p.id);

  await recalcPlayerTotals([...allPlayerIds]);

  revalidatePath('/players');
  revalidatePath('/admin');
  revalidatePath('/');
  return report;
}

// ── Accessibility statement ───────────────────────────────────────────────────

export type AccessibilitySettingKey =
  | 'accessibility_coordinator_name'
  | 'accessibility_coordinator_email'
  | 'accessibility_updated_at';

export async function saveAccessibilitySetting(
  key: AccessibilitySettingKey,
  value: string,
): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('league_settings')
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) return { error: error.message };
  revalidatePath('/accessibility');
  return {};
}

// ── About page text ───────────────────────────────────────────────────────────

export type AboutSettingKey =
  | 'about_hero_subtitle'
  | 'about_story'
  | 'about_association'
  | 'about_chairman_name';

export async function saveAboutSetting(
  key: AboutSettingKey,
  value: string,
): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from('league_settings')
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) return { error: error.message };
  revalidatePath('/about');
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

  // Recalculate season totals so player cards stay in sync
  await recalcPlayerTotals(stats.map((s) => s.playerId));

  revalidatePath('/admin');
  revalidatePath('/players');
  return {};
}
