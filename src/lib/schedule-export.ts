/**
 * Build the season's schedule as an Excel workbook (server-only — pulls in
 * the xlsx library). Sheets, all right-to-left:
 *   • תאריכי מחזורים — each round's date(s) for צפון and דרום, side by side
 *   • כל המשחקים     — every fixture
 *   • מחוז צפון / מחוז דרום — the same, one sheet per division
 */
import * as XLSX from 'xlsx';
import type { ScheduleEntry } from '@/lib/libi-schedule';
import {
  DIVISION_HE,
  formatDatesWithDay,
  formatIsoDate,
  hebrewWeekday,
  sortSchedule,
  summarizeRounds,
} from '@/lib/schedule-format';

export type GameResult = {
  status: string | null;
  home_score: number | null;
  away_score: number | null;
};

const GAMES_HEADER = ['מחזור', 'תאריך', 'יום', 'שעה', 'מחוז', 'קבוצת בית', 'קבוצת חוץ', 'מיקום', 'תוצאה (בית:חוץ)'];
const GAMES_COLS = [7, 12, 8, 7, 7, 26, 26, 20, 15].map((wch) => ({ wch }));

const ROUNDS_HEADER = ['מחזור', 'תאריך — מחוז צפון', 'תאריך — מחוז דרום', 'משחקים בצפון', 'משחקים בדרום'];
const ROUNDS_COLS = [7, 30, 30, 13, 13].map((wch) => ({ wch }));

function sheet(header: string[], rows: (string | number)[][], cols: { wch: number }[]) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = cols;
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
  return ws;
}

function gameRow(e: ScheduleEntry, result: GameResult | undefined): (string | number)[] {
  const played =
    result?.status === 'Finished' && result.home_score != null && result.away_score != null;
  return [
    e.round,
    formatIsoDate(e.date),
    hebrewWeekday(e.date),
    e.time ? e.time.slice(0, 5) : '',
    DIVISION_HE[e.division],
    e.homeTeam,
    e.awayTeam,
    e.location && e.location !== 'TBD' ? e.location : '',
    played ? `${result!.home_score}:${result!.away_score}` : '',
  ];
}

export function buildScheduleWorkbook(
  schedule: ScheduleEntry[],
  resultOf: (e: ScheduleEntry) => GameResult | undefined = () => undefined,
): Buffer {
  const sorted = sortSchedule(schedule);
  const games = (entries: ScheduleEntry[]) =>
    sheet(GAMES_HEADER, entries.map((e) => gameRow(e, resultOf(e))), GAMES_COLS);

  const rounds = summarizeRounds(sorted).map((r) => [
    r.round,
    formatDatesWithDay(r.North.dates),
    formatDatesWithDay(r.South.dates),
    r.North.games.length,
    r.South.games.length,
  ]);

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // open right-to-left in Excel
  XLSX.utils.book_append_sheet(wb, sheet(ROUNDS_HEADER, rounds, ROUNDS_COLS), 'תאריכי מחזורים');
  XLSX.utils.book_append_sheet(wb, games(sorted), 'כל המשחקים');
  XLSX.utils.book_append_sheet(wb, games(sorted.filter((e) => e.division === 'North')), 'מחוז צפון');
  XLSX.utils.book_append_sheet(wb, games(sorted.filter((e) => e.division === 'South')), 'מחוז דרום');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
