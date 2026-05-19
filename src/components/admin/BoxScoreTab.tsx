'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import { saveBoxScore, type PlayerStatInput } from '@/app/admin/actions';
import { supabase } from '@/lib/supabase';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import type { GameWithTeams } from '@/types';

interface Props {
  games: GameWithTeams[];
  initialGameId?: string;
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

// game_date (YYYY-MM-DD) → canonical round number from LIBI_SCHEDULE.
const ROUND_OF_DATE: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const e of LIBI_SCHEDULE) {
    if (m[e.date] === undefined) m[e.date] = e.round;
  }
  return m;
})();

// round → canonical date.
const DATE_OF_ROUND: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  for (const e of LIBI_SCHEDULE) {
    if (m[e.round] === undefined) m[e.round] = e.date;
  }
  return m;
})();

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtRoundDate(iso: string | undefined): string {
  if (!iso) return '';
  const [y, mo, d] = iso.split('-');
  if (!y || !mo || !d) return '';
  return `${parseInt(d, 10)}.${parseInt(mo, 10)}.${y.slice(2)}`;
}

type GroupedRound = { round: number; games: GameWithTeams[] };

function groupByRound(games: GameWithTeams[]): GroupedRound[] {
  const byRound = new Map<number, GameWithTeams[]>();
  for (const g of games) {
    const r = ROUND_OF_DATE[g.game_date] ?? 0;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(g);
  }
  // Descending: latest round first; "other" (round 0) at the bottom.
  return [...byRound.entries()]
    .sort((a, b) => {
      if (a[0] === 0) return 1;
      if (b[0] === 0) return -1;
      return b[0] - a[0];
    })
    .map(([round, games]) => ({ round, games }));
}

export default function BoxScoreTab({ games, initialGameId }: Props) {
  const [selectedGameId, setSelectedGameId] = useState(initialGameId ?? '');
  const [selectedTeamSide, setSelectedTeamSide] = useState<'home' | 'away' | ''>('');
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [feedback, setFeedback] = useState<{ ok?: boolean; msg?: string }>({});
  const [isPending, startTransition] = useTransition();

  const selectedGame = games.find((g) => g.id === selectedGameId);
  const today = todayISO();

  // Split into upcoming (status != Finished AND date >= today) vs previous.
  // Then group each by round, latest round first.
  const { upcoming, previous } = useMemo(() => {
    const up: GameWithTeams[] = [];
    const pv: GameWithTeams[] = [];
    for (const g of games) {
      if (g.status !== 'Finished' && g.game_date >= today) up.push(g);
      else pv.push(g);
    }
    return { upcoming: groupByRound(up), previous: groupByRound(pv) };
  }, [games, today]);

  // Fetch players when game + team side are both selected
  useEffect(() => {
    if (!selectedGame || !selectedTeamSide) {
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

  function pickGame(id: string) {
    setSelectedGameId(id);
    setSelectedTeamSide('');
    setFeedback({});
    // On mobile, scroll the team picker into view after a beat.
    setTimeout(() => {
      document.getElementById('boxscore-step-2')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function clearGame() {
    setSelectedGameId('');
    setSelectedTeamSide('');
    setStats([]);
    setFeedback({});
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
        setFeedback({ ok: true, msg: '✅ הציון נשמר' });
      }
    });
  }

  return (
    <div dir="rtl" className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-white">📝 הזנת ציון משחק</h2>
        <p className="mt-1 text-sm font-bold text-[#8aaac8]">
          המשחקים מקובצים לפי מחזורים. בחר משחק, ואז את הקבוצה שעבורה אתה מזין סטטיסטיקה.
        </p>
      </div>

      {/* ── Step 1: pick a game ── */}
      {!selectedGame && (
        <div className="space-y-4">
          {games.length === 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-10 text-center text-sm font-bold text-[#8aaac8]">
              לא נמצאו משחקים.
            </div>
          )}

          {upcoming.length > 0 && (
            <Section
              title="משחקים קרובים"
              subtitle={`${upcoming.reduce((s, r) => s + r.games.length, 0)} משחקים · ${upcoming.length} מחזורים`}
              tone="upcoming"
              defaultOpen
            >
              {upcoming.map(({ round, games }, idx) => (
                <RoundGroup
                  key={`up-${round}`}
                  round={round}
                  games={games}
                  onPick={pickGame}
                  defaultOpen={idx === 0}
                />
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
                <RoundGroup
                  key={`pv-${round}`}
                  round={round}
                  games={games}
                  onPick={pickGame}
                  defaultOpen={false}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* ── Once a game is picked, show the "change game" header + team selector ── */}
      {selectedGame && (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/[0.05] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-wider text-orange-400 uppercase">משחק נבחר</p>
              <p className="text-base font-black text-white truncate">
                {selectedGame.home_team.name} <span className="text-[#5a7a9a] font-bold">vs</span> {selectedGame.away_team.name}
              </p>
              <p className="text-xs font-bold text-[#8aaac8]">
                {fmtRoundDate(selectedGame.game_date)}
                {(ROUND_OF_DATE[selectedGame.game_date] ?? 0) > 0 && <> · מחזור {ROUND_OF_DATE[selectedGame.game_date]}</>}
              </p>
            </div>
            <button
              onClick={clearGame}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-black text-[#8aaac8] hover:text-white hover:bg-white/[0.04] transition"
            >
              ← החלף משחק
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select team */}
      {selectedGame && (
        <div id="boxscore-step-2">
          <p className="mb-2 text-sm font-black text-[#8aaac8]">2. בחר קבוצה</p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { side: 'home' as const, team: selectedGame.home_team, label: 'בית' },
                { side: 'away' as const, team: selectedGame.away_team, label: 'חוץ' },
              ] as const
            ).map(({ side, team, label }) => (
              <button
                key={side}
                onClick={() => {
                  setSelectedTeamSide(side);
                  setFeedback({});
                }}
                className={`h-14 rounded-xl border text-sm font-black transition active:scale-95 ${
                  selectedTeamSide === side
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-white/10 bg-white/[0.03] text-[#c8d8e8] hover:border-white/20'
                }`}
              >
                <span className="block text-[10px] font-black tracking-wider text-[#5a7a9a] uppercase">{label}</span>
                {team.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Player stat grid */}
      {loadingPlayers && (
        <p className="text-center text-sm font-bold text-[#8aaac8]">טוען שחקנים…</p>
      )}

      {stats.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-black text-[#8aaac8]">3. הזן סטטיסטיקה</p>

          {/* Column headers */}
          <div className="mb-2 grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] gap-2 px-1 text-xs font-black uppercase tracking-wide text-[#5a7a9a]">
            <span>שחקן</span>
            <span className="text-center">נק׳</span>
            <span className="text-center">3PT</span>
            <span className="text-center">פאולים</span>
          </div>

          <div className="space-y-2">
            {stats.map((row) => (
              <div
                key={row.playerId}
                className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0c1825] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{row.name}</p>
                  {row.jersey !== null && (
                    <p className="text-xs font-bold text-[#5a7a9a]">#{row.jersey}</p>
                  )}
                </div>
                <StatCell value={row.points}  onChange={(v) => updateStat(row.playerId, 'points',  v)} />
                <StatCell value={row.threePt} onChange={(v) => updateStat(row.playerId, 'threePt', v)} />
                <StatCell value={row.fouls}   onChange={(v) => updateStat(row.playerId, 'fouls',   v)} />
              </div>
            ))}
          </div>

          {/* Team totals */}
          <div className="mt-3 grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem] gap-2 rounded-xl border border-orange-500/30 bg-orange-500/[0.06] px-3 py-2 text-sm font-black text-orange-400">
            <span>סה״כ</span>
            <span className="text-center">{stats.reduce((s, r) => s + r.points, 0)}</span>
            <span className="text-center">{stats.reduce((s, r) => s + r.threePt, 0)}</span>
            <span className="text-center">{stats.reduce((s, r) => s + r.fouls, 0)}</span>
          </div>

          {feedback.msg && (
            <p className={`mt-3 rounded-lg px-4 py-2.5 text-sm font-black ${
              feedback.ok ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
            }`}>
              {feedback.msg}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={isPending}
            className="mt-4 h-14 w-full rounded-xl bg-orange-500 text-base font-black text-white transition hover:bg-orange-400 active:scale-[0.98] disabled:opacity-60"
          >
            {isPending ? 'שומר…' : '💾 שמור את הציון'}
          </button>
        </div>
      )}

      {selectedGame && selectedTeamSide && !loadingPlayers && stats.length === 0 && (
        <p className="rounded-xl border border-white/[0.07] py-10 text-center text-sm font-bold text-[#8aaac8]">
          לא נמצאו שחקנים לקבוצה זו. הוסף שחקנים תחילה.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────── helpers ───────────────────────────

function Section({
  title, subtitle, tone, defaultOpen, children,
}: {
  title: string; subtitle: string; tone: 'upcoming' | 'previous'; defaultOpen: boolean; children: React.ReactNode;
}) {
  const accent =
    tone === 'upcoming'
      ? 'border-orange-500/30 bg-orange-500/[0.06]'
      : 'border-white/[0.08] bg-white/[0.03]';
  const dot = tone === 'upcoming' ? 'bg-orange-500' : 'bg-[#5a7a9a]';
  return (
    <details open={defaultOpen} className={`group rounded-2xl border ${accent} overflow-hidden`}>
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
          <h3 className="text-base font-black text-white">{title}</h3>
          <span className="text-xs font-bold text-[#8aaac8]">{subtitle}</span>
        </div>
        <span className="text-orange-400 transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </details>
  );
}

function RoundGroup({
  round, games, defaultOpen, onPick,
}: {
  round: number; games: GameWithTeams[]; defaultOpen: boolean; onPick: (id: string) => void;
}) {
  const label = round === 0 ? 'משחקים נוספים' : `מחזור ${round}`;
  const dateLabel = round !== 0
    ? fmtRoundDate(DATE_OF_ROUND[round])
    : fmtRoundDate(games[0]?.game_date);
  return (
    <details open={defaultOpen} className="group rounded-xl border border-white/[0.07] bg-[#0c1825]">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-2.5 hover:bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white">{label}</span>
          {dateLabel && <span className="text-xs font-bold text-[#8aaac8]">· {dateLabel}</span>}
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-black text-[#c8d8e8]">
            {games.length}
          </span>
        </div>
        <span className="text-orange-400 transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => onPick(g.id)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right hover:bg-orange-500/[0.06] transition-colors"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {g.home_team.name} <span className="text-[#5a7a9a] font-bold">vs</span> {g.away_team.name}
              </p>
              <p className="mt-0.5 text-xs font-bold text-[#8aaac8]">
                {fmtRoundDate(g.game_date)}
                {g.location && g.location !== 'TBD' && <> · 📍 {g.location}</>}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusPill status={g.status} />
              {g.status === 'Finished' && (
                <span className="font-stats text-base font-black text-orange-400 tabular-nums">
                  {g.home_score} : {g.away_score}
                </span>
              )}
              <span className="text-orange-400 text-sm">←</span>
            </div>
          </button>
        ))}
      </div>
    </details>
  );
}

function StatusPill({ status }: { status: string }) {
  const isFinished = status === 'Finished';
  const isLive     = status === 'Live';
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
      isFinished ? 'bg-white/[0.06] text-[#8aaac8]'
      : isLive   ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
      :            'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
    }`}>
      {status}
    </span>
  );
}

function StatCell({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] text-center text-base font-black text-white focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
    />
  );
}
