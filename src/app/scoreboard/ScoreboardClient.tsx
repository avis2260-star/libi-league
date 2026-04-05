'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { LiveGame, LivePlayer } from '../live/page';

// ── Types ───────────────────────────────────────────────────────────────────

type PS = { name: string; jersey: number | null; pts: number; fouls: number };
type TS = { name: string; logo: string | null; score: number; timeouts: number; players: PS[] };
type LE = { id: number; q: number; clk: string; side: 'H' | 'A'; who: string; val: string };
type Phase = 'idle' | 'ready' | 'live' | 'paused' | 'done';

// ── Constants ───────────────────────────────────────────────────────────────

const QUARTER_SEC = 10 * 60;
const SHOT_SEC = 24;
const TIMEOUT_SEC = 60;
const MAX_TO = 5;

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.max(0, s) % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function Logo({ logo, name, size }: { logo: string | null; name: string; size: number }) {
  return (
    <div
      className="shrink-0 rounded-full border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {logo ? (
        <img src={logo} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-black text-[#4a6a8a]" style={{ fontSize: Math.max(10, size * 0.4) }}>
          {[...name].find(c => c.trim()) ?? '?'}
        </span>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ScoreboardClient({
  games,
  players,
  currentRound,
}: {
  games: LiveGame[];
  players: LivePlayer[];
  currentRound: number | null;
}) {
  const [selectedGame, setSelectedGame] = useState<LiveGame | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [quarter, setQuarter] = useState(1);
  const [clock, setClock] = useState(QUARTER_SEC);
  const [shot, setShot] = useState(SHOT_SEC);
  const [toClock, setToClock] = useState(TIMEOUT_SEC);
  const [toActive, setToActive] = useState(false);
  const [home, setHome] = useState<TS>({ name: '', logo: null, score: 0, timeouts: MAX_TO, players: [] });
  const [away, setAway] = useState<TS>({ name: '', logo: null, score: 0, timeouts: MAX_TO, players: [] });
  const [log, setLog] = useState<LE[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const logId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (toRef.current) clearInterval(toRef.current);
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function teamPlayers(teamId: string): PS[] {
    const seen = new Set<string>();
    const result: PS[] = [];
    for (const p of players) {
      if (p.team_id !== teamId) continue;
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      result.push({ name: p.name, jersey: p.jersey_number, pts: 0, fouls: 0 });
    }
    return result;
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  const pushLog = useCallback(
    (side: 'H' | 'A', who: string, val: string, currentQ: number, currentClock: number) => {
      const entry: LE = {
        id: ++logId.current,
        q: currentQ,
        clk: fmtTime(currentClock),
        side,
        who,
        val,
      };
      setLog(prev => [entry, ...prev]);
    },
    []
  );

  function startGame(g: LiveGame) {
    stopTimer();
    if (toRef.current) {
      clearInterval(toRef.current);
      toRef.current = null;
    }
    setSelectedGame(g);
    setPanelOpen(false);
    setPhase('ready');
    setQuarter(1);
    setClock(QUARTER_SEC);
    setShot(SHOT_SEC);
    setToClock(TIMEOUT_SEC);
    setToActive(false);
    setLog([]);
    logId.current = 0;
    setHome({
      name: g.home_name,
      logo: g.home_logo,
      score: 0,
      timeouts: MAX_TO,
      players: teamPlayers(g.home_team_id),
    });
    setAway({
      name: g.away_name,
      logo: g.away_logo,
      score: 0,
      timeouts: MAX_TO,
      players: teamPlayers(g.away_team_id),
    });
  }

  function startTimer() {
    stopTimer();
    setPhase('live');
    timerRef.current = setInterval(() => {
      setClock(prev => {
        if (prev <= 1) {
          stopTimer();
          setPhase('paused');
          return 0;
        }
        return prev - 1;
      });
      setShot(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  }

  function pauseTimer() {
    stopTimer();
    setPhase('paused');
  }

  function nextQ() {
    stopTimer();
    setQuarter(prev => {
      const nq = prev + 1;
      if (prev >= 4) {
        setPhase('done');
        return prev;
      }
      setPhase('ready');
      setClock(QUARTER_SEC);
      setShot(SHOT_SEC);
      return nq;
    });
  }

  function callTO(side: 'H' | 'A') {
    const ts = side === 'H' ? home : away;
    if (ts.timeouts <= 0) return;
    pauseTimer();
    const setter = side === 'H' ? setHome : setAway;
    setter(t => ({ ...t, timeouts: t.timeouts - 1 }));
    setToActive(true);
    setToClock(TIMEOUT_SEC);
    if (toRef.current) clearInterval(toRef.current);
    toRef.current = setInterval(() => {
      setToClock(prev => {
        if (prev <= 1) {
          if (toRef.current) clearInterval(toRef.current);
          toRef.current = null;
          setToActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function addScore(side: 'H' | 'A', pts: number) {
    const setter = side === 'H' ? setHome : setAway;
    let capturedScore = 0;
    let capturedQ = 1;
    let capturedClock = 0;
    setter(ts => {
      capturedScore = ts.score + pts;
      return { ...ts, score: ts.score + pts };
    });
    setQuarter(q => { capturedQ = q; return q; });
    setClock(c => { capturedClock = c; return c; });
    const teamName = side === 'H' ? home.name : away.name;
    // use setTimeout to read captured values after state setters flush
    setTimeout(() => {
      pushLog(side, teamName, `+${pts}`, capturedQ, capturedClock);
    }, 0);
  }

  function addPts(side: 'H' | 'A', pi: number, pts: number) {
    const setter = side === 'H' ? setHome : setAway;
    let playerName = '';
    let capturedQ = 1;
    let capturedClock = 0;
    setter(ts => {
      const updated = ts.players.map((p, i) =>
        i === pi ? { ...p, pts: p.pts + pts } : p
      );
      playerName = ts.players[pi]?.name ?? '';
      return { ...ts, score: ts.score + pts, players: updated };
    });
    setQuarter(q => { capturedQ = q; return q; });
    setClock(c => { capturedClock = c; return c; });
    setTimeout(() => {
      pushLog(side, playerName, `+${pts}pt`, capturedQ, capturedClock);
    }, 0);
  }

  function addFoul(side: 'H' | 'A', pi: number) {
    const setter = side === 'H' ? setHome : setAway;
    let playerName = '';
    let capturedQ = 1;
    let capturedClock = 0;
    setter(ts => {
      const updated = ts.players.map((p, i) =>
        i === pi ? { ...p, fouls: p.fouls + 1 } : p
      );
      playerName = ts.players[pi]?.name ?? '';
      return { ...ts, players: updated };
    });
    setQuarter(q => { capturedQ = q; return q; });
    setClock(c => { capturedClock = c; return c; });
    setTimeout(() => {
      pushLog(side, playerName, 'FOUL', capturedQ, capturedClock);
    }, 0);
  }

  function exportCSV() {
    const rows: string[] = ['Team,Jersey,Name,Points,Fouls'];
    for (const p of home.players) {
      rows.push(`"${home.name}",${p.jersey ?? ''},${p.name},${p.pts},${p.fouls}`);
    }
    for (const p of away.players) {
      rows.push(`"${away.name}",${p.jersey ?? ''},${p.name},${p.pts},${p.fouls}`);
    }
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scoreboard-${home.name}-vs-${away.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const byRound = games.reduce<Record<number, LiveGame[]>>((acc, g) => {
    const r = g.round ?? 0;
    if (!acc[r]) acc[r] = [];
    acc[r].push(g);
    return acc;
  }, {});
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  const homeAccent = '#d4982a';
  const awayAccent = '#4a9fd4';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div dir="ltr" className="min-h-screen bg-[#0d1117] text-white flex flex-col select-none">

      {/* TOP BAR */}
      <div className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2 bg-[#111827] border-b border-white/[0.07]">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-[#5a7a9a] hover:text-white transition-colors shrink-0"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
          Back
        </Link>

        <div className="h-5 w-px bg-white/10 shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-lg">🏀</span>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white leading-none">LIBIGAME</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#5a7a9a] leading-none">Digital Scoresheet</p>
          </div>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setPanelOpen(o => !o)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
            panelOpen
              ? 'border-orange-500/50 bg-orange-500/15 text-orange-400'
              : 'border-white/[0.08] bg-white/[0.04] text-[#8aaac8] hover:text-white hover:bg-white/[0.08]'
          }`}
        >
          ··· SELECT GAME
        </button>

        {phase !== 'idle' && (
          <>
            {(phase === 'ready' || phase === 'paused') && (
              <button
                onClick={startTimer}
                className="rounded-lg bg-orange-500 hover:bg-orange-400 px-2.5 py-1.5 text-xs font-black text-white transition-all"
              >
                PLAY
              </button>
            )}

            {phase === 'live' && (
              <button
                onClick={pauseTimer}
                className="rounded-lg border border-orange-500/60 bg-orange-500/10 hover:bg-orange-500/20 px-2.5 py-1.5 text-xs font-black text-orange-400 transition-all"
              >
                PAUSE
              </button>
            )}

            <button
              onClick={nextQ}
              className="rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1.5 text-xs font-bold text-[#8aaac8] hover:text-white transition-all"
            >
              {quarter >= 4 ? 'END GAME' : `NEXT Q${quarter + 1}`}
            </button>

            <button
              onClick={() => setLogOpen(o => !o)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
                logOpen
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-white/10 bg-white/[0.04] text-[#8aaac8] hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              GAME LOG
            </button>

            <button
              onClick={exportCSV}
              className="rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 px-2.5 py-1.5 text-xs font-bold text-green-400 transition-all"
            >
              EXPORT
            </button>

            <button
              onClick={() => selectedGame && startGame(selectedGame)}
              className="rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 text-xs font-bold text-red-400 transition-all"
            >
              RESET
            </button>
          </>
        )}
      </div>

      {/* GAME PICKER PANEL */}
      {panelOpen && (
        <div className="border-b border-white/[0.07] bg-[#0b1824] overflow-y-auto max-h-[50vh]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#3a5a7a]">
              {currentRound ? `ROUND ${currentRound}` : 'GAMES'}
            </span>
            <span className="text-[10px] text-[#2a4a6a]">{games.length} games</span>
          </div>

          {games.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#5a7a9a]">No games found</p>
          ) : (
            <div className="p-3 space-y-4">
              {rounds.map(round => (
                <div key={round}>
                  <p className="px-1 pb-1.5 text-[10px] font-black uppercase tracking-widest text-[#2a4a6a]">
                    Round {round} · {byRound[round].length} games
                  </p>
                  <div className="space-y-1.5">
                    {byRound[round].map(game => {
                      const isSelected = selectedGame?.id === game.id;
                      return (
                        <button
                          key={game.id}
                          onClick={() => startGame(game)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                            isSelected
                              ? 'border-orange-500/40 bg-orange-500/[0.08]'
                              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Logo logo={game.home_logo} name={game.home_name} size={32} />
                            <span className={`text-sm font-black truncate ${isSelected ? 'text-orange-300' : 'text-white'}`}>
                              {game.home_name}
                            </span>
                          </div>

                          <div className="shrink-0 text-center px-2">
                            <span className="text-[10px] font-black text-[#3a5a7a]">VS</span>
                            <p className="text-[9px] text-[#2a4a6a] mt-0.5">{game.game_date}</p>
                          </div>

                          <div className="flex items-center gap-2 flex-1 justify-end">
                            <span className={`text-sm font-black truncate ${isSelected ? 'text-orange-300' : 'text-white'}`}>
                              {game.away_name}
                            </span>
                            <Logo logo={game.away_logo} name={game.away_name} size={32} />
                          </div>

                          {isSelected && (
                            <span className="shrink-0 text-[10px] font-black text-green-400">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* IDLE STATE */}
      {phase === 'idle' && !panelOpen && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-4xl">🏀</p>
          <p className="text-lg font-bold text-[#5a7a9a]">Select a game to begin</p>
          <button
            onClick={() => setPanelOpen(true)}
            className="rounded-xl bg-orange-500 hover:bg-orange-400 px-6 py-3 text-sm font-black text-white transition-all"
          >
            SELECT GAME
          </button>
        </div>
      )}

      {/* SCOREBOARD — shown when phase !== idle */}
      {phase !== 'idle' && (
        <div className="flex flex-col flex-1 min-h-0">

          {/* CLOCK STRIP */}
          <div className="grid grid-cols-4 border-b border-white/[0.08] bg-[#0f1923] shrink-0">

            {/* Game Clock */}
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-3 border-r border-white/[0.06]">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#3a5a7a]">GAME CLOCK</p>
              <p
                className={`text-3xl font-mono tabular-nums font-black ${
                  clock <= 30 && phase === 'live' ? 'text-red-400' : 'text-white'
                }`}
              >
                {fmtTime(clock)}
              </p>
              <button
                onClick={() => setClock(QUARTER_SEC)}
                className="mt-0.5 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-[#5a7a9a] hover:text-white hover:bg-white/[0.08] transition-all"
              >
                RESET
              </button>
            </div>

            {/* Quarter */}
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-3 border-r border-white/[0.06]">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#3a5a7a]">QUARTER</p>
              <p className="text-3xl font-black text-white">Q{quarter}</p>
              <button
                onClick={nextQ}
                className="mt-0.5 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-[#5a7a9a] hover:text-white hover:bg-white/[0.08] transition-all"
              >
                {quarter >= 4 ? 'END' : `NEXT Q${quarter + 1}`}
              </button>
            </div>

            {/* Shot Clock */}
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-3 border-r border-white/[0.06]">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#3a5a7a]">SHOT CLOCK</p>
              <p
                className={`text-3xl font-mono tabular-nums font-black ${
                  shot <= 5 ? 'text-red-400' : 'text-red-300'
                }`}
              >
                {String(Math.max(0, shot)).padStart(2, '0')}
              </p>
              <button
                onClick={() => setShot(SHOT_SEC)}
                className="mt-0.5 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-[#5a7a9a] hover:text-white hover:bg-white/[0.08] transition-all"
              >
                RESET
              </button>
            </div>

            {/* Timeout */}
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#3a5a7a]">TIMEOUT</p>
              <p className={`text-3xl font-mono tabular-nums font-black ${toActive ? 'text-yellow-400' : 'text-white'}`}>
                {fmtTime(toClock)}
              </p>
              <button
                onClick={() => {
                  if (toRef.current) { clearInterval(toRef.current); toRef.current = null; }
                  setToActive(false);
                  setToClock(TIMEOUT_SEC);
                }}
                className="mt-0.5 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-[#5a7a9a] hover:text-white hover:bg-white/[0.08] transition-all"
              >
                RESET
              </button>
            </div>
          </div>

          {/* TEAMS */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* HOME TEAM */}
            <TeamPanel
              ts={home}
              side="H"
              accent={homeAccent}
              onAddScore={(pts) => addScore('H', pts)}
              onCallTO={() => callTO('H')}
              onAddPts={(pi, pts) => addPts('H', pi, pts)}
              onAddFoul={(pi) => addFoul('H', pi)}
            />

            <div className="w-px bg-white/[0.06] shrink-0" />

            {/* AWAY TEAM */}
            <TeamPanel
              ts={away}
              side="A"
              accent={awayAccent}
              onAddScore={(pts) => addScore('A', pts)}
              onCallTO={() => callTO('A')}
              onAddPts={(pi, pts) => addPts('A', pi, pts)}
              onAddFoul={(pi) => addFoul('A', pi)}
            />
          </div>
        </div>
      )}

      {/* DONE OVERLAY */}
      {phase === 'done' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-white/[0.12] bg-[#0f1923] p-6 shadow-2xl">
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-[#5a7a9a] mb-4">FINAL SCORE</p>

            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex-1 text-right">
                <p className="text-sm font-black truncate" style={{ color: homeAccent }}>{home.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-5xl font-black text-white">{home.score}</span>
                <span className="text-2xl text-[#3a5a7a]">—</span>
                <span className="text-5xl font-black text-white">{away.score}</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-black truncate" style={{ color: awayAccent }}>{away.name}</p>
              </div>
            </div>

            {home.score !== away.score && (
              <p className="text-center text-sm font-black text-green-400 mb-6">
                {home.score > away.score ? home.name : away.name} WINS!
              </p>
            )}
            {home.score === away.score && (
              <p className="text-center text-sm font-black text-yellow-400 mb-6">TIE GAME</p>
            )}

            {/* Top scorers */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {([['H', home, homeAccent], ['A', away, awayAccent]] as const).map(([, ts, accent]) => {
                const top = [...ts.players].sort((a, b) => b.pts - a.pts).slice(0, 3);
                return (
                  <div key={ts.name}>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: accent }}>
                      {ts.name} — Top Scorers
                    </p>
                    {top.filter(p => p.pts > 0).length === 0 ? (
                      <p className="text-[10px] text-[#3a5a7a]">No recorded points</p>
                    ) : (
                      <ul className="space-y-1">
                        {top.filter(p => p.pts > 0).map((p, i) => (
                          <li key={i} className="flex items-center justify-between text-xs">
                            <span className="text-[#8aaac8] truncate">{p.name}</span>
                            <span className="font-black text-white ml-2">{p.pts}pt</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => { setPanelOpen(true); setPhase('idle'); }}
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 py-3 text-sm font-black text-white transition-all"
            >
              NEW GAME
            </button>
          </div>
        </div>
      )}

      {/* GAME LOG DRAWER */}
      {logOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[60vh] rounded-t-2xl border-t border-white/[0.10] bg-[#0f1923] shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] shrink-0">
            <p className="text-xs font-black uppercase tracking-widest text-white">GAME LOG</p>
            <button
              onClick={() => setLogOpen(false)}
              className="text-[#5a7a9a] hover:text-white text-xl leading-none transition-colors"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1">
            {log.length === 0 ? (
              <p className="text-center text-sm text-[#3a5a7a] py-4">No events yet</p>
            ) : (
              log.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 py-1.5 border-b border-white/[0.04]">
                  <span className="text-[9px] font-mono text-[#3a5a7a] shrink-0 w-14">Q{entry.q} {entry.clk}</span>
                  <span
                    className="text-[10px] font-black shrink-0"
                    style={{ color: entry.side === 'H' ? homeAccent : awayAccent }}
                  >
                    {entry.side === 'H' ? home.name : away.name}
                  </span>
                  <span className="text-xs text-[#8aaac8] truncate flex-1">{entry.who}</span>
                  <span
                    className="text-xs font-black shrink-0"
                    style={{ color: entry.side === 'H' ? homeAccent : awayAccent }}
                  >
                    {entry.val}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Team Panel Sub-Component ─────────────────────────────────────────────────

function TeamPanel({
  ts,
  side,
  accent,
  onAddScore,
  onCallTO,
  onAddPts,
  onAddFoul,
}: {
  ts: TS;
  side: 'H' | 'A';
  accent: string;
  onAddScore: (pts: number) => void;
  onCallTO: () => void;
  onAddPts: (pi: number, pts: number) => void;
  onAddFoul: (pi: number) => void;
}) {
  const accentBg = `${accent}1a`;   // ~10% opacity
  const accentBorder = `${accent}66`; // ~40% opacity

  const totalFouls = ts.players.reduce((sum, p) => sum + p.fouls, 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

      {/* Team Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Logo logo={ts.logo} name={ts.name} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black uppercase tracking-wide truncate" style={{ color: accent }}>
              {ts.name}
            </p>
            <p className="text-[10px] text-[#3a5a7a] font-bold">{side === 'H' ? 'HOME' : 'AWAY'}</p>
          </div>
          <span className="text-5xl font-black tabular-nums text-white leading-none">{ts.score}</span>
        </div>

        {/* +1 +2 +3 quick score */}
        <div className="flex gap-1.5 mb-2">
          {[1, 2, 3].map(pts => (
            <button
              key={pts}
              onClick={() => onAddScore(pts)}
              className="flex-1 rounded-lg border py-1.5 text-xs font-black transition-all hover:opacity-80"
              style={{ borderColor: accentBorder, backgroundColor: accentBg, color: accent }}
            >
              +{pts}
            </button>
          ))}
        </div>

        {/* Timeouts + Fouls */}
        <div className="flex gap-1.5">
          <button
            onClick={onCallTO}
            disabled={ts.timeouts <= 0}
            className="flex-1 rounded-lg border py-1 text-[10px] font-black transition-all disabled:opacity-40 hover:opacity-80"
            style={{ borderColor: accentBorder, backgroundColor: accentBg, color: accent }}
          >
            T/O: {ts.timeouts}/{5}
          </button>
          <div
            className="flex-1 rounded-lg border py-1 text-[10px] font-black text-center"
            style={{ borderColor: accentBorder, backgroundColor: accentBg, color: accent }}
          >
            FOULS: {totalFouls}
          </div>
        </div>
      </div>

      {/* Players */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        <p className="px-1 py-1 text-[8px] font-black uppercase tracking-widest text-[#2a4a6a]">PLAYERS</p>
        {ts.players.length === 0 ? (
          <p className="text-center text-[10px] text-[#3a5a7a] py-4">No players loaded</p>
        ) : (
          <div className="space-y-0.5">
            {ts.players.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-all"
              >
                {/* Jersey */}
                <span className="w-5 text-center text-[10px] font-mono text-[#3a5a7a] shrink-0">
                  {p.jersey != null ? `#${p.jersey}` : '—'}
                </span>

                {/* Name */}
                <span className="flex-1 min-w-0 text-[10px] font-bold text-[#8aaac8] truncate">
                  {p.name}
                </span>

                {/* Points display */}
                <span className="text-[10px] font-black w-8 text-right shrink-0" style={{ color: accent }}>
                  {p.pts}pt
                </span>

                {/* +1 +2 +3 */}
                {[1, 2, 3].map(pts => (
                  <button
                    key={pts}
                    onClick={() => onAddPts(i, pts)}
                    className="w-6 h-6 rounded text-[9px] font-black transition-all hover:opacity-80 shrink-0"
                    style={{ borderWidth: 1, borderStyle: 'solid', borderColor: accentBorder, backgroundColor: accentBg, color: accent }}
                  >
                    +{pts}
                  </button>
                ))}

                {/* Foul button */}
                <button
                  onClick={() => onAddFoul(i)}
                  className={`w-7 h-6 rounded text-[9px] font-black transition-all hover:opacity-80 shrink-0 ${
                    p.fouls >= 5 ? 'bg-red-500/20 border-red-500/60 text-red-400' : ''
                  }`}
                  style={p.fouls < 5 ? { borderWidth: 1, borderStyle: 'solid', borderColor: accentBorder, backgroundColor: accentBg, color: accent } : undefined}
                >
                  F{p.fouls}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
