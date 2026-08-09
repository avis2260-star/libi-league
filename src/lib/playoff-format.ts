// Single source of truth for the playoff series format. Quarter- and
// semi-finals (series 1–6) are best-of-3; the final (series 7) is a single
// game. Keeping the rule here stops the cards, result dots, and winner
// resolution from drifting apart — the bug where the final still showed three
// game slots and never resolved a champion came from each view hard-coding
// "best of 3" on its own.

/** The final is series 7 (and anything numbered beyond it, defensively). */
export function isFinalSeries(seriesNumber: number): boolean {
  return seriesNumber >= 7;
}

/** Wins required to take the series: 1 for the final, 2 otherwise. */
export function winsNeeded(seriesNumber: number): number {
  return isFinalSeries(seriesNumber) ? 1 : 2;
}

/** Game slots played in the series: [1] for the final, [1, 2, 3] otherwise. */
export function gameNumsFor(seriesNumber: number): number[] {
  return isFinalSeries(seriesNumber) ? [1] : [1, 2, 3];
}

/**
 * Series winner from the two win counts, or null while undecided. Generic so
 * callers can pass team names, 'a'/'b' tags, or any token they use per side.
 */
export function seriesWinner<T>(
  seriesNumber: number,
  winsA: number, teamA: T,
  winsB: number, teamB: T,
): T | null {
  const need = winsNeeded(seriesNumber);
  return winsA >= need ? teamA : winsB >= need ? teamB : null;
}
