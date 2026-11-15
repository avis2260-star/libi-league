/**
 * Shared pieces of the per-game Excel box-score import: reading the workbook,
 * matching its lines to the two teams' rosters, orienting the official
 * scoresheet's quarter line to home/away, and building the template to fill.
 *
 * Pure (no DB, no xlsx import) so the rules are unit-testable. Used by the cup
 * import; the league and playoff routes carry their own copies of the same
 * rules.
 */
import {
  parseSummarySheet,
  parseSummaryTeamQuarters,
  parseGameStatsSheet,
  normalizeTeamName,
} from '@/lib/excel-sync-parsers';
import { normalizeName } from '@/lib/match-player';

export type StatLine = ReturnType<typeof parseSummarySheet>[number];
export type RosterPlayer = { id: string; team_id: string; name: string; jersey_number: number | null };

/**
 * The stat lines of an uploaded workbook. Prefers the official referee
 * scoresheet's "סיכום" sheet (and returns its rows, which also carry the
 * quarter line); otherwise reads the first sheet as the downloadable template.
 */
export function readStatsWorkbook(
  sheetNames: string[],
  rowsOf: (sheetName: string) => unknown[][] | null,
): { lines: StatLine[]; summaryRows: unknown[][] | null } {
  const summaryName = sheetNames.find((n) => n.replace(/\s/g, '').includes('סיכום'));
  if (summaryName) {
    const rows = rowsOf(summaryName);
    const lines = rows ? parseSummarySheet(rows) : [];
    if (lines.length > 0) return { lines, summaryRows: rows };
  }
  const first = sheetNames[0] ? rowsOf(sheetNames[0]) : null;
  return { lines: first ? parseGameStatsSheet(first) : [], summaryRows: null };
}

/**
 * One line → a player from the game's two rosters only: exact normalized name,
 * then a jersey number that identifies exactly one player, then a substring
 * (first- or last-name-only on the sheet).
 */
export function matchRosterPlayer(name: string, jersey: number | null, roster: RosterPlayer[]): RosterPlayer | null {
  const target = normalizeName(name);
  if (!target) return null;
  const exact = roster.find((r) => normalizeName(r.name) === target);
  if (exact) return exact;
  if (jersey !== null) {
    const byJersey = roster.filter((r) => r.jersey_number === jersey);
    if (byJersey.length === 1) return byJersey[0];
  }
  return roster.find((r) => {
    const n = normalizeName(r.name);
    return n.length > 1 && (n.includes(target) || target.includes(n));
  }) ?? null;
}

/** Matches every line, using each player at most once. */
export function matchStatLines(lines: StatLine[], roster: RosterPlayer[]) {
  const matched: { player: RosterPlayer; line: StatLine }[] = [];
  const unmatched: string[] = [];
  const used = new Set<string>();
  for (const line of lines) {
    const player = matchRosterPlayer(line.name, line.jersey, roster.filter((p) => !used.has(p.id)));
    if (!player) { unmatched.push(line.name); continue; }
    used.add(player.id);
    matched.push({ player, line });
  }
  return { matched, unmatched };
}

/**
 * The scoresheet's per-quarter team totals, oriented to the game's home/away
 * by team name (falling back to the form's host/guest label). Equal length,
 * at least 4, a trailing all-zero overtime dropped. Null when it can't tell.
 */
export function orientSummaryQuarters(
  summaryRows: unknown[][],
  homeName: string,
  awayName: string,
): { home: number[]; away: number[] } | null {
  const sections = parseSummaryTeamQuarters(summaryRows);
  if (sections.length < 2) return null;
  const homeNorm = normalizeTeamName(homeName);
  const awayNorm = normalizeTeamName(awayName);
  const matches = (secName: string, side: string) => {
    const t = normalizeTeamName(secName);
    return !!side && t.length > 0 && (t === side || t.includes(side) || side.includes(t));
  };
  let homeSec = sections.find((s) => matches(s.teamName, homeNorm));
  let awaySec = sections.find((s) => s !== homeSec && matches(s.teamName, awayNorm));
  if (!homeSec) homeSec = sections.find((s) => s !== awaySec && s.isHome) ?? sections.find((s) => s !== awaySec);
  if (!awaySec) awaySec = sections.find((s) => s !== homeSec && !s.isHome) ?? sections.find((s) => s !== homeSec);
  if (!homeSec || !awaySec || homeSec === awaySec) return null;

  let len = Math.max(4, homeSec.quarters.length, awaySec.quarters.length);
  const pad = (q: number[]) => Array.from({ length: len }, (_, i) => Math.max(0, Math.floor(q[i] ?? 0)));
  const home = pad(homeSec.quarters);
  const away = pad(awaySec.quarters);
  while (len > 4 && home[len - 1] === 0 && away[len - 1] === 0) { home.pop(); away.pop(); len--; }
  return { home, away };
}

export const TEMPLATE_HEADER = ['שם השחקן', 'מספר', 'נקודות', 'שלשות', 'עבירות'];

type TemplatePlayer = { id: string; name: string; jersey_number: number | null };
type TemplateStat = { points: number; three_pointers: number; fouls: number };

/** Rows of the fill-in template: both rosters, with any stats already saved. */
export function buildStatsTemplateRows(
  home: { label: string; players: TemplatePlayer[] },
  away: { label: string; players: TemplatePlayer[] },
  statByPlayer: Map<string, TemplateStat>,
): unknown[][] {
  const section = (label: string, players: TemplatePlayer[]): unknown[][] => {
    const rows: unknown[][] = [[`— ${label} —`, '', '', '', '']];
    if (players.length === 0) return [...rows, ['(אין שחקנים פעילים)', '', '', '', '']];
    for (const p of players) {
      const s = statByPlayer.get(p.id);
      rows.push([p.name, p.jersey_number ?? '', s?.points ?? '', s?.three_pointers ?? '', s?.fouls ?? '']);
    }
    return rows;
  };
  return [
    TEMPLATE_HEADER,
    ...section(home.label, home.players),
    ['', '', '', '', ''],
    ...section(away.label, away.players),
  ];
}
