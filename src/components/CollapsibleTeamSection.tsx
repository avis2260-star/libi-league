'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Position } from '@/types';

const POSITION_LABELS: Record<Position, string> = {
  PG: 'Point Guard',
  SG: 'Shooting Guard',
  SF: 'Small Forward',
  PF: 'Power Forward',
  C:  'Center',
};

const POSITION_COLORS: Record<Position, string> = {
  PG: 'text-sky-400     bg-sky-500/10     border-sky-500/20',
  SG: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  SF: 'text-violet-400  bg-violet-500/10  border-violet-500/20',
  PF: 'text-amber-400   bg-amber-500/10   border-amber-500/20',
  C:  'text-rose-400    bg-rose-500/10    border-rose-500/20',
};

interface Player {
  id: string;
  name: string;
  jersey_number: number | null;
  position: Position | null;
  team: { name: string; logo_url: string | null } | null;
}

interface Props {
  teamName: string;
  teamLogo?: string | null;
  players: Player[];
  defaultOpen?: boolean;
}

export default function CollapsibleTeamSection({ teamName, teamLogo, players, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      {/* Team header — clickable toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-right transition hover:bg-white/[0.03]"
      >
        {/* Logo */}
        {teamLogo ? (
          <Image
            src={teamLogo}
            alt={teamName}
            width={32}
            height={32}
            className="shrink-0 rounded-full object-cover border border-white/10"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] border border-white/10 text-sm font-bold text-[#8aaac8]">
            {teamName.charAt(0)}
          </span>
        )}

        {/* Name + count */}
        <span className="flex-1 text-right font-bold text-white">{teamName}</span>
        <span className="text-sm text-[#5a7a9a]">{players.length} שחקנים</span>

        {/* Chevron */}
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-[#3a5a7a] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Player list */}
      {open && (
        <div className="border-t border-white/[0.05] px-3 pb-3 pt-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition hover:border-orange-500/30 hover:bg-orange-500/[0.04]"
              >
                {/* Jersey */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] border border-white/10 text-sm font-black text-[#e8edf5]">
                  {player.jersey_number !== null ? `#${player.jersey_number}` : '—'}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#e8edf5] group-hover:text-orange-400 transition-colors">
                    {player.name}
                  </p>
                  {player.position && (
                    <span className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${POSITION_COLORS[player.position]}`}>
                      {POSITION_LABELS[player.position]}
                    </span>
                  )}
                </div>

                <span className="text-[#3a5a7a] transition group-hover:text-orange-400 text-sm">›</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
