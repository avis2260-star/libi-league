'use client';

import { useState, useTransition, useEffect } from 'react';
import { saveBoxScore, type PlayerStatInput } from '@/app/admin/actions';
import { supabase } from '@/lib/supabase';
import type { GameWithTeams } from '@/types';

interface Props {
  games: GameWithTeams[];
}

interface StatRow {
  playerId: string;
  name: string;
  jersey: number | null;
  teamId: string;
  points: number;
  threePt: number;
  fouls: number;
}

export default function BoxScoreTab({ games }: Props) {
  const [selectedGameId, setSelectedGameId] = useState('');
  const [selectedTeamSide, setSelectedTeamSide] = useState<'home' | 'away' | ''>('');
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [feedback, setFeedback] = useState<{ ok?: boolean; msg?: string }>({});
  const [isPending, startTransition] = useTransition();

  const selectedGame = games.find((g) => g.id === selectedGameId);

  // Fetch players when game + team side are both selected
  useEffect(() => {
    if (!selectedGame || !selectedTeamSide) {
      setPlayers([]);
      setStats([]);
      return;
    }

    const teamId =
      selectedTeamSide === 'home'
        ? selectedGame.home_team_id
        : selectedGame.away_team_id;

    setLoadingPlayers(true);
    setStats([]);

    supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('jersey_number')
      .then(({ data, error }) => {
        setLoadingPlayers(false);
        if (error || !data) return;

        // Load any existing game_stats for this game + team
        supabase
          .from('game_stats')
          .select('*')
          .eq('game_id', selectedGame.id)
          .eq('team_id', teamId)
          .then(({ data: existingStats }) => {
            const existingMap = new Map(existingStats?.map((s) => [s.player_id, s]) ?? []);
            setStats(
              data.map((p) => {
                const existing = existingMap.get(p.id);
                return {
                  playerId: p.id,
                  name: p.name,
                  jersey: p.jersey_number,
                  teamId,
                  points: existing?.points ?? 0,
                  threePt: existing?.three_pointers ?? 0,
                  fouls: existing?.fouls ?? 0,
                };
              }),
            );
          });
      });
  }, [selectedGameId, selectedTeamSide]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateStat(playerId: string, field: keyof Pick<StatRow, 'points' | 'threePt' | 'fouls'>, raw: string) {
    const val = Math.max(0, parseInt(raw, 10) || 0);
    setStats((prev) => prev.map((r) => (r.playerId === playerId ? { ...r, [field]: val } : r)));
  }

  function handleSave() {
    if (!selectedGame || !stats.length) return;
    setFeedback({});

    const payload: PlayerStatInput[] = stats.map((r) => ({
      playerId: r.playerId,
      teamId: r.teamId,
      points: r.points,
      threePt: r.threePt,
      fouls: r.fouls,
    }));

    startTransition(async () => {
      const result = await saveBoxScore(selectedGame.id, payload);
      if (result?.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({ ok: true, msg: 'Box score saved!' });
      }
    });
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">Box Score Entry</h2>

      {/* Step 1: Select game */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-400">
          1. Select Game
        </label>
        <select
          value={selectedGameId}
          onChange={(e) => {
            setSelectedGameId(e.target.value);
            setSelectedTeamSide('');
            setFeedback({});
          }}
          className="h-12 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 text-base text-white focus:border-orange-500 focus:outline-none"
        >
          <option value="">— choose a game —</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.home_team.name} vs {g.away_team.name} · {g.game_date}
            </option>
          ))}
        </select>
      </div>

      {/* Step 2: Select team */}
      {selectedGame && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-400">2. Select Team</p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { side: 'home' as const, team: selectedGame.home_team },
                { side: 'away' as const, team: selectedGame.away_team },
              ] as const
            ).map(({ side, team }) => (
              <button
                key={side}
                onClick={() => {
                  setSelectedTeamSide(side);
                  setFeedback({});
                }}
                className={`h-14 rounded-xl border text-sm font-semibold transition active:scale-95 ${
                  selectedTeamSide === side
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <span className="block text-xs text-gray-500">{side === 'home' ? 'Home' : 'Away'}</span>
                {team.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Player stat grid */}
      {loadingPlayers && (
        <p className="text-center text-sm text-gray-500">Loading players…</p>
      )}

      {stats.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-medium text-gray-400">3. Enter Stats</p>

          {/* Column headers */}
          <div className="mb-2 grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-gray-600">
            <span>Player</span>
            <span className="text-center">PTS</span>
            <span className="text-center">3PT</span>
            <span className="text-center">FLS</span>
          </div>

          <div className="space-y-2">
            {stats.map((row) => (
              <div
                key={row.playerId}
                className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2"
              >
                {/* Player name */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{row.name}</p>
                  {row.jersey !== null && (
                    <p className="text-xs text-gray-500">#{row.jersey}</p>
                  )}
                </div>

                {/* PTS */}
                <StatCell
                  value={row.points}
                  onChange={(v) => updateStat(row.playerId, 'points', v)}
                />
                {/* 3PT */}
                <StatCell
                  value={row.threePt}
                  onChange={(v) => updateStat(row.playerId, 'threePt', v)}
                />
                {/* Fouls */}
                <StatCell
                  value={row.fouls}
                  onChange={(v) => updateStat(row.playerId, 'fouls', v)}
                />
              </div>
            ))}
          </div>

          {/* Team totals */}
          <div className="mt-3 grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] gap-2 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-bold text-orange-400">
            <span>Total</span>
            <span className="text-center">{stats.reduce((s, r) => s + r.points, 0)}</span>
            <span className="text-center">{stats.reduce((s, r) => s + r.threePt, 0)}</span>
            <span className="text-center">{stats.reduce((s, r) => s + r.fouls, 0)}</span>
          </div>

          {/* Feedback */}
          {feedback.msg && (
            <p className={`mt-3 rounded-lg px-4 py-2.5 text-sm ${
              feedback.ok ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
            }`}>
              {feedback.msg}
            </p>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="mt-4 h-14 w-full rounded-xl bg-green-600 text-base font-bold text-white transition hover:bg-green-500 active:scale-[0.98] disabled:opacity-60"
          >
            {isPending ? 'Saving…' : '✓ Save Box Score'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {selectedGame && selectedTeamSide && !loadingPlayers && stats.length === 0 && (
        <p className="rounded-xl border border-gray-800 py-10 text-center text-sm text-gray-500">
          No players found for this team. Add players first.
        </p>
      )}
    </div>
  );
}

// ── Stat number cell ──────────────────────────────────────────────────────────

function StatCell({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-gray-700 bg-gray-800 text-center text-base font-bold text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
    />
  );
}
