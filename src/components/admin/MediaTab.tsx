'use client';

import { useMemo, useState, useTransition } from 'react';
import { updateVideoUrl } from '@/app/admin/actions';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import type { GameWithTeams } from '@/types';

interface Props {
  games: GameWithTeams[];
}

// Map game_date (YYYY-MM-DD) → canonical round number from LIBI_SCHEDULE.
// Built once per render and shared across all cards.
const ROUND_OF_DATE: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const e of LIBI_SCHEDULE) {
    if (m[e.date] === undefined) m[e.date] = e.round;
  }
  return m;
})();

// Inverse: round number → canonical YYYY-MM-DD date.
const DATE_OF_ROUND: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  for (const e of LIBI_SCHEDULE) {
    if (m[e.round] === undefined) m[e.round] = e.date;
  }
  return m;
})();

// Convert YYYY-MM-DD → DD.M.YY (the site's display format).
function fmtRoundDate(iso: string | undefined): string {
  if (!iso) return '';
  const [y, mo, d] = iso.split('-');
  if (!y || !mo || !d) return '';
  return `${parseInt(d, 10)}.${parseInt(mo, 10)}.${y.slice(2)}`;
}

// Today's date in the same YYYY-MM-DD format that games.game_date uses.
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type GroupedRound = {
  round: number;        // 0 = "other" (cup games, friendlies, anything not in LIBI_SCHEDULE)
  games: GameWithTeams[];
};

function groupByRound(games: GameWithTeams[]): GroupedRound[] {
  const byRound = new Map<number, GameWithTeams[]>();
  for (const g of games) {
    const r = ROUND_OF_DATE[g.game_date] ?? 0;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(g);
  }
  // Descending: latest round first, "other" (0) last.
  return [...byRound.entries()]
    .sort((a, b) => {
      if (a[0] === 0) return 1;
      if (b[0] === 0) return -1;
      return b[0] - a[0];
    })
    .map(([round, games]) => ({ round, games }));
}

export default function MediaTab({ games }: Props) {
  const today = todayISO();

  // Split into upcoming (date >= today AND not Finished) vs previous (everything else).
  // Both are sorted desc by round, then by date desc within each round.
  const { upcoming, previous } = useMemo(() => {
    const up: GameWithTeams[] = [];
    const pv: GameWithTeams[] = [];
    for (const g of games) {
      if (g.status !== 'Finished' && g.game_date >= today) up.push(g);
      else pv.push(g);
    }
    return {
      upcoming: groupByRound(up),
      previous: groupByRound(pv),
    };
  }, [games, today]);

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">סנכרון מדיה</h2>
        <p className="mt-1 text-sm text-slate-500">
          צרף קישור וידאו (YouTube וכו׳) לכל משחק. המשחקים מקובצים לפי מחזורים.
        </p>
      </div>

      {games.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
          לא נמצאו משחקים.
        </p>
      )}

      {upcoming.length > 0 && (
        <Section
          title="משחקים קרובים"
          subtitle={`${upcoming.reduce((s, r) => s + r.games.length, 0)} משחקים · ${upcoming.length} מחזורים`}
          tone="upcoming"
          defaultOpen
        >
          {upcoming.map(({ round, games }) => (
            <RoundGroup key={`up-${round}`} round={round} games={games} defaultOpen={round === upcoming[0].round} />
          ))}
        </Section>
      )}

      {previous.length > 0 && (
        <Section
          title="משחקים קודמים"
          subtitle={`${previous.reduce((s, r) => s + r.games.length, 0)} משחקים · ${previous.length} מחזורים`}
          tone="previous"
          defaultOpen={false}
        >
          {previous.map(({ round, games }) => (
            <RoundGroup key={`pv-${round}`} round={round} games={games} defaultOpen={false} />
          ))}
        </Section>
      )}
    </div>
  );
}

// ── Top-level collapsible section ────────────────────────────────────────────

function Section({
  title,
  subtitle,
  tone,
  defaultOpen,
  children,
}: {
  title: string;
  subtitle: string;
  tone: 'upcoming' | 'previous';
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const accent =
    tone === 'upcoming'
      ? 'border-orange-200 bg-orange-50/60'
      : 'border-slate-200 bg-slate-50';
  const dot = tone === 'upcoming' ? 'bg-orange-500' : 'bg-slate-400';

  return (
    <details open={defaultOpen} className={`group rounded-2xl border ${accent} overflow-hidden`}>
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 hover:bg-white/40">
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <span className="text-xs font-medium text-slate-500">{subtitle}</span>
        </div>
        <span className="text-slate-400 transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </details>
  );
}

// ── Round group (collapsible) ────────────────────────────────────────────────

function RoundGroup({
  round,
  games,
  defaultOpen,
}: {
  round: number;
  games: GameWithTeams[];
  defaultOpen: boolean;
}) {
  const label = round === 0 ? 'משחקים נוספים' : `מחזור ${round}`;
  // Date label: prefer the canonical LIBI_SCHEDULE date for the round;
  // fall back to the games' own game_date (formatted DD.M.YY) when there
  // is no schedule entry (e.g. cup/friendly games grouped under round 0).
  const dateLabel = round !== 0
    ? fmtRoundDate(DATE_OF_ROUND[round])
    : fmtRoundDate(games[0]?.game_date);
  return (
    <details open={defaultOpen} className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{label}</span>
          {dateLabel && (
            <span className="text-xs font-medium text-slate-500">· {dateLabel}</span>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            {games.length}
          </span>
        </div>
        <span className="text-slate-400 transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="divide-y divide-slate-100 border-t border-slate-100">
        {games.map((g) => (
          <VideoUrlRow key={g.id} game={g} />
        ))}
      </div>
    </details>
  );
}

// ── Per-game row ─────────────────────────────────────────────────────────────

function VideoUrlRow({ game }: { game: GameWithTeams }) {
  const [url, setUrl] = useState(game.video_url ?? '');
  const [feedback, setFeedback] = useState<{ ok?: boolean; msg?: string }>({});
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setFeedback({});
    startTransition(async () => {
      const result = await updateVideoUrl(game.id, url);
      if (result?.error) setFeedback({ ok: false, msg: result.error });
      else setFeedback({ ok: true, msg: url ? 'נשמר ✓' : 'הקישור נמחק' });
    });
  }

  const dateStr = new Date(`${game.game_date}T${game.game_time || '00:00:00'}`).toLocaleDateString(
    'he-IL',
    { weekday: 'short', month: 'short', day: 'numeric' },
  );
  const timeStr = game.game_time && !game.game_time.startsWith('19:00') && game.game_time !== '00:00:00'
    ? game.game_time.slice(0, 5)
    : null;
  const locationStr = game.location && game.location !== 'TBD' ? game.location : null;

  const isFinished = game.status === 'Finished';

  return (
    <div className="px-4 py-3">
      {/* Game header */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            {game.home_team.name} <span className="font-normal text-slate-400">vs</span> {game.away_team.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {dateStr}
            {timeStr && <> · {timeStr}</>}
            {locationStr && <> · 📍 {locationStr}</>}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
            isFinished
              ? 'bg-slate-100 text-slate-600'
              : game.status === 'Live'
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {game.status}
        </span>
      </div>

      {/* URL input + save */}
      <div dir="ltr" className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🎥</span>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFeedback({});
            }}
            placeholder="https://youtube.com/watch?v=…"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="h-10 shrink-0 rounded-lg bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600 active:scale-95 disabled:opacity-60"
        >
          {isPending ? '…' : 'שמור'}
        </button>
      </div>

      {/* Inline feedback */}
      {feedback.msg && (
        <p className={`mt-1.5 text-xs font-medium ${feedback.ok ? 'text-green-600' : 'text-red-600'}`}>
          {feedback.msg}
        </p>
      )}

      {/* Existing link preview */}
      {url && !feedback.msg && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="mt-1.5 block truncate text-xs text-blue-600 underline underline-offset-2 hover:text-blue-700"
        >
          {url}
        </a>
      )}
    </div>
  );
}
