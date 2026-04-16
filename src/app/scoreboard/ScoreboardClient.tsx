'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { ScoreboardGame, ScoreboardPlayer } from './page';

// ── Types ────────────────────────────────────────────────────────────────────
type PS  = { name: string; jersey: number | null; pts: number; fouls: number };
type TS  = { name: string; logo: string | null; score: number; timeouts: number; players: PS[] };
type LE  = { id: number; q: number; clk: string; side: 'H'|'A'; who: string; val: string };
type Phase = 'pick' | 'setup' | 'ready' | 'live' | 'paused' | 'done';

const QUARTER_SEC = 10 * 60;
const SHOT_SEC    = 24;
const TIMEOUT_SEC = 60;
const MAX_TO      = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number) {
  return `${String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')}:${String(Math.max(0,s)%60).padStart(2,'0')}`;
}

function Logo({ logo, name, size = 48 }: { logo: string|null; name: string; size?: number }) {
  return (
    <div className="shrink-0 rounded-full border-2 border-white/10 bg-[#1a2a3a] overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}>
      {logo
        ? <img src={logo} alt={name} className="w-full h-full object-cover" />
        : <span className="font-black text-[#4a6a8a]" style={{ fontSize: Math.max(10, size * 0.38) }}>
            {[...name].find(c => c.trim()) ?? '?'}
          </span>}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ScoreboardClient({
  games, players, currentRound, roundDate = '',
}: { games: ScoreboardGame[]; players: ScoreboardPlayer[]; currentRound: number; roundDate?: string }) {

  // ── Step tracking ──────────────────────────────────────────────────────────
  const [phase,   setPhase]   = useState<Phase>('pick');
  const [selGame, setSelGame] = useState<ScoreboardGame | null>(null);

  // Setup step: which players are checked
  const [homeChecked, setHomeChecked] = useState<Set<string>>(new Set());
  const [awayChecked, setAwayChecked] = useState<Set<string>>(new Set());

  // Scoreboard state
  const [quarter, setQuarter] = useState(1);
  const [clock,   setClock]   = useState(QUARTER_SEC);
  const [shot,    setShot]    = useState(SHOT_SEC);
  const [toClock, setToClock] = useState(TIMEOUT_SEC);
  const [toActive,setToActive]= useState(false);
  const [home,    setHome]    = useState<TS>({ name:'', logo:null, score:0, timeouts:MAX_TO, players:[] });
  const [away,    setAway]    = useState<TS>({ name:'', logo:null, score:0, timeouts:MAX_TO, players:[] });
  const [log,      setLog]      = useState<LE[]>([]);
  const [logOpen,  setLogOpen]  = useState(false);
  const [nameMode, setNameMode] = useState<'full'|'first'|'last'|'num'>('full');
  const [rotated,  setRotated]  = useState(false);
  const [mounted,  setMounted]  = useState(false);
  useEffect(() => setMounted(true), []);

  const logId    = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const toRef    = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (toRef.current)    clearInterval(toRef.current);
  }, []);

  // Auto-rotate when device tilts to landscape
  useEffect(() => {
    const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };
    function onOrient() {
      const angle = (screen.orientation?.angle ?? (window as unknown as { orientation: number }).orientation ?? 0) as number;
      const landscape = Math.abs(angle) === 90 || angle === 270;
      setRotated(landscape);
      if (landscape) {
        document.documentElement.requestFullscreen().catch(() => {});
        so?.lock?.('portrait-primary')?.catch(() => {});
      } else {
        so?.unlock?.();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    }
    window.addEventListener('orientationchange', onOrient);
    so?.addEventListener('change', onOrient);
    return () => { window.removeEventListener('orientationchange', onOrient); so?.removeEventListener('change', onOrient); };
  }, []);

  // Player name display helper
  function displayName(name: string): string {
    if (nameMode === 'first') return name.split(' ')[0];
    if (nameMode === 'last')  return name.split(' ').slice(-1)[0];
    return name;
  }
  const nameModeLabel = { full: 'שם מלא', first: 'שם פרטי', last: 'שם משפחה', num: 'מספר בלבד' } as const;

  // ── Player helpers ─────────────────────────────────────────────────────────
  function allPlayersFor(teamId: string): ScoreboardPlayer[] {
    const seen = new Set<string>();
    return players.filter(p => {
      if (p.team_id !== teamId || seen.has(p.name)) return false;
      seen.add(p.name); return true;
    });
  }

  // ── STEP 1 → 2: select game ────────────────────────────────────────────────
  function pickGame(g: ScoreboardGame) {
    setSelGame(g);
    const hp = allPlayersFor(g.home_team_id);
    const ap = allPlayersFor(g.away_team_id);
    setHomeChecked(new Set(hp.map(p => p.name)));
    setAwayChecked(new Set(ap.map(p => p.name)));
    setPhase('setup');
  }

  // ── STEP 2 → 3: confirm rosters ───────────────────────────────────────────
  function confirmRosters() {
    if (!selGame) return;
    const hAll = allPlayersFor(selGame.home_team_id);
    const aAll = allPlayersFor(selGame.away_team_id);
    const toPS = (list: ScoreboardPlayer[], checked: Set<string>): PS[] =>
      list.filter(p => checked.has(p.name)).map(p => ({ name: p.name, jersey: p.jersey_number, pts: 0, fouls: 0 }));

    setHome({ name: selGame.home_name, logo: selGame.home_logo, score: 0, timeouts: MAX_TO, players: toPS(hAll, homeChecked) });
    setAway({ name: selGame.away_name, logo: selGame.away_logo, score: 0, timeouts: MAX_TO, players: toPS(aAll, awayChecked) });
    setQuarter(1); setClock(QUARTER_SEC); setShot(SHOT_SEC); setToClock(TIMEOUT_SEC); setToActive(false); setLog([]);
    setPhase('ready');
  }

  // ── Clock control ──────────────────────────────────────────────────────────
  function stopTimer() { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }

  function startTimer() {
    if (timerRef.current) return;
    setPhase('live');
    timerRef.current = setInterval(() => {
      setClock(c => { if (c <= 1) { stopTimer(); setPhase('paused'); return 0; } return c - 1; });
      setShot(s => Math.max(0, s - 1));
    }, 1000);
  }

  function pauseTimer() { stopTimer(); setPhase('paused'); }

  function nextQ() {
    stopTimer();
    if (quarter >= 4) { setPhase('done'); return; }
    setQuarter(q => q + 1);
    setClock(QUARTER_SEC); setShot(SHOT_SEC);
    setPhase('ready');
  }

  function callTO(side: 'home'|'away') {
    const t = side === 'home' ? home : away;
    if (t.timeouts <= 0) return;
    pauseTimer();
    (side === 'home' ? setHome : setAway)(ts => ({ ...ts, timeouts: ts.timeouts - 1 }));
    setToClock(TIMEOUT_SEC); setToActive(true);
    if (toRef.current) clearInterval(toRef.current);
    toRef.current = setInterval(() => {
      setToClock(c => { if (c <= 1) { clearInterval(toRef.current!); toRef.current = null; setToActive(false); return 0; } return c - 1; });
    }, 1000);
  }

  // ── Scoring ────────────────────────────────────────────────────────────────
  function addTeamScore(side: 'home'|'away', pts: number) {
    (side === 'home' ? setHome : setAway)(ts => ({ ...ts, score: ts.score + pts }));
    pushLog(side, 'TEAM', `+${pts}`);
  }
  function addPts(side: 'home'|'away', pi: number, pts: number) {
    const t = side === 'home' ? home : away;
    (side === 'home' ? setHome : setAway)(ts => {
      const ps = [...ts.players]; ps[pi] = { ...ps[pi], pts: ps[pi].pts + pts };
      return { ...ts, score: ts.score + pts, players: ps };
    });
    pushLog(side, t.players[pi]?.name ?? '?', `+${pts}`);
  }
  function addFoul(side: 'home'|'away', pi: number) {
    const t = side === 'home' ? home : away;
    (side === 'home' ? setHome : setAway)(ts => {
      const ps = [...ts.players]; ps[pi] = { ...ps[pi], fouls: ps[pi].fouls + 1 };
      return { ...ts, players: ps };
    });
    pushLog(side, t.players[pi]?.name ?? '?', 'FOUL');
  }
  function pushLog(side: 'home'|'away', who: string, val: string) {
    setLog(l => [{ id: logId.current++, q: quarter, clk: fmt(clock), side: side === 'home' ? 'H' : 'A', who, val }, ...l]);
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = ['Team,#,Player,Points,Fouls'];
    [...home.players.map(p => [home.name, p.jersey ?? '', p.name, p.pts, p.fouls]),
     ...away.players.map(p => [away.name, p.jersey ?? '', p.name, p.pts, p.fouls])]
      .forEach(r => rows.push(r.join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = `scoreboard-${home.name}-vs-${away.name}.csv`;
    a.click();
  }

  // ── Group games by round ───────────────────────────────────────────────────
  const byRound = games.reduce<Record<string, ScoreboardGame[]>>((acc, g) => {
    const k = g.round != null ? `מחזור ${g.round}` : g.game_date;
    (acc[k] ??= []).push(g); return acc;
  }, {});
  const roundKeys = Object.keys(byRound);

  const isRunning = phase === 'live';

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — PICK GAME
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'pick') {
    return (
      <div dir="ltr" className="min-h-screen bg-[#0d1117] text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 bg-[#111827] border-b border-white/[0.08] px-4 py-3">
          <Link href="/" className="text-[#5a7a9a] hover:text-white flex items-center gap-1 text-sm">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd"/>
            </svg>
            Back
          </Link>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-base">🏀</div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest leading-none">LIBIGAME</p>
              <p className="text-[9px] text-[#4a6a8a] tracking-wider leading-none">DIGITAL SCORESHEET</p>
            </div>
          </div>
          <div className="flex-1" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[#3a5a7a]">
            STEP 1 OF 3 — SELECT GAME
          </span>
        </div>

        {/* Game list */}
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          {games.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <span className="text-4xl">📅</span>
              <p className="text-[#5a7a9a] font-bold">No games found in the schedule</p>
            </div>
          ) : (
            <div className="space-y-6">
              {roundKeys.map(rk => (
                <div key={rk}>
                  <div className="flex items-center justify-end gap-3 mb-3 px-1">
                    {roundDate && <span className="text-sm font-bold text-[#8aaac8] font-body">{roundDate}</span>}
                    <p className="text-lg font-black text-white font-heading">{rk}</p>
                  </div>
                  <div className="space-y-2">
                    {byRound[rk].map(g => (
                      <button key={g.id} onClick={() => pickGame(g)}
                        className="w-full flex items-center gap-3 bg-[#0f1923] hover:bg-[#162030] border border-white/[0.07] hover:border-orange-500/30 rounded-2xl px-5 py-4 transition-all group">
                        {/* Home */}
                        <div className="flex items-center gap-3 flex-1 justify-end">
                          <span className="text-base font-black text-white group-hover:text-orange-300 transition-colors font-heading">{g.home_name}</span>
                          <Logo logo={g.home_logo} name={g.home_name} size={44} />
                        </div>
                        {/* VS */}
                        <div className="shrink-0 flex flex-col items-center px-2">
                          <span className="text-sm font-black text-white">VS</span>
                        </div>
                        {/* Away */}
                        <div className="flex items-center gap-3 flex-1">
                          <Logo logo={g.away_logo} name={g.away_name} size={44} />
                          <span className="text-base font-black text-white group-hover:text-orange-300 transition-colors font-heading">{g.away_name}</span>
                        </div>
                        {/* Arrow */}
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[#2a4a6a] group-hover:text-orange-400 transition-colors shrink-0">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — ROSTER SETUP
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'setup' && selGame) {
    const hAll = allPlayersFor(selGame.home_team_id);
    const aAll = allPlayersFor(selGame.away_team_id);

    function togglePlayer(side: 'home'|'away', name: string) {
      const setter = side === 'home' ? setHomeChecked : setAwayChecked;
      setter(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    }

    function toggleAll(side: 'home'|'away', all: ScoreboardPlayer[], checked: boolean) {
      const setter = side === 'home' ? setHomeChecked : setAwayChecked;
      setter(checked ? new Set(all.map(p => p.name)) : new Set());
    }

    const PlayerList = ({ side, list, checked }: { side: 'home'|'away'; list: ScoreboardPlayer[]; checked: Set<string> }) => {
      const accent = side === 'home' ? '#d4982a' : '#4a9fd4';
      const allOn = list.every(p => checked.has(p.name));
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#5a7a9a' }}>
              PLAYERS ({checked.size}/{list.length})
            </p>
            <button onClick={() => toggleAll(side, list, !allOn)}
              className="text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 text-[#8aaac8] hover:text-white">
              {allOn ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {list.length === 0
              ? <p className="text-[10px] text-[#3a5a7a] py-2">No players on roster</p>
              : list.map(p => {
                  const on = checked.has(p.name);
                  return (
                    <button key={p.name} onClick={() => togglePlayer(side, p.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all text-left ${
                        on ? 'border-white/10 bg-white/[0.04]' : 'border-transparent bg-transparent opacity-40'
                      }`}>
                      {/* Checkbox */}
                      <div className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                        style={{ borderColor: on ? accent : '#3a5a7a', background: on ? accent : 'transparent' }}>
                        {on && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>}
                      </div>
                      <span className="text-[11px] font-mono w-6 shrink-0" style={{ color: accent }}>
                        #{p.jersey_number ?? '–'}
                      </span>
                      <span className="flex-1 text-[13px] font-semibold text-white truncate">{p.name}</span>
                    </button>
                  );
                })
            }
          </div>
        </div>
      );
    };

    return (
      <div dir="ltr" className="min-h-screen bg-[#0d1117] text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 bg-[#111827] border-b border-white/[0.08] px-4 py-3">
          <button onClick={() => setPhase('pick')} className="text-[#5a7a9a] hover:text-white flex items-center gap-1 text-sm">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd"/>
            </svg>
            Back
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-base shrink-0">🏀</div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest leading-none">LIBIGAME</p>
              <p className="text-[9px] text-orange-400 leading-none truncate font-bold">
                {selGame.home_name} vs {selGame.away_name}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#3a5a7a] shrink-0">
            STEP 2 OF 3 — ROSTERS
          </span>
        </div>

        {/* Teams + rosters */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 divide-x divide-white/[0.06] max-w-3xl mx-auto">
            {/* HOME */}
            <div className="p-4 space-y-4">
              <div className="flex flex-col items-center gap-2 pb-3 border-b border-white/[0.06]">
                <Logo logo={selGame.home_logo} name={selGame.home_name} size={64} />
                <p className="text-base font-black text-[#d4982a] uppercase tracking-wider text-center">{selGame.home_name}</p>
                <span className="text-[10px] font-bold text-[#5a7a9a] bg-white/5 rounded px-2 py-0.5">HOME</span>
              </div>
              <PlayerList side="home" list={hAll} checked={homeChecked} />
            </div>

            {/* AWAY */}
            <div className="p-4 space-y-4">
              <div className="flex flex-col items-center gap-2 pb-3 border-b border-white/[0.06]">
                <Logo logo={selGame.away_logo} name={selGame.away_name} size={64} />
                <p className="text-base font-black text-[#4a9fd4] uppercase tracking-wider text-center">{selGame.away_name}</p>
                <span className="text-[10px] font-bold text-[#5a7a9a] bg-white/5 rounded px-2 py-0.5">AWAY</span>
              </div>
              <PlayerList side="away" list={aAll} checked={awayChecked} />
            </div>
          </div>
        </div>

        {/* Confirm bar */}
        <div className="border-t border-white/[0.08] bg-[#111827] px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-[11px] text-[#5a7a9a]">
            {homeChecked.size} + {awayChecked.size} players selected
          </p>
          <button onClick={confirmRosters}
            disabled={homeChecked.size === 0 && awayChecked.size === 0}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl px-6 py-2.5 text-sm transition-all">
            START GAME
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — SCOREBOARD
  // ══════════════════════════════════════════════════════════════════════════
  const TeamPanel = ({ side }: { side: 'home'|'away' }) => {
    const t       = side === 'home' ? home : away;
    const setter  = side === 'home' ? setHome : setAway;
    const accent  = side === 'home' ? '#d4982a' : '#4a9fd4';
    const btnCls  = side === 'home'
      ? 'border-[#d4982a]/40 bg-[#d4982a]/10 text-[#d4982a] hover:bg-[#d4982a]/20'
      : 'border-[#4a9fd4]/40 bg-[#4a9fd4]/10 text-[#4a9fd4] hover:bg-[#4a9fd4]/20';

    return (
      <div className="flex flex-col overflow-hidden border-x border-white/[0.05] first:border-l-0 last:border-r-0">
        {/* Team header */}
        <div className="px-3 pt-3 pb-2 border-b border-white/[0.07] bg-[#0f1923]">
          <div className="flex items-center gap-3 mb-2">
            <Logo logo={t.logo} name={t.name} size={40} />
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider truncate font-heading" style={{ color: accent }}>{t.name}</p>
              <p className="text-4xl font-black text-white leading-none font-stats">{t.score}</p>
            </div>
          </div>
          {/* Score buttons */}
          <div className="flex gap-1.5">
            {[1,2,3].map(pts => (
              <button key={pts} onClick={() => addTeamScore(side, pts)}
                className={`flex-1 rounded-lg border py-2 font-black text-sm ${btnCls}`}>+{pts}</button>
            ))}
          </div>
          {/* Timeout + fouls */}
          <div className="flex gap-2 mt-1.5 text-[10px]">
            <button onClick={() => callTO(side)}
              className={`flex-1 rounded border py-1 font-bold transition-colors ${
                t.timeouts > 0 ? 'border-white/10 text-[#8aaac8] hover:text-white' : 'border-white/5 text-[#3a5a7a] cursor-not-allowed'
              }`}>
              {t.timeouts} T/O
            </button>
            <div className="flex-1 flex items-center justify-center rounded border border-white/10 text-[#8aaac8]">
              {t.players.reduce((a,p) => a+p.fouls, 0)} FOULS
            </div>
          </div>
        </div>

        {/* Players */}
        <div className="flex-1 overflow-y-auto">
          <p className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#3a5a7a] border-b border-white/[0.04]">PLAYERS</p>
          {t.players.length === 0
            ? <p className="px-3 py-4 text-[10px] text-[#3a5a7a]">No players</p>
            : t.players.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <span className="w-5 text-[9px] font-mono shrink-0" style={{ color: accent }}>#{p.jersey ?? '–'}</span>
                  {nameMode !== 'num' && (
                    <span className="flex-1 text-[11px] text-[#c0d4e8] truncate min-w-0">{displayName(p.name)}</span>
                  )}
                  <span className="text-[9px] text-[#4a6a8a] w-5 text-right shrink-0">{p.pts}</span>
                  {[1,2,3].map(pts => (
                    <button key={pts} onClick={() => addPts(side, i, pts)}
                      className={`w-6 h-6 rounded text-[9px] font-black border shrink-0 ${btnCls}`}>{pts}</button>
                  ))}
                  <button onClick={() => addFoul(side, i)}
                    className={`w-6 h-6 rounded text-[9px] font-black border shrink-0 ${
                      p.fouls >= 5 ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-white/10 text-[#5a7a9a] hover:text-white'
                    }`}>F{p.fouls}</button>
                </div>
              ))
          }
        </div>
      </div>
    );
  };

  // When rotated, we portal the scoreboard directly into <body> so it
  // sits above the root layout's sticky header and BottomNav (both z-50).
  const portalStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    width: '100vh',
    height: '100vw',
    transform: 'translate(-50%, -50%) rotate(90deg)',
    zIndex: 9999,
    overflow: 'hidden',
    background: '#0d1117',
    display: 'flex',
    flexDirection: 'column',
    color: 'white',
    userSelect: 'none',
  };

  const scoreboardEl = (
    <div dir="ltr"
      className={rotated ? '' : 'h-screen bg-[#0d1117] text-white flex flex-col overflow-hidden select-none'}
      style={rotated ? portalStyle : {}}>

      {/* TOP BAR */}
      <div className="flex items-center gap-1.5 bg-[#111827] border-b border-white/[0.08] px-3 py-2 flex-wrap shrink-0">
        <button onClick={() => { stopTimer(); setPhase('pick'); }}
          className="text-[#5a7a9a] hover:text-white flex items-center gap-1 text-xs shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd"/>
          </svg>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center text-xs">🏀</div>
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">LIBIGAME</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-orange-400 font-bold truncate">{home.name} vs {away.name}</p>
        </div>

        {/* Control buttons */}
        {(phase === 'ready' || phase === 'paused') && (
          <button onClick={startTimer}
            className="rounded-md bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-black uppercase px-3 py-1.5 shrink-0">
            {phase === 'ready' ? 'START GAME' : 'RESUME'}
          </button>
        )}
        {phase === 'live' && (
          <button onClick={pauseTimer}
            className="rounded-md border border-orange-500/40 bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase px-3 py-1.5 shrink-0">
            PAUSE
          </button>
        )}
        <button onClick={nextQ}
          className="rounded-md border border-white/10 bg-white/5 text-[#8aaac8] hover:text-white text-[10px] font-black uppercase px-2 py-1.5 shrink-0">
          {quarter < 4 ? `Q${quarter+1}` : 'END'}
        </button>
        <button onClick={() => setLogOpen(o=>!o)}
          className="rounded-md border border-white/10 bg-white/5 text-[#8aaac8] hover:text-white text-[10px] font-black uppercase px-2 py-1.5 shrink-0">
          LOG
        </button>
        {/* Name display mode */}
        <button onClick={() => setNameMode(m => ({ full:'first', first:'last', last:'num', num:'full' } as const)[m])}
          className="rounded-md border border-white/10 bg-white/5 text-[#8aaac8] hover:text-white text-[10px] font-black px-2 py-1.5 shrink-0 hidden sm:block"
          title="שינוי תצוגת שם">
          {nameModeLabel[nameMode]}
        </button>
        {/* Mobile rotate */}
        <button onClick={async () => {
            const next = !rotated; setRotated(next);
            const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };
            if (next) {
              // Enter fullscreen to hide browser chrome, then lock orientation
              try { await document.documentElement.requestFullscreen(); } catch {}
              so?.lock?.('portrait-primary')?.catch(() => {});
            } else {
              so?.unlock?.();
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            }
          }}
          className="sm:hidden rounded-md border border-white/10 bg-white/5 text-[#8aaac8] hover:text-white text-[10px] font-black px-2 py-1.5 shrink-0">
          ↺
        </button>
        <button onClick={exportCSV}
          className="rounded-md border border-green-500/30 bg-green-500/10 text-green-400 text-[10px] font-black uppercase px-2 py-1.5 shrink-0">
          CSV
        </button>
        <button onClick={() => { stopTimer(); setPhase('setup'); }}
          className="rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-black uppercase px-2 py-1.5 shrink-0">
          RESET
        </button>
      </div>

      {/* CLOCK STRIP */}
      <div className="grid grid-cols-4 divide-x divide-white/[0.06] bg-[#0f1923] border-b border-white/[0.07] shrink-0">
        {/* Game Clock */}
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <p className="text-[8px] font-black uppercase tracking-widest text-[#3a5a7a]">GAME CLOCK</p>
          <p className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${clock <= 30 && isRunning ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {fmt(clock)}
          </p>
          <button onClick={() => setClock(QUARTER_SEC)}
            className="text-[8px] font-black text-[#4a6a8a] border border-white/[0.07] rounded px-2 py-0.5 hover:text-white">
            RESET
          </button>
        </div>
        {/* Quarter */}
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <p className="text-[8px] font-black uppercase tracking-widest text-[#3a5a7a]">QUARTER</p>
          <p className="text-2xl sm:text-3xl font-black text-white">Q{quarter}</p>
          <button onClick={nextQ}
            className="text-[8px] font-black text-orange-400 border border-orange-500/30 rounded px-2 py-0.5 hover:bg-orange-500/10">
            {quarter < 4 ? `→Q${quarter+1}` : 'END'}
          </button>
        </div>
        {/* Shot Clock */}
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <p className="text-[8px] font-black uppercase tracking-widest text-[#3a5a7a]">SHOT CLOCK</p>
          <p className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${shot <= 5 ? 'text-red-500 animate-pulse' : 'text-red-400'}`}>
            {fmt(shot)}
          </p>
          <div className="flex gap-1">
            <button onClick={() => setShot(SHOT_SEC)}
              className="text-[8px] font-black text-[#4a6a8a] border border-white/[0.07] rounded px-1.5 py-0.5 hover:text-white">
              24s
            </button>
            <button onClick={() => setShot(14)}
              className="text-[8px] font-black text-[#4a6a8a] border border-white/[0.07] rounded px-1.5 py-0.5 hover:text-white">
              14s
            </button>
          </div>
        </div>
        {/* Timeout */}
        <div className="flex flex-col items-center justify-center py-3 gap-0.5">
          <p className="text-[8px] font-black uppercase tracking-widest text-[#3a5a7a]">TIMEOUT</p>
          <p className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${toActive ? 'text-yellow-400' : 'text-white'}`}>
            {toActive ? fmt(toClock) : fmt(TIMEOUT_SEC)}
          </p>
          <button onClick={() => { setToClock(TIMEOUT_SEC); setToActive(false); if(toRef.current){clearInterval(toRef.current);toRef.current=null;} }}
            className="text-[8px] font-black text-[#4a6a8a] border border-white/[0.07] rounded px-2 py-0.5 hover:text-white">
            RESET
          </button>
        </div>
      </div>

      {/* TEAMS */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-white/[0.06] overflow-hidden">
        <TeamPanel side="home" />
        <TeamPanel side="away" />
      </div>

      {/* DONE OVERLAY */}
      {phase === 'done' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-6 p-6">
          <p className="text-4xl">🏆</p>
          <p className="text-xl font-black uppercase tracking-wider text-white">FINAL SCORE</p>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <Logo logo={home.logo} name={home.name} size={56} />
              <p className="text-[#d4982a] font-black text-sm mt-2 font-heading">{home.name}</p>
              <p className="text-5xl font-black text-white mt-1 font-stats">{home.score}</p>
            </div>
            <p className="text-3xl font-black text-[#3a5a7a]">—</p>
            <div className="text-center">
              <Logo logo={away.logo} name={away.name} size={56} />
              <p className="text-[#4a9fd4] font-black text-sm mt-2 font-heading">{away.name}</p>
              <p className="text-5xl font-black text-white mt-1 font-stats">{away.score}</p>
            </div>
          </div>
          <p className="text-lg font-black text-orange-400">
            {home.score > away.score ? `${home.name} WIN!` : home.score < away.score ? `${away.name} WIN!` : 'TIE!'}
          </p>
          <div className="flex gap-3">
            <button onClick={exportCSV}
              className="rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 font-black px-5 py-2.5 text-sm">
              EXPORT CSV
            </button>
            <button onClick={() => { stopTimer(); setPhase('pick'); }}
              className="rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-black px-6 py-2.5 text-sm">
              NEW GAME
            </button>
          </div>
        </div>
      )}

      {/* GAME LOG */}
      {logOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col" onClick={() => setLogOpen(false)}>
          <div className="mt-auto bg-[#0d1117] border-t border-white/10 max-h-[60vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
              <p className="font-black text-sm uppercase tracking-wider">GAME LOG</p>
              <button onClick={() => setLogOpen(false)} className="text-[#5a7a9a] hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {log.length === 0
                ? <p className="px-4 py-6 text-sm text-[#5a7a9a] text-center">No events yet</p>
                : log.map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.03] text-xs">
                      <span className="font-mono text-[#3a5a7a] shrink-0 w-10">Q{e.q}</span>
                      <span className="font-mono text-[#3a5a7a] shrink-0 w-12">{e.clk}</span>
                      <span className="font-black shrink-0" style={{ color: e.side==='H' ? '#d4982a' : '#4a9fd4' }}>
                        {e.side==='H' ? home.name : away.name}
                      </span>
                      <span className="flex-1 text-[#8aaac8] truncate">{e.who}</span>
                      <span className="font-black text-white shrink-0">{e.val}</span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Portal into <body> when rotated so it sits above root layout nav (z-50)
  return (rotated && mounted)
    ? createPortal(scoreboardEl, document.body)
    : scoreboardEl;
}
