'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type RotationCtx = { rotated: boolean; toggle: () => void };
const Ctx = createContext<RotationCtx>({ rotated: false, toggle: () => {} });

export function useAppRotation() {
  return useContext(Ctx);
}

type OrientationExt = ScreenOrientation & {
  lock?: (o: string) => Promise<void>;
  unlock?: () => void;
};

export default function AppRotationProvider({ children }: { children: React.ReactNode }) {
  const [rotated, setRotated] = useState(false);

  // Auto-exit when user physically rotates phone back to portrait
  useEffect(() => {
    function onOrientChange() {
      const type = screen.orientation?.type ?? '';
      if (rotated && type.startsWith('portrait')) {
        setRotated(false);
      }
    }
    screen.orientation?.addEventListener?.('change', onOrientChange);
    return () => screen.orientation?.removeEventListener?.('change', onOrientChange);
  }, [rotated]);

  async function activate() {
    // Step 1: request fullscreen (required for orientation lock)
    try { await document.documentElement.requestFullscreen?.(); } catch {}
    // Step 2: lock to landscape at OS level — proper scrolling, no broken CSS
    try { await (screen.orientation as OrientationExt).lock?.('landscape-primary'); } catch {}
    setRotated(true);
  }

  function deactivate() {
    try { (screen.orientation as OrientationExt).unlock?.(); } catch {}
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
    setRotated(false);
  }

  return (
    <Ctx.Provider value={{ rotated, toggle: () => (rotated ? deactivate() : activate()) }}>
      {children}
    </Ctx.Provider>
  );
}
