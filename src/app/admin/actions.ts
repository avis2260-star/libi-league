'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { GameStatus } from '@/types';
import { revalidatePath } from 'next/cache';

type ActionResult = { error?: string };

// ── Game score + status ───────────────────────────────────────────────────────

export async function updateGameScore(
  gameId: string,
  homeScore: number,
  awayScore: number,
  status: GameStatus,
): Promise<ActionResult> {
  if (homeScore < 0 || awayScore < 0) return { error: 'Scores cannot be negative.' };

  const { error } = await supabaseAdmin
    .from('games')
    .update({ home_score: homeScore, away_score: awayScore, status })
    .eq('id', gameId);

  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/games');
  revalidatePath('/standings');
  return {};
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
