// Resolve which round a league fixture belongs to, from the static schedule.
//
// The `games` table doesn't store a round number — it's derived from the
// directional (home, away) team pair against LIBI_SCHEDULE. In a home-and-away
// league the same pair appears in two rounds (once per side), so the key must
// be directional. A fuzzy substring fallback covers the case where a team was
// renamed in the DB but the static schedule still uses the old name.
//
// This mirrors the lookup baked into GamesTab; extracted so the public home
// page (delayed-games surface) resolves rounds identically.

import { LIBI_SCHEDULE, type ScheduleEntry } from './libi-schedule';

function normTeam(s: string): string {
  return s.replace(/["“”„‟״'‘’`]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

const TUPLE_TO_ENTRY = new Map<string, ScheduleEntry>();
for (const g of LIBI_SCHEDULE) {
  TUPLE_TO_ENTRY.set(`${normTeam(g.homeTeam)}>${normTeam(g.awayTeam)}`, g);
}

/** Schedule entry (round + division + canonical date) for a fixture, or null. */
export function scheduleEntryForFixture(home: string, away: string): ScheduleEntry | null {
  if (!home || !away) return null;
  const exact = TUPLE_TO_ENTRY.get(`${normTeam(home)}>${normTeam(away)}`);
  if (exact) return exact;
  const h = normTeam(home);
  const a = normTeam(away);
  for (const g of LIBI_SCHEDULE) {
    const sh = normTeam(g.homeTeam);
    const sa = normTeam(g.awayTeam);
    const homeMatches = sh === h || sh.includes(h) || h.includes(sh);
    const awayMatches = sa === a || sa.includes(a) || a.includes(sa);
    if (homeMatches && awayMatches) return g;
  }
  return null;
}

/** Round number for a fixture, or null when it matches no scheduled game. */
export function roundForFixture(home: string, away: string): number | null {
  return scheduleEntryForFixture(home, away)?.round ?? null;
}
