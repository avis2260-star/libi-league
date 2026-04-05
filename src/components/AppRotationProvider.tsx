'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type RotationCtx = { rotated: boolean; toggle: () => void };
const Ctx = createContext<RotationCtx>({ rotated: false, toggle: () => {} });

export function useAppRotation() {
  return useContext(Ctx);
}

export default function AppRotationProvider({ children }: { children: React.ReactNode }) {
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    if (rotated) {
      document.body.classList.add('app-rotated');
      try {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } catch {}
      try {
        (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
          .lock?.('landscape-primary')
          .catch(() => {});
      } catch {}
    } else {
      document.body.classList.remove('app-rotated');
      try {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      } catch {}
      try {
        (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
      } catch {}
    }
    return () => {
      document.body.classList.remove('app-rotated');
    };
  }, [rotated]);

  return (
    <Ctx.Provider value={{ rotated, toggle: () => setRotated(r => !r) }}>
      {children}
    </Ctx.Provider>
  );
}
