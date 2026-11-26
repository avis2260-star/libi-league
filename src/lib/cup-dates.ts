/**
 * Dates on the public cup bracket. cup_games.date is free text: ISO
 * ("2026-11-14") from the admin's date picker, or "14.11" / "14.11.26" from
 * the Excel cup sheet. These helpers read all three and build the round
 * header's label from every game of the round (not just its first game).
 */
import { cupGameTime } from '@/lib/cup-settings';

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type CupDay = { day: number; month: number; year: number | null };

/**
 * Reads a cup date. A "14.11" with no year takes it from the season
 * ("2026-2027": Sep–Dec → 2026, Jan–Aug → 2027); without a season the year
 * stays unknown. Null for anything that isn't a date.
 */
export function parseCupDate(raw: string | null | undefined, season?: string): CupDay | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return valid({ year: +iso[1], month: +iso[2], day: +iso[3] });
  const dm = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/.exec(s);
  if (!dm) return null;
  const day = +dm[1];
  const month = +dm[2];
  let year: number | null = null;
  if (dm[3]) {
    year = +dm[3];
    if (year < 100) year += 2000;
  } else {
    const m = /^(\d{4})-(\d{4})$/.exec(season ?? '');
    if (m) year = month >= 9 ? +m[1] : +m[2];
  }
  return valid({ day, month, year });
}

function valid(d: CupDay): CupDay | null {
  if (d.month < 1 || d.month > 12 || d.day < 1 || d.day > 31) return null;
  return d;
}

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: CupDay) => `${d.year ?? 0}-${pad(d.month)}-${pad(d.day)}`;
const short = (d: CupDay) => `${pad(d.day)}.${pad(d.month)}`;

function weekday(d: CupDay, lang: 'he' | 'en'): string | null {
  if (d.year == null) return null;
  const dt = new Date(d.year, d.month - 1, d.day);
  if (dt.getDate() !== d.day) return null; // e.g. 31.02
  return (lang === 'en' ? EN_DAYS : HE_DAYS)[dt.getDay()];
}

/** "שבת 14.11" (weekday only when the year is known), or the raw text. */
export function formatCupDate(raw: string | null | undefined, lang: 'he' | 'en' = 'he', season?: string): string {
  const d = parseCupDate(raw, season);
  if (!d) return (raw ?? '').trim();
  const wd = weekday(d, lang);
  return wd ? `${wd} ${short(d)}` : short(d);
}

/**
 * The label of a round header, from all of its games' dates (and times):
 *   one day             → "שבת 14.11"  (+ " · 20:30" when every timed game shares it)
 *   several days        → "14.11 – 21.11"
 *   no game has a date  → null
 */
export function roundDateLabel(
  games: { date?: string | null; game_time?: string | null }[],
  lang: 'he' | 'en' = 'he',
  season?: string,
): string | null {
  const days = new Map<string, CupDay>();
  for (const g of games) {
    const d = parseCupDate(g.date, season);
    if (d) days.set(key(d), d);
  }
  if (days.size === 0) return null;
  const sorted = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d);

  if (sorted.length > 1) return `${short(sorted[0])} – ${short(sorted[sorted.length - 1])}`;

  const only = sorted[0];
  const wd = weekday(only, lang);
  const times = new Set(games.map((g) => cupGameTime(g.game_time)).filter((t): t is string => !!t));
  const time = times.size === 1 ? ` · ${[...times][0]}` : '';
  return `${wd ? `${wd} ` : ''}${short(only)}${time}`;
}
