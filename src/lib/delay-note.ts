/**
 * The public note on a postponed game (games.delay_note) — why it was
 * postponed or stopped. Shared by the admin field and the server action.
 */
export const DELAY_NOTE_MAX = 200;

/** One-click starting points in the admin; the admin can edit the text after. */
export const DELAY_NOTE_PRESETS = [
  'נדחה בגלל מזג האוויר',
  'הופסק בגלל מזג האוויר',
  'האולם לא זמין',
  'נדחה בהחלטת הליגה',
] as const;

/** Collapses whitespace, trims and caps the length; empty → null (no note). */
export function cleanDelayNote(note: string | null | undefined): string | null {
  const clean = (note ?? '').replace(/\s+/g, ' ').trim().slice(0, DELAY_NOTE_MAX).trim();
  return clean || null;
}
