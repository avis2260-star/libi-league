// Robust player matching for OCR-extracted scoresheet data.
// Tries multiple strategies in order of confidence, scoped to a team
// so identical names on different teams don't collide.

import type { SupabaseClient } from '@supabase/supabase-js';

export type PlayerRow = {
  id: string;
  team_id: string | null;
  name: string;
  jersey_number: number | null;
};

export type ExtractedPlayer = {
  name?: string | null;
  jersey?: number | null;
};

// Normalize a Hebrew name: lower-case, trim, collapse whitespace,
// strip gereshim/quote variants and stray punctuation that OCR adds.
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[׳`'״"".\-_]/g, '') // Hebrew gereshim, quote variants, dots, dashes
    .replace(/\s+/g, ' ')
    .trim();
}

export type MatchResult =
  | { player: PlayerRow; via: 'exact' | 'team-exact' | 'team-jersey' | 'team-normalized' | 'team-substring' }
  | { player: null; via: 'no-match' };

// Find a player on the given team whose name/jersey matches the OCR-extracted entry.
// `teamId` is the team that submitted this player (home_team_id or away_team_id).
// Falls back to a global exact match only as a last resort.
export async function findPlayerForExtracted(
  supabase: SupabaseClient,
  extracted: ExtractedPlayer,
  teamId: string | null,
): Promise<MatchResult> {
  const rawName = (extracted.name ?? '').trim();
  if (!rawName || rawName === '?') return { player: null, via: 'no-match' };

  // 1. Exact case-insensitive match scoped to team
  if (teamId) {
    const { data } = await supabase
      .from('players')
      .select('id, team_id, name, jersey_number')
      .eq('team_id', teamId)
      .ilike('name', rawName)
      .maybeSingle();
    if (data) return { player: data as PlayerRow, via: 'team-exact' };
  }

  // 2. Jersey-number match scoped to team (very strong signal when present)
  if (teamId && typeof extracted.jersey === 'number') {
    const { data } = await supabase
      .from('players')
      .select('id, team_id, name, jersey_number')
      .eq('team_id', teamId)
      .eq('jersey_number', extracted.jersey)
      .maybeSingle();
    if (data) return { player: data as PlayerRow, via: 'team-jersey' };
  }

  // 3. Normalized match scoped to team (handles OCR whitespace/punctuation noise)
  if (teamId) {
    const { data: roster } = await supabase
      .from('players')
      .select('id, team_id, name, jersey_number')
      .eq('team_id', teamId);

    const target = normalizeName(rawName);

    // 3a. Normalized exact equality
    const exactNorm = (roster ?? []).find(
      (p) => normalizeName((p as PlayerRow).name) === target,
    );
    if (exactNorm) return { player: exactNorm as PlayerRow, via: 'team-normalized' };

    // 3b. Substring match (handles last-name-only or first-name-only on the sheet)
    const sub = (roster ?? []).find((p) => {
      const n = normalizeName((p as PlayerRow).name);
      return n.includes(target) || target.includes(n);
    });
    if (sub) return { player: sub as PlayerRow, via: 'team-substring' };
  }

  // 4. Global exact name match — last resort, may be ambiguous
  const { data: globalMatch } = await supabase
    .from('players')
    .select('id, team_id, name, jersey_number')
    .ilike('name', rawName)
    .maybeSingle();
  if (globalMatch) return { player: globalMatch as PlayerRow, via: 'exact' };

  return { player: null, via: 'no-match' };
}
