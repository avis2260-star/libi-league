'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { LiveGame, LivePlayer } from './page';

const SCOREBOARD_URL = 'https://game-scoreboard-libi.vercel.app';

// ── helpers ────────────────────────────────────────────────────────────────────

function TeamLogo({ logo, name, size = 10 }: { logo: string | null; name: string; size?: number }) {
  const px = size * 4;
  return (
    <div
      className={`shrink-0 rounded-full border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center`}
      style={{ width: px, height: px }}
    >
      {logo
        ? <img src={logo} alt={name} className="w-full h-full object-cover" />
        : <span className="text-sm font-black text-[#4a6a8a]">{[...name].find(c => c.trim()) ?? '?'}</span>
      }
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function LiveClient({
  games,
  players,
  currentRound,
}: {
  games: LiveGame[];
  players: LivePlayer[];
  currentRound: number | null;
}) {
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const [loaded,     setLoaded]     = useState(false);
  const [rotated,    setRotated]    = useState(false);
  const [fsActive,   setFsActive]   = useState(false);
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [selected,   setSelected]   = useState<LiveGame | null>(null);
  const [injected,   setInjected]   = useState(false);
  const [iframeKey,  setIframeKey]  = useState(0); // force reload

  /* Track native fullscreen changes */
  useEffect(() => {
    function onFsChange() { setFsActive(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  /* Auto-rotate when device tilts to landscape */
  useEffect(() => {
    function onOrientationChange() {
      const angle = (screen.orientation?.angle ??
        (window as unknown as { orientation: number }).orientation ?? 0) as number;
      const isLandscape = Math.abs(angle) === 90 || angle === 270;
      setRotated(isLandscape);
      const so = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
        unlock?: () => void;
      };
      if (isLandscape) {
        so?.lock?.('portrait-primary')?.catch(() => {});
      } else {
        so?.unlock?.();
      }
    }
    window.addEventListener('orientationchange', onOrientationChange);
    screen.orientation?.addEventListener('change', onOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', onOrientationChange);
      screen.orientation?.removeEventListener('change', onOrientationChange);
    };
  }, []);

  function toggleRotate() {
    const next = !rotated;
    setRotated(next);
    const so = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
      unlock?: () => void;
    };
    if (next) {
      so?.lock?.('portrait-primary')?.catch(() => {});
    } else {
      so?.unlock?.();
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) iframeRef.current?.requestFullscreen();
    else document.exitFullscreen();
  }

  function reloadIframe() {
    setLoaded(false);
    setInjected(false);
    setIframeKey(k => k + 1);
  }

  /* Build player lists for a team (deduplicated by name) */
  function playersFor(teamId: string) {
    const seen = new Set<string>();
    return players.filter(p => {
      if (p.team_id !== teamId) return false;
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }

  /* Send game data into the scoreboard via postMessage */
  function injectGame(game: LiveGame) {
    const homePlayers = playersFor(game.home_team_id);
    const awayPlayers = playersFor(game.away_team_id);

    const msg = {
      type: 'GAME_SETUP',
      home: {
        name:    game.home_name,
        logo:    game.home_logo ?? '',
        players: homePlayers.map(p => ({ name: p.name, jersey: p.jersey_number ?? 0 })),
      },
      away: {
        name:    game.away_name,
        logo:    game.away_logo ?? '',
        players: awayPlayers.map(p => ({ name: p.name, jersey: p.jersey_number ?? 0 })),
      },
    };

    iframeRef.current?.contentWindow?.postMessage(msg, '*');
    setInjected(true);
  }

  /* Select a game → inject immediately once iframe is loaded */
  function selectGame(game: LiveGame) {
    setSelected(game);
    setInjected(false);
    if (loaded) injectGame(game);
  }

  /* Re-inject after iframe reloads */
  useEffect(() => {
    if (loaded && selected && !injected) {
      const t = setTimeout(() => { injectGame(selected); }, 800);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, selected]);

  /* Group games by round */
  const byRound = games.reduce<Record<number, LiveGame[]>>((acc, g) => {
    const r = g.round ?? 0;
    if (!acc[r]) acc[r] = [];
    acc[r].push(g);
    return acc;
  }, {});
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  /* Rotation styles — portrait → landscape on mobile */
  const rotateStyle: React.CSSProperties = rotated ? {
    position: 'fixed',
    top: '50%',
    left: '50%',
    width: '100vh',
    height: '100vw',
    transform: 'translate(-50%, -50%) rotate(90deg)',
    zIndex: 40,
    overflow: 'hidden',
  } : {};

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#060810]">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className={`sticky top-0 z-30 flex items-center gap-2 border-b border-white/[0.07] bg-[#0a1628]/90 backdrop-blur-md px-3 py-2.5 ${rotated ? 'hidden' : ''}`}>

        <Link href="/" className="flex items-center gap-1 text-sm text-[#5a7a9a] hover:text-white transition-colors shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
          חזרה
        </Link>

        <div className="h-5 w-px bg-white/10 shrink-0" />

        {/* Live badge */}
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-red-400">חי</span>
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white truncate font-heading">🏀 ניהול משחק חי</p>
          {selected && (
            <p className="text-[10px] text-orange-400 truncate font-bold font-heading">
              {selected.home_name} נגד {selected.away_name}
            </p>
          )}
        </div>

        {/* Game picker toggle */}
        <button
          onClick={() => setPanelOpen(o => !o)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
            panelOpen
              ? 'border-orange-500/50 bg-orange-500/15 text-orange-400'
              : 'border-white/[0.08] bg-white/[0.04] text-[#8aaac8] hover:text-white hover:bg-white/[0.08]'
          }`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
          <span className="hidden sm:inline">בחר משחק</span>
        </button>

        {/* Rotate — mobile only */}
        <button
          onClick={toggleRotate}
          title="סובב למצב רוחב"
          className="sm:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#8aaac8] hover:bg-white/[0.08] hover:text-white transition-all"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Reload */}
        <button onClick={reloadIframe} title="רענן"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#8aaac8] hover:bg-white/[0.08] hover:text-white transition-all">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Fullscreen */}
        <button onClick={toggleFullscreen} title={fsActive ? 'צא ממסך מלא' : 'מסך מלא'}
          className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-500/20 transition-all">
          {fsActive ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M3.28 2.22a.75.75 0 00-1.06 1.06L5.44 6.5H2.75a.75.75 0 000 1.5h4.5A.75.75 0 008 7.25v-4.5a.75.75 0 00-1.5 0v2.69L3.28 2.22zM13.5 2.75a.75.75 0 00-1.5 0v4.5c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-2.69l3.22-3.22a.75.75 0 00-1.06-1.06L13.5 5.44V2.75zM3.28 17.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 101.06 1.06zM13.5 14.56l3.22 3.22a.75.75 0 101.06-1.06l-3.22-3.22h2.69a.75.75 0 000-1.5h-4.5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-2.69z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM2 17.25v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 1.06L4.56 16.5h2.69a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM12.22 13.28l3.22 3.22h-2.69a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-1.5 0v2.69l-3.22-3.22a.75.75 0 10-1.06 1.06zM3.5 4.56l3.22 3.22a.75.75 0 001.06-1.06L4.56 3.5h2.69a.75.75 0 000-1.5h-4.5A.75.75 0 002 2.75v4.5a.75.75 0 001.5 0V4.56z" />
            </svg>
          )}
          <span className="hidden sm:inline">{fsActive ? 'צמצם' : 'מסך מלא'}</span>
        </button>
      </div>

      {/* ── Game picker panel ────────────────────────────────────────────── */}
      {panelOpen && (
        <div className="border-b border-white/[0.07] bg-[#0b1824] overflow-y-auto max-h-[50vh]">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <span className="text-sm font-black uppercase tracking-widest text-[#8aaac8] font-body">
              {currentRound ? <>מחזור <span className="font-stats">{currentRound}</span></> : 'משחקים'}
            </span>
            <span className="text-sm font-black text-[#5a7a9a]">{games.length} משחקים</span>
          </div>
          {games.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#5a7a9a]">אין משחקים למחזור זה</p>
          ) : (
            <div className="p-3 space-y-4">
              {rounds.map(round => (
                <div key={round}>
                  <div className="space-y-1.5">
                    {byRound[round].map(game => {
                      const isSelected = selected?.id === game.id;
                      const hPlayers   = playersFor(game.home_team_id);
                      const aPlayers   = playersFor(game.away_team_id);
                      return (
                        <div key={game.id}
                          className={`rounded-xl border transition-all ${
                            isSelected
                              ? 'border-orange-500/40 bg-orange-500/[0.08]'
                              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                          }`}
                        >
                          {/* Game header row */}
                          <button
                            onClick={() => selectGame(game)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-right"
                          >
                            {/* Home */}
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className={`text-sm font-black truncate font-heading ${isSelected ? 'text-orange-300' : 'text-white'}`}>
                                {game.home_name}
                              </span>
                              <TeamLogo logo={game.home_logo} name={game.home_name} size={8} />
                            </div>

                            <div className="shrink-0 text-center px-2">
                              <span className="text-[10px] font-black text-[#3a5a7a]">VS</span>
                              <p className="text-[9px] text-[#2a4a6a] mt-0.5">{game.game_date}</p>
                            </div>

                            {/* Away */}
                            <div className="flex items-center gap-2 flex-1">
                              <TeamLogo logo={game.away_logo} name={game.away_name} size={8} />
                              <span className={`text-sm font-black truncate font-heading ${isSelected ? 'text-orange-300' : 'text-white'}`}>
                                {game.away_name}
                              </span>
                            </div>

                            {isSelected && (
                              <span className="shrink-0 text-[10px] font-black text-green-400">✓ נבחר</span>
                            )}
                          </button>

                          {/* Expanded: rosters side by side */}
                          {isSelected && (
                            <div className="border-t border-white/[0.06] px-3 py-3">
                              <div className="grid grid-cols-2 gap-3">
                                {/* Home roster */}
                                <div>
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <TeamLogo logo={game.home_logo} name={game.home_name} size={6} />
                                    <p className="text-[10px] font-black text-orange-400 truncate font-heading">{game.home_name}</p>
                                  </div>
                                  {hPlayers.length === 0
                                    ? <p className="text-[10px] text-[#3a5a7a]">אין שחקנים</p>
                                    : <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                                        {hPlayers.map((p, i) => (
                                          <li key={i} className="flex items-center gap-1.5 text-[10px] text-[#8aaac8]">
                                            <span className="w-5 text-center font-mono text-[#4a6a8a] font-stats">{p.jersey_number ?? '–'}</span>
                                            <span className="truncate font-heading">{p.name}</span>
                                          </li>
                                        ))}
                                      </ul>
                                  }
                                </div>

                                {/* Away roster */}
                                <div>
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <TeamLogo logo={game.away_logo} name={game.away_name} size={6} />
                                    <p className="text-[10px] font-black text-orange-400 truncate font-heading">{game.away_name}</p>
                                  </div>
                                  {aPlayers.length === 0
                                    ? <p className="text-[10px] text-[#3a5a7a]">אין שחקנים</p>
                                    : <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                                        {aPlayers.map((p, i) => (
                                          <li key={i} className="flex items-center gap-1.5 text-[10px] text-[#8aaac8]">
                                            <span className="w-5 text-center font-mono text-[#4a6a8a] font-stats">{p.jersey_number ?? '–'}</span>
                                            <span className="truncate font-heading">{p.name}</span>
                                          </li>
                                        ))}
                                      </ul>
                                  }
                                </div>
                              </div>

                              {/* Inject button */}
                              <button
                                onClick={() => injectGame(game)}
                                className={`mt-3 w-full rounded-xl py-2 text-xs font-black transition-all ${
                                  injected
                                    ? 'bg-green-600/20 border border-green-500/30 text-green-400'
                                    : 'bg-orange-500 hover:bg-orange-400 text-white'
                                }`}
                              >
                                {injected ? '✓ נתונים הוזנו ללוח התוצאות' : '📋 הזן נתונים ללוח התוצאות'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* ── Iframe ──────────────────────────────────────────────────────── */}
      <div className="relative flex-1">

        {/* Loading */}
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🏀</div>
            </div>
            <p className="text-sm font-bold text-[#5a7a9a] animate-pulse">טוען לוח תוצאות...</p>
          </div>
        )}

        {/* Rotate exit button — shown on top of iframe when rotated */}
        {rotated && (
          <button
            onClick={() => setRotated(false)}
            className="fixed top-3 left-3 z-50 flex items-center gap-1.5 rounded-full bg-black/70 border border-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm"
          >
            ↩ חזור לאנכי
          </button>
        )}

        <div style={rotateStyle}>
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={SCOREBOARD_URL}
            className={`w-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            style={{
              height: rotated ? '100%' : 'calc(100vh - 53px)',
              border: 'none',
              display: 'block',
            }}
            allow="fullscreen"
            onLoad={() => setLoaded(true)}
            title="לוח תוצאות חי"
          />
        </div>
      </div>
    </div>
  );
}
