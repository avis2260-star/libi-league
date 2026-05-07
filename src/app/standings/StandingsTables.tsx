'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import TeamLink from '@/components/TeamLink';
import type { Standing } from '@/lib/league-data';
import { useLang } from '@/components/TranslationProvider';

export type FormEntry = { result: 'W' | 'L'; round: number };

export type StandingWithStreak = Standing & {
  streak: string;             // e.g. "W3" / "L2" / ""
  form: FormEntry[];          // last 5, newest first (rendered reversed so oldest is on the left)
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
  const { t } = useLang();
  const url = findLogo(name, logos);
  if (url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={t(name)} className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 rounded-full object-cover border border-white/10" />
  );
  return (
    <div className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[9px] font-black text-[#3a5a7a]">
      {[...t(name)].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

/* ── Streak pill with Last-5 tooltip ───────────────────────────────────── */
function StreakPill({ streak, form }: { streak: string; form: FormEntry[] }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  // The standings table wrapper uses `overflow-hidden` for its rounded
  // corners, which clips any absolutely-positioned tooltip that extends
  // beyond the wrapper. We sidestep the clip by rendering the tooltip
  // with `position: fixed` (escapes overflow ancestors) and computing
  // top/left from the trigger's bounding rect. The little arrow is then
  // independently positioned so it stays centered under the trigger,
  // even when the tooltip itself has been pushed back into the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    const arrow = arrowRef.current;
    if (!trigger || !tooltip) return;

    const tRect = trigger.getBoundingClientRect();
    const ttRect = tooltip.getBoundingClientRect();
    const margin = 8;

    // place above trigger, centered horizontally
    let left = tRect.left + tRect.width / 2 - ttRect.width / 2;
    const top = tRect.top - ttRect.height - 8;

    if (left < margin) left = margin;
    if (left + ttRect.width > window.innerWidth - margin) {
      left = window.innerWidth - margin - ttRect.width;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // arrow stays under the trigger center, even after tooltip clamping
    if (arrow) {
      const arrowLeft = tRect.left + tRect.width / 2 - left - 4; // 4 = half arrow width
      arrow.style.left = `${arrowLeft}px`;
    }
  }, [open]);

  // close the tooltip when the user scrolls or resizes — its fixed
  // position would otherwise drift away from the trigger.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (!streak) {
    return <span className="text-[#4a6a8a] text-xs">—</span>;
  }

  const isWin = streak.startsWith('W');

  // Render oldest → newest left-to-right (the universal "form guide"
  // convention); `form` is stored newest-first so we reverse here.
  const displayForm = [...form].reverse();

  return (
    <>
      <span
        ref={triggerRef}
        dir="ltr"
        className={[
          'inline-flex items-center gap-0.5 sm:gap-1 rounded-full px-1.5 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-bold tabular-nums',
          'ring-1 transition-colors cursor-pointer select-none',
          isWin
            ? 'bg-green-500/10 text-green-300 ring-green-500/30'
            : 'bg-red-500/10 text-red-300 ring-red-500/30',
        ].join(' ')}
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        {isWin ? '🔥' : '❄️'} {streak}
      </span>

      {form.length > 0 && open && (
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none"
          style={{ top: 0, left: 0 }}
          role="tooltip"
          dir="ltr"
        >
          <div className="relative rounded-lg bg-[#0f1e30] ring-1 ring-white/10 shadow-2xl shadow-black/60 px-3 py-2.5 w-max">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8aaac8] mb-2 text-center">
              {form.length} {t('משחקים אחרונים')}
            </div>
            <div className="flex items-center gap-1.5" dir="ltr">
              {displayForm.map((entry, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div
                    className={[
                      'w-6 h-6 rounded-full grid place-items-center text-[10px] font-black',
                      entry.result === 'W'
                        ? 'bg-green-500 text-green-950'
                        : 'bg-red-500 text-red-950',
                    ].join(' ')}
                  >
                    {entry.result}
                  </div>
                  <div className="text-[9px] font-bold text-[#5a7a9a] tabular-nums">
                    {entry.round}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="mt-1.5 flex items-center justify-between text-[8px] font-bold text-[#3a5a7a] uppercase tracking-wider"
              dir="ltr"
            >
              <span>{t('← ישן')}</span>
              <span>{t('חדש →')}</span>
            </div>
            <div
              ref={arrowRef}
              className="absolute -bottom-1 w-2 h-2 bg-[#0f1e30] ring-1 ring-white/10"
              style={{ left: '50%', transform: 'rotate(45deg)' }}
            />
          </div>
        </div>
      )}
    </>
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
  const { t } = useLang();
  type Col = { key: string; label: string; hide?: string };
  const COLS: Col[] = [
    { key: 'rank',    label: '#' },
    { key: 'name',    label: t('קבוצה') },
    { key: 'games',   label: t("מ'") },
    { key: 'wins',    label: t("נ'") },
    { key: 'losses',  label: t("ה'") },
    { key: 'pf',      label: t('זכות'),  hide: 'hidden md:table-cell' },
    { key: 'pa',      label: t('חובה'),  hide: 'hidden md:table-cell' },
    { key: 'diff',    label: '+/-' },
    { key: 'techni',  label: t("טכ'") },
    { key: 'penalty', label: '*' },
    { key: 'pts',     label: t("נק'") },
    { key: 'streak',  label: t('רצף') },
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
                  'border-b border-white/[0.05] px-1 sm:px-2 py-2.5 text-[10px] sm:text-[11px] font-heading font-bold uppercase tracking-wider text-orange-500/70',
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
            // Ranks 1-3 keep their podium colors (gold/silver/bronze).
            // Ranks 4+ now use the page's primary accent (orange) instead of
            // the previous washed-out blue-gray, so the standings has a single
            // consistent accent color throughout.
            const rankColor =
              team.rank === 1 ? '#e0c97a'
              : team.rank === 2 ? '#b0b8c8'
              : team.rank === 3 ? '#c87d3a'
              : '#f97316';

            const hasTechni    = team.techni > 0;
            const hasPenalty   = team.penalty < 0;
            const diffPositive = team.diff > 0;

            const rowBg =
              team.rank === 1 ? 'rgba(224,201,122,0.07)'
              : team.rank === 2 ? 'rgba(176,184,200,0.06)'
              : team.rank === 3 ? 'rgba(200,125,58,0.07)'
              : team.rank === 4 ? 'rgba(249,115,22,0.06)'
              : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';

            return (
              <tr
                key={team.name}
                className="border-b border-white/[0.04] transition-colors hover:bg-orange-500/[0.06]"
                style={{ background: rowBg }}
              >
                {/* # Rank */}
                <td className="px-1 sm:px-2 py-2.5 text-center">
                  <span className="font-stats text-base sm:text-xl font-bold" style={{ color: rankColor }}>
                    {team.rank}
                  </span>
                </td>

                {/* Team name + logo */}
                <td className="px-1 sm:px-2 py-2.5">
                  <div className="flex items-center gap-1.5 sm:gap-2 justify-start min-w-0">
                    <TeamLogo name={team.name} logos={logos} />
                    <TeamLink name={team.name} className="font-heading font-bold text-[10px] sm:text-sm text-[#e8edf5] text-right truncate" />
                  </div>
                </td>

                {/* Games played */}
                <td className="px-1 sm:px-2 py-2.5 text-center font-stats text-sm sm:text-lg text-[#8aaac8]">{team.games}</td>

                {/* Wins */}
                <td className="px-1 sm:px-2 py-2.5 text-center font-stats text-base sm:text-xl text-green-400">{team.wins}</td>

                {/* Losses */}
                <td className="px-1 sm:px-2 py-2.5 text-center font-stats text-base sm:text-xl text-red-400">{team.losses}</td>

                {/* Points for */}
                <td className="px-1 sm:px-2 py-2.5 text-center font-stats text-base text-[#8aaac8] hidden md:table-cell">{team.pf}</td>

                {/* Points against */}
                <td className="px-1 sm:px-2 py-2.5 text-center font-stats text-base text-[#8aaac8] hidden md:table-cell">{team.pa}</td>

                {/* +/- Spread */}
                <td dir="ltr" className={`px-1 sm:px-2 py-2.5 text-center font-stats text-sm sm:text-xl ${diffPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {diffPositive ? `+${team.diff}` : team.diff}
                </td>

                {/* טכ' */}
                <td className="px-1 sm:px-2 py-2.5 text-center font-stats text-base sm:text-lg text-[#8aaac8]">
                  {hasTechni ? team.techni : ''}
                </td>

                {/* * penalty */}
                <td dir="ltr" className="px-1 sm:px-2 py-2.5 text-center font-stats text-base sm:text-lg text-red-400">
                  {hasPenalty ? team.penalty : ''}
                </td>

                {/* Total points */}
                <td className="px-1 sm:px-2 py-2.5 text-center font-stats text-lg sm:text-2xl font-bold text-orange-400">
                  {team.pts}
                </td>

                {/* Streak */}
                <td className="px-1 sm:px-2 py-2.5 text-center">
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
        {t('הורדת נקודות על אי-הגעה לגמר אליפות / מפגש פתיחת עונה')} ·{' '}
        <span className="text-[#8aaac8]">{t('עמודת "טכ׳" = מספר עונשים')}</span>
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
  const { t } = useLang();
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <StandingsTable data={south} title={t('טבלת דרום')} logos={logos} />
      <StandingsTable data={north} title={t('טבלת צפון')} logos={logos} />
    </div>
  );
}
