'use client';

import { useState, useTransition } from 'react';
import { updateGameScore, updateGameDetails } from '@/app/admin/actions';
import type { GameStatus, GameWithTeams } from '@/types';
import BulkImportButton from './BulkImportButton';

const STATUS_OPTIONS: GameStatus[] = ['Scheduled', 'Live', 'Finished'];

const STATUS_COLORS: Record<GameStatus, string> = {
  Scheduled: 'bg-blue-900/50 text-blue-300',
  Live:      'bg-red-900/50  text-red-400',
  Finished:  'bg-gray-800    text-gray-400',
};

interface Props {
  games: GameWithTeams[];
}

export default function GamesTab({ games }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Game Management</h2>

      {/* One-click bulk import */}
      <BulkImportButton />

      {games.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          No active games found. Import the schedule above or add games manually.
        </div>
      ) : (
        games.map((game) => (
          <GameScoreCard key={game.id} game={game} />
        ))
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
  const dateStr = new Date(`${game.game_date}T${game.game_time}`).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
      {/* Card header — always visible */}
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">
            {homeTeam} <span className="text-gray-500">vs</span> {awayTeam}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{dateStr} · {game.location}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[game.status]}`}>
            {game.status}
          </span>
          {/* Large touch target for on-court use */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="h-11 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-600 active:scale-95"
          >
            {open ? 'Cancel' : 'Edit Score'}
          </button>
        </div>
      </div>

      {/* Expandable edit form */}
      {open && (
        <div className="border-t border-gray-800 bg-gray-950 p-4">
          {/* Score inputs */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            {/* Home */}
            <ScoreInput
              label={homeTeam}
              value={homeScore}
              onChange={setHomeScore}
            />
            {/* Away */}
            <ScoreInput
              label={awayTeam}
              value={awayScore}
              onChange={setAwayScore}
            />
          </div>

          {/* Status selector */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Status
            </p>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
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

          {/* Time & Location */}
          <div className="mb-2 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">Time</p>
              <input
                type="time"
                value={gameTime}
                onChange={(e) => setGameTime(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">Location</p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Arena name"
                className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>
          </div>
          {detailsFeedback.msg && (
            <p className={`mb-2 rounded-lg px-4 py-2 text-sm ${
              detailsFeedback.ok ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
            }`}>
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

          {/* Feedback */}
          {feedback.msg && (
            <p className={`mb-3 rounded-lg px-4 py-2.5 text-sm ${
              feedback.ok ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
            }`}>
              {feedback.msg}
            </p>
          )}

          {/* Save button */}
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

// ── Score number input ────────────────────────────────────────────────────────

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 truncate text-xs font-medium text-gray-400">{label}</p>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-16 w-full rounded-xl border border-gray-700 bg-gray-900 text-center text-2xl font-bold text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
      />
    </div>
  );
}
