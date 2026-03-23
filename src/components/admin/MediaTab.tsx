'use client';

import { useState, useTransition } from 'react';
import { updateVideoUrl } from '@/app/admin/actions';
import type { GameWithTeams } from '@/types';

interface Props {
  games: GameWithTeams[];
}

export default function MediaTab({ games }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Media Sync</h2>
        <p className="mt-1 text-sm text-gray-400">
          Attach a replay or highlight video URL to each game.
        </p>
      </div>

      {games.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-500">No games found.</p>
      )}

      {games.map((game) => (
        <VideoUrlCard key={game.id} game={game} />
      ))}
    </div>
  );
}

// ── Per-game video URL row ────────────────────────────────────────────────────

function VideoUrlCard({ game }: { game: GameWithTeams }) {
  const [url, setUrl] = useState(game.video_url ?? '');
  const [feedback, setFeedback] = useState<{ ok?: boolean; msg?: string }>({});
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setFeedback({});
    startTransition(async () => {
      const result = await updateVideoUrl(game.id, url);
      if (result?.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({ ok: true, msg: url ? 'Link saved!' : 'Cleared.' });
      }
    });
  }

  const dateStr = new Date(`${game.game_date}T${game.game_time}`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const isFinished = game.status === 'Finished';

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      {/* Game header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">
            {game.home_team.name} <span className="text-gray-500">vs</span> {game.away_team.name}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{dateStr} · {game.location}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          isFinished ? 'bg-gray-800 text-gray-400' :
          game.status === 'Live' ? 'bg-red-900/50 text-red-400' :
          'bg-blue-900/50 text-blue-300'
        }`}>
          {game.status}
        </span>
      </div>

      {/* URL input + save */}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            🎥
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFeedback({});
            }}
            placeholder="https://youtube.com/watch?v=…"
            className="h-12 w-full rounded-xl border border-gray-700 bg-gray-800 pl-9 pr-4 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="h-12 shrink-0 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600 active:scale-95 disabled:opacity-60"
        >
          {isPending ? '…' : 'Save'}
        </button>
      </div>

      {/* Inline feedback */}
      {feedback.msg && (
        <p className={`mt-2 text-xs ${feedback.ok ? 'text-green-400' : 'text-red-400'}`}>
          {feedback.msg}
        </p>
      )}

      {/* Existing link preview */}
      {url && !feedback.msg && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block truncate text-xs text-blue-400 underline underline-offset-2 hover:text-blue-300"
        >
          {url}
        </a>
      )}
    </div>
  );
}
