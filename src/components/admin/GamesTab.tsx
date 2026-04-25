'use client';

import { useState, useTransition } from 'react';
import { updateGameScore, updateGameDetails, resetAllGameDetails } from '@/app/admin/actions';
import type { GameStatus, GameWithTeams } from '@/types';
import BulkImportButton from './BulkImportButton';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';

const STATUS_OPTIONS: GameStatus[] = ['Scheduled', 'Live', 'Finished'];

const STATUS_COLORS: Record<GameStatus, string> = {
  Scheduled: 'bg-blue-900/50 text-blue-300',
  Live:      'bg-red-900/50  text-red-400',
  Finished:  'bg-gray-800    text-gray-400',
};

// ── Build date → round map from schedule ─────────────────────────────────────
const DATE_TO_ROUND: Record<string, number> = {};
for (const g of LIBI_SCHEDULE) {
  if (!DATE_TO_ROUND[g.date]) DATE_TO_ROUND[g.date] = g.round;
}

function getRoundForGame(game: GameWithTeams): number {
  return DATE_TO_ROUND[game.game_date] ?? 0;
}

interface Props {
  games: GameWithTeams[];
}

// ── Reset All button ──────────────────────────────────────────────────────────
function ResetAllButton() {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok?: boolean; msg?: string }>({});
  const [confirmed, setConfirmed] = useState(false);

  function handleClick() {
    if (!confirmed) { setConfirmed(true); return; }
    setFeedback({});
    startTransition(async () => {
      const result = await resetAllGameDetails();
      if (result?.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({ ok: true, msg: 'כל המשחקים עודכנו ל-TBD!' });
      }
      setConfirmed(false);
    });
  }

  return (
    <div className="rounded-2xl border border-yellow-600/30 bg-yellow-900/10 p-4">
      <p className="mb-2 text-xs text-yellow-400/80">
        🔄 איפוס שעה ומיקום לכל המשחקים — יציג &quot;TBD / יתווסף בקרוב&quot; עד שתעדכן ידנית
      </p>
      {feedback.msg && (
        <p className={`mb-2 rounded-lg px-3 py-2 text-sm ${feedback.ok ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          {feedback.msg}
        </p>
      )}
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`h-10 w-full rounded-xl text-sm font-bold transition active:scale-[0.98] disabled:opacity-60 ${
          confirmed
            ? 'bg-yellow-500 text-black'
            : 'border border-yellow-600/50 text-yellow-400 hover:bg-yellow-600/20'
        }`}
      >
        {isPending ? 'מאפס…' : confirmed ? '⚠️ לחץ שוב לאישור' : '🔄 אפס שעה ומיקום לכל המשחקים'}
      </button>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function GamesTab({ games }: Props) {
  // Group games by round number
  const roundMap = new Map<number, GameWithTeams[]>();
  for (const g of games) {
    const r = getRoundForGame(g);
    if (!roundMap.has(r)) roundMap.set(r, []);
    roundMap.get(r)!.push(g);
  }

  // Find the "active" round: lowest round that has any non-Finished game
  const allRounds = [...roundMap.keys()].sort((a, b) => a - b);
  const activeRound = allRounds.find(r =>
    roundMap.get(r)!.some(g => g.status !== 'Finished')
  ) ?? allRounds[allRounds.length - 1] ?? 0;

  // Display order: chronological ascending — last played at the top,
  // then the next round, then the rest of the season. The active round
  // stays at the start (it's the lowest non-Finished round, so it's
  // already first in the ascending list); the visual "← הבא" badge is
  // applied via the isActive prop on the section.
  const displayRounds = [...allRounds].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Game Management</h2>
      <BulkImportButton />
      <ResetAllButton />

      {games.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          No active games found. Import the schedule above or add games manually.
        </div>
      ) : (
        <div className="space-y-3">
          {displayRounds.map(round => (
            <RoundSection
              key={round}
              round={round}
              games={roundMap.get(round)!}
              defaultOpen={false}
              isActive={round === activeRound}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Round collapsible section ─────────────────────────────────────────────────
function RoundSection({
  round, games, defaultOpen, isActive,
}: {
  round: number;
  games: GameWithTeams[];
  defaultOpen: boolean;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const total    = games.length;
  const finished = games.filter(g => g.status === 'Finished').length;
  const live     = games.filter(g => g.status === 'Live').length;
  const date     = games[0]?.game_date
    ? new Date(games[0].game_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className={`overflow-hidden rounded-2xl border ${
      isActive
        ? 'border-orange-500/40 bg-orange-500/[0.04]'
        : 'border-gray-800 bg-gray-900/40'
    }`}>
      {/* Round header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
            isActive
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : finished === total
              ? 'bg-gray-700/60 text-gray-400 border border-gray-700'
              : 'bg-blue-900/30 text-blue-400 border border-blue-700/30'
          }`}>
            {isActive ? '← הבא' : finished === total ? '✓' : `${finished}/${total}`}
          </span>
          {live > 0 && (
            <span className="animate-pulse text-xs font-black px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-700/30">
              🔴 LIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-sm font-black ${isActive ? 'text-orange-400' : 'text-white'}`}>
              מחזור {round === 0 ? '—' : round}
            </p>
            {date && <p className="text-xs font-bold text-gray-500">{date}</p>}
          </div>
          <span className={`text-gray-500 transition-transform duration-200 text-xs ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {/* Games list */}
      {open && (
        <div className="border-t border-gray-800/60 divide-y divide-gray-800/60">
          {games.map(game => (
            <GameScoreCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Per-game card ─────────────────────────────────────────────────────────────
function GameScoreCard({ game }: { game: GameWithTeams }) {
  const [open, setOpen] = useState(false);
  const [homeScore, setHomeScore] = useState(String(game.home_score));
  const [awayScore, setAwayScore] = useState(String(game.away_score));
  const [status, setStatus] = useState<GameStatus>(game.status);
  const [gameTime, setGameTime] = useState(game.game_time ?? '');
  const [location, setLocation] = useState(game.location ?? '');
  const [feedback, setFeedback] = useState<{ ok?: boolean; msg?: string }>({});
  const [detailsFeedback, setDetailsFeedback] = useState<{ ok?: boolean; msg?: string }>({});
  const [isPending, startTransition] = useTransition();
  const [isDetailsPending, startDetailsTransition] = useTransition();

  function handleSave() {
    const hs = parseInt(homeScore, 10);
    const as_ = parseInt(awayScore, 10);
    if (isNaN(hs) || isNaN(as_)) {
      setFeedback({ ok: false, msg: 'Scores must be valid numbers.' });
      return;
    }
    setFeedback({});
    startTransition(async () => {
      const result = await updateGameScore(game.id, hs, as_, status);
      if (result?.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({ ok: true, msg: 'Saved!' });
        setOpen(false);
      }
    });
  }

  function handleSaveDetails() {
    setDetailsFeedback({});
    startDetailsTransition(async () => {
      const result = await updateGameDetails(game.id, gameTime, location);
      if (result?.error) {
        setDetailsFeedback({ ok: false, msg: result.error });
      } else {
        setDetailsFeedback({ ok: true, msg: 'Updated!' });
      }
    });
  }

  const homeTeam = game.home_team.name;
  const awayTeam = game.away_team.name;
  const hasTime = game.game_time && game.game_time !== '00:00:00';
  const dateStr = new Date(`${game.game_date}T${hasTime ? game.game_time : '00:00:00'}`).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    ...(hasTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
  }) + (hasTime ? '' : ' · TBD');

  return (
    <div className="bg-transparent">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white text-sm">
            {homeTeam} <span className="text-gray-500">vs</span> {awayTeam}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{dateStr} · {game.location}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {game.status === 'Finished' && (
            <span className="text-xs text-gray-500 tabular-nums">
              {game.home_score} – {game.away_score}
            </span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[game.status]}`}>
            {game.status}
          </span>
          <button
            onClick={() => setOpen(v => !v)}
            className="h-9 rounded-xl bg-orange-500 px-3 text-sm font-semibold text-white transition hover:bg-orange-600 active:scale-95"
          >
            {open ? 'ביטול' : 'Edit Score'}
          </button>
        </div>
      </div>

      {/* Expandable edit form */}
      {open && (
        <div className="border-t border-gray-800/60 bg-gray-950 p-4">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <ScoreInput label={homeTeam} value={homeScore} onChange={setHomeScore} />
            <ScoreInput label={awayTeam} value={awayScore} onChange={setAwayScore} />
          </div>

          <div className="mb-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Status</p>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`h-11 flex-1 rounded-xl text-sm font-semibold transition active:scale-95 ${
                    status === s
                      ? 'bg-orange-500 text-white'
                      : 'border border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">Time</p>
              <input
                type="time"
                value={gameTime}
                onChange={e => setGameTime(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">Location</p>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Arena name"
                className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>

          {detailsFeedback.msg && (
            <p className={`mb-2 rounded-lg px-4 py-2 text-sm ${detailsFeedback.ok ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
              {detailsFeedback.msg}
            </p>
          )}
          <button
            onClick={handleSaveDetails}
            disabled={isDetailsPending}
            className="mb-5 h-10 w-full rounded-xl border border-blue-600 text-sm font-semibold text-blue-400 transition hover:bg-blue-600 hover:text-white active:scale-[0.98] disabled:opacity-60"
          >
            {isDetailsPending ? 'Applying…' : '📍 Apply Time & Location'}
          </button>

          {feedback.msg && (
            <p className={`mb-3 rounded-lg px-4 py-2.5 text-sm ${feedback.ok ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
              {feedback.msg}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="h-12 w-full rounded-xl bg-green-600 text-base font-bold text-white transition hover:bg-green-500 active:scale-[0.98] disabled:opacity-60"
          >
            {isPending ? 'Saving…' : '✓ Save Score'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Score input ───────────────────────────────────────────────────────────────
function ScoreInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 truncate text-xs font-medium text-gray-400">{label}</p>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-16 w-full rounded-xl border border-gray-700 bg-gray-900 text-center text-2xl font-bold text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
      />
    </div>
  );
}
