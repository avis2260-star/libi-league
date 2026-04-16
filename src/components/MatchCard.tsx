import Image from 'next/image';
import type { Game } from '@/types';

interface MatchCardProps {
  game: Game;
}

const STATUS_STYLES: Record<Game['status'], string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  Live:      'bg-red-100  text-red-600 animate-pulse',
  Finished:  'bg-gray-100 text-gray-500',
};

function formatGameTime(date: string, time: string): string {
  const dt = new Date(`${date}T${time}`);
  return dt.toLocaleString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    hour:    'numeric',
    minute:  '2-digit',
    hour12:  true,
  });
}

export default function MatchCard({ game }: MatchCardProps) {
  const { home_team, away_team, game_date, game_time, location, status, home_score, away_score } =
    game;

  const isFinished  = status === 'Finished';
  const isLive      = status === 'Live';
  const showScores  = isFinished || isLive;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      {/* Status + time row */}
      <div className="flex items-center justify-between text-sm">
        <span className={`rounded-full px-3 py-0.5 font-semibold ${STATUS_STYLES[status]}`}>
          {status === 'Live' ? '● LIVE' : status}
        </span>
        <span className="text-gray-400">{formatGameTime(game_date, game_time)}</span>
      </div>

      {/* Teams row */}
      <div className="flex items-center justify-between gap-4">
        {/* Home team */}
        <TeamSlot
          name={home_team?.name ?? 'Home'}
          logoUrl={home_team?.logo_url}
          score={showScores ? home_score : undefined}
          isWinner={isFinished && home_score > away_score}
        />

        {/* VS / scores divider */}
        <div className="flex flex-col items-center">
          {showScores ? (
            <span className="text-2xl font-bold tabular-nums text-gray-800 font-stats">
              {home_score} – {away_score}
            </span>
          ) : (
            <span className="text-lg font-semibold text-gray-400">VS</span>
          )}
        </div>

        {/* Away team */}
        <TeamSlot
          name={away_team?.name ?? 'Away'}
          logoUrl={away_team?.logo_url}
          score={showScores ? away_score : undefined}
          isWinner={isFinished && away_score > home_score}
          reverse
        />
      </div>

      {/* Location */}
      <p className="text-center text-xs text-gray-400 font-body">
        📍 {location}
      </p>
    </article>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

interface TeamSlotProps {
  name: string;
  logoUrl?: string | null;
  score?: number;
  isWinner?: boolean;
  reverse?: boolean;
}

function TeamSlot({ name, logoUrl, score, isWinner, reverse }: TeamSlotProps) {
  return (
    <div
      className={`flex flex-1 flex-col items-center gap-2 ${reverse ? 'items-center' : 'items-center'}`}
    >
      {/* Logo */}
      <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-gray-100 bg-gray-50">
        {logoUrl ? (
          <Image src={logoUrl} alt={`${name} logo`} fill className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-300">
            {name.charAt(0)}
          </span>
        )}
      </div>

      {/* Name */}
      <span
        className={`text-center text-sm font-semibold leading-tight font-heading ${
          isWinner ? 'text-green-600' : 'text-gray-700'
        }`}
      >
        {name}
        {isWinner && <span className="ml-1 text-xs">🏆</span>}
      </span>
    </div>
  );
}
