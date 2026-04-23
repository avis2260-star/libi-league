'use client';

import { useState } from 'react';
import TeamLink from '@/components/TeamLink';
import type { Standing } from '@/lib/league-data';

export type StandingWithStreak = Standing & {
  streak: string;             // e.g. "W3" / "L2" / ""
  form: ('W' | 'L')[];        // last 5, newest first
};

/* ── Team name aliases ────────────────────────────────────────────────── */
const TEAM_ALIASES: [string, string][] = [
  ['אריות קריית גת', 'א.ס. ק. גת'],
  ['אריות קריית גת', 'א.ט. ק. גת'],
  ['אריות קריית גת', 'אריות ק. גת'],
  ['ה.ה. גדרה',      'החברה הטובים גדרה'],
  ['ה.ה. גדרה',      'החברה הטובים'],
];
function normName(s: string) {
  return s.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function resolveAlias(name: string): string {
  const norm = normName(name);
  for (const [canonical, alias] of TEAM_ALIASES) {
    if (normName(alias) === norm || normName(canonical) === norm) return canonical;
  }
  return name;
}
function findLogo(name: string, logos: Record<string, string>): string | undefined {
  if (logos[name]) return logos[name];
  const resolved = resolveAlias(name);
  for (const [k, v] of Object.entries(logos)) {
    if (normName(k) === normName(name) || resolveAlias(k) === resolved) return v;
  }
  return undefined;
}

function TeamLogo({ name, logos }: { name: string; logos: Record<string, string> }) {
  const url = findLogo(name, logos);
  if (url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className="h-6 w-6 shrink-0 rounded-full object-cover border border-white/10" />
  );
  return (
    <div className="h-6 w-6 shrink-0 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[9px] font-black text-[#3a5a7a]">
      {[...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

/* ── Streak pill with Last-5 tooltip ───────────────────────────────────── */
function StreakPill({ streak, form }: { streak: string; form: ('W' | 'L')[] }) {
  const [open, setOpen] = useState(false);

  if (!streak) {
    return <span className="text-[#4a6a8a] text-xs">—</span>;
  }

  const isWin = streak.startsWith('W');

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span
        dir="ltr"
        className={[
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums',
          'ring-1 transition-colors cursor-default',
          isWin
            ? 'bg-green-500/10 text-green-300 ring-green-500/30'
            : 'bg-red-500/10 text-red-300 ring-red-500/30',
        ].join(' ')}
      >
        {isWin ? '🔥' : '❄️'} {streak}
      </span>

      {form.length > 0 && (
        <div
          className={[
            'absolute z-30 bottom-full mb-2 left-1/2 -translate-x-1/2',
            'pointer-events-none transition-all duration-150',
            open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
          ].join(' ')}
          role="tooltip"
          dir="ltr"
        >
          <div className="rounded-lg bg-[#0f1e30] ring-1 ring-white/10 shadow-2xl shadow-black/60 px-3 py-2.5 w-max">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8aaac8] mb-1.5 text-center">
              5 משחקים אחרונים
            </div>
            <div className="flex items-center gap-1.5" dir="ltr">
              {form.map((r, i) => (
                <div
                  key={i}
                  className={[
                    'w-5 h-5 rounded-full grid place-items-center text-[10px] font-black',
                    r === 'W' ? 'bg-green-500 text-green-950' : 'bg-red-500 text-red-950',
                  ].join(' ')}
                >
                  {r}
                </div>
              ))}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[#0f1e30] ring-1 ring-white/10" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Single division table ────────────────────────────────────────────── */
function StandingsTable({
  data, title, logos,
}: {
  data: StandingWithStreak[];
  title: string;
  logos: Record<string, string>;
}) {
  type Col = { key: string; label: string; hide?: string };
  const COLS: Col[] = [
    { key: 'rank',    label: '#' },
    { key: 'name',    label: 'קבוצה' },
    { key: 'games',   label: "מ'" },
    { key: 'wins',    label: "נ'" },
    { key: 'losses',  label: "ה'" },
    { key: 'pf',      label: 'זכות',  hide: 'hidden md:table-cell' },
    { key: 'pa',      label: 'חובה',  hide: 'hidden md:table-cell' },
    { key: 'diff',    label: '+/-' },
    { key: 'techni',  label: "טכ'",   hide: 'hidden lg:table-cell' },
    { key: 'penalty', label: '*',     hide: 'hidden lg:table-cell' },
    { key: 'pts',     label: "נק'" },
    { key: 'streak',  label: 'רצף' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04]">
      {/* Card header */}
      <div className="border-b border-white/[0.06] px-5 py-4">
        <span className="text-base font-bold text-[#e0c97a]">🏀 {title}</span>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-sm table-auto">
        <thead>
          <tr className="bg-white/[0.03]">
            {COLS.map((c) => (
              <th
                key={c.key}
                className={[
                  'border-b border-white/[0.05] px-1.5 sm:px-2 py-2.5 text-[10px] sm:text-[11px] font-heading font-bold uppercase tracking-wider text-orange-500/70',
                  c.hide ?? '',
                ].join(' ')}
                style={{ textAlign: c.key === 'name' ? 'right' : 'center' }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((team, i) => {
            const rankColor =
              team.rank === 1 ? '#e0c97a'
              : team.rank === 2 ? '#b0b8c8'
              : team.rank === 3 ? '#c87d3a'
              : '#4a6a8a';

            const hasTechni    = team.techni > 0;
            const hasPenalty   = team.penalty < 0;
            const diffPositive = team.diff > 0;

            const rowBg =
              team.rank === 1 ? 'rgba(224,201,122,0.07)'
              : team.rank === 2 ? 'rgba(176,184,200,0.06)'
              : team.rank === 3 ? 'rgba(200,125,58,0.07)'
              : team.rank === 4 ? 'rgba(74,106,138,0.08)'
              : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';

            return (
              <tr
                key={team.name}
                className="border-b border-white/[0.04] transition-colors hover:bg-orange-500/[0.06]"
                style={{ background: rowBg }}
              >
                {/* # Rank */}
                <td className="px-1.5 sm:px-2 py-2.5 text-center">
                  <span className="font-stats text-lg sm:text-xl font-bold" style={{ color: rankColor }}>
                    {team.rank}
                  </span>
                </td>

                {/* Team name + logo */}
                <td className="px-1.5 sm:px-2 py-2.5">
                  <div className="flex items-center gap-2 justify-start min-w-0">
                    <TeamLogo name={team.name} logos={logos} />
                    <TeamLink name={team.name} className="font-heading font-bold text-[#e8edf5] text-right truncate" />
                  </div>
                </td>

                {/* Games played */}
                <td className="px-1.5 sm:px-2 py-2.5 text-center font-stats text-base sm:text-lg text-[#8aaac8]">{team.games}</td>

                {/* Wins */}
                <td className="px-1.5 sm:px-2 py-2.5 text-center font-stats text-lg sm:text-xl text-green-400">{team.wins}</td>

                {/* Losses */}
                <td className="px-1.5 sm:px-2 py-2.5 text-center font-stats text-lg sm:text-xl text-red-400">{team.losses}</td>

                {/* Points for */}
                <td className="px-1.5 sm:px-2 py-2.5 text-center font-stats text-base text-[#8aaac8] hidden md:table-cell">{team.pf}</td>

                {/* Points against */}
                <td className="px-1.5 sm:px-2 py-2.5 text-center font-stats text-base text-[#8aaac8] hidden md:table-cell">{team.pa}</td>

                {/* +/- Spread */}
                <td dir="ltr" className={`px-1.5 sm:px-2 py-2.5 text-center font-stats text-lg sm:text-xl ${diffPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {diffPositive ? `+${team.diff}` : team.diff}
                </td>

                {/* טכ' */}
                <td className="px-1.5 sm:px-2 py-2.5 text-center font-stats text-lg text-[#8aaac8] hidden lg:table-cell">
                  {hasTechni ? team.techni : ''}
                </td>

                {/* * penalty */}
                <td dir="ltr" className="px-1.5 sm:px-2 py-2.5 text-center font-stats text-lg text-red-400 hidden lg:table-cell">
                  {hasPenalty ? team.penalty : ''}
                </td>

                {/* Total points */}
                <td className="px-1.5 sm:px-2 py-2.5 text-center font-stats text-xl sm:text-2xl font-bold text-orange-400">
                  {team.pts}
                </td>

                {/* Streak */}
                <td className="px-1.5 sm:px-2 py-2.5 text-center">
                  <StreakPill streak={team.streak} form={team.form} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="border-t border-white/[0.04] px-4 py-2.5 text-xs font-bold text-[#8aaac8] leading-relaxed">
        <span className="text-red-400/80">*</span>{' '}
        הורדת נקודות על אי-הגעה לגמר אליפות / מפגש פתיחת עונה ·{' '}
        <span className="text-[#8aaac8]">עמודת &quot;טכ׳&quot; = מספר עונשים</span>
      </div>
    </div>
  );
}

/* ── Page wrapper ─────────────────────────────────────────────────────── */
export default function StandingsTables({
  north, south, logos,
}: {
  north: StandingWithStreak[];
  south: StandingWithStreak[];
  logos: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <StandingsTable data={south} title="טבלת דרום" logos={logos} />
      <StandingsTable data={north} title="טבלת צפון" logos={logos} />
    </div>
  );
}
