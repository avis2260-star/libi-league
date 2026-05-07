// Resolve any team-name string (from schedule data, standings cache,
// game_results, etc.) to the team's current name in the teams table.
//
// Rule: the admin "קבוצות" tab is the single source of truth for how
// team names appear on the public UI. Any rename there must propagate
// to every page automatically — but standings/game_results/etc. cache
// the name as plain text. This helper is the runtime bridge.

import { supabaseAdmin } from './supabase-admin';

export type TeamRow = { id: string; name: string };

function normalize(s: string): string {
  return s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Build a resolver closed over a snapshot of the teams table. Cheap to
// call repeatedly per request, so call it once per server-rendered page
// and reuse for all team-name strings on that page.
export function makeNameResolver(teams: TeamRow[]) {
  // Pre-index for O(1) exact lookups
  const byNorm = new Map<string, string>();
  for (const t of teams) byNorm.set(normalize(t.name), t.name);

  return function resolveDisplayName(name: string | null | undefined): string {
    if (!name) return name ?? '';
    const target = normalize(name);
    if (!target) return name;

    const exact = byNorm.get(target);
    if (exact) return exact;

    // Fallback: substring match in either direction. Lets schedule
    // entries like "אדיס אשדוד" match a DB team called
    // "שועלי אדיס אשדוד" (and vice versa).
    for (const t of teams) {
      const n = normalize(t.name);
      if (n.includes(target) || target.includes(n)) return t.name;
    }
    return name;
  };
}

// Convenience: fetch teams + return a ready-to-use resolver. Use this
// in server components that don't already need to load teams themselves.
export async function loadNameResolver(): Promise<(name: string | null | undefined) => string> {
  const { data } = await supabaseAdmin.from('teams').select('id, name');
  return makeNameResolver((data ?? []) as TeamRow[]);
}
