'use client';

import { createContext, useContext, useState } from 'react';

type RotationCtx = { rotated: boolean; toggle: () => void };
const Ctx = createContext<RotationCtx>({ rotated: false, toggle: () => {} });

export function useAppRotation() {
  return useContext(Ctx);
}

export default function AppRotationProvider({ children }: { children: React.ReactNode }) {
  const [rotated, setRotated] = useState(false);
  return (
    <Ctx.Provider value={{ rotated, toggle: () => setRotated(r => !r) }}>
      {children}
    </Ctx.Provider>
  );
}
