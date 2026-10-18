'use client';

import { useState } from 'react';
import type { ScheduleEntry } from '@/lib/libi-schedule';
import {
  DIVISION_HE,
  formatDatesWithDay,
  formatIsoDate,
  summarizeRounds,
  type Division,
  type DivisionRound,
} from '@/lib/schedule-format';

const DIVISIONS: Division[] = ['North', 'South'];

const CHIP: Record<Division, string> = {
  North: 'bg-blue-500/15 text-blue-300',
  South: 'bg-orange-500/15 text-orange-300',
};

/**
 * The season's game dates for both divisions, round by round (each round
 * expands to its fixtures), plus a button that downloads the whole schedule
 * as an Excel workbook.
 */
export default function SeasonSchedulePanel({
  season,
  schedule,
}: {
  season: string;
  schedule: ScheduleEntry[];
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rounds = summarizeRounds(schedule);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/export-schedule?season=${encodeURIComponent(season)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'הייצוא נכשל');
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `לוח משחקים ${season}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section dir="rtl" className="space-y-4 rounded-xl border border-gray-700 bg-gray-900/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white">📅 תאריכי המשחקים · עונת {season}</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {schedule.length > 0
              ? `${rounds.length} מחזורים · ${schedule.length} משחקים · מחוז צפון ומחוז דרום. לחץ על מחזור כדי לראות את המשחקים.`
              : 'עדיין אין לוח משחקים לעונה זו — העלה את קובץ ה-Excel של העונה.'}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || schedule.length === 0}
          className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {exporting ? 'מייצא...' : '📥 ייצוא ל-Excel'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm font-medium text-red-300">{error}</p>
      )}

      {rounds.length > 0 && (
        <div className="space-y-2">
          {rounds.map((r) => (
            <details key={r.round} className="group rounded-lg border border-gray-700/70 bg-gray-800/40">
              <summary className="flex cursor-pointer select-none list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 hover:bg-white/[0.02] [&::-webkit-details-marker]:hidden">
                <span className="w-16 shrink-0 text-sm font-bold text-white">מחזור {r.round}</span>
                {DIVISIONS.map((d) => (
                  <span key={d} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CHIP[d]}`}>
                    {DIVISION_HE[d]}: {r[d].dates.length > 0 ? formatDatesWithDay(r[d].dates) : 'אין משחקים'}
                  </span>
                ))}
                <span className="ms-auto text-xs text-gray-500 transition group-open:rotate-180">▼</span>
              </summary>
              <div className="grid gap-3 border-t border-gray-700/70 px-3 py-3 sm:grid-cols-2">
                {DIVISIONS.map((d) => (
                  <DivisionGames key={d} division={d} data={r[d]} />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function DivisionGames({ division, data }: { division: Division; data: DivisionRound }) {
  const showDate = data.dates.length > 1; // a split round — say which game is when
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-bold text-gray-400">
        מחוז {DIVISION_HE[division]} · {data.games.length} משחקים
      </p>
      {data.games.length === 0 ? (
        <p className="text-xs text-gray-500">אין משחקים במחזור זה</p>
      ) : (
        <ul className="space-y-1">
          {data.games.map((g) => (
            <li
              key={`${g.homeTeam}|${g.awayTeam}|${g.date}`}
              className="flex flex-wrap items-baseline gap-x-2 text-sm text-gray-200"
            >
              <span className="min-w-0 break-words">
                {g.homeTeam} <span className="text-gray-500">נגד</span> {g.awayTeam}
              </span>
              {(showDate || g.time) && (
                <span className="text-xs text-gray-500">
                  {[showDate ? formatIsoDate(g.date) : '', g.time ? g.time.slice(0, 5) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
