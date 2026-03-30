export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';

const ALL_ROUND_DATES: Record<number, string> = {
  1: '01.11.25', 2: '08.11.25', 3: '29.11.25', 4: '20.12.25',
  5: '10.01.26', 6: '17.01.26', 7: '07.02.26', 8: '21.02.26',
  9: '28.02.26', 10: '14.03.26', 11: '21.03.26',
  12: '10.04.26', 13: '17.04.26', 14: '24.04.26',
};

async function getCurrentRound(): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('game_results')
      .select('round')
      .order('round', { ascending: false })
      .limit(1);
    return data?.[0]?.round ?? 0;
  } catch {
    return 0;
  }
}

async function getTeamLogos(): Promise<Record<string, string>> {
  try {
    const { data } = await supabaseAdmin.from('teams').select('name, logo_url');
    const map: Record<string, string> = {};
    for (const t of data ?? []) {
      if (t.name && t.logo_url) map[t.name] = t.logo_url;
    }
    return map;
  } catch {
    return {};
  }
}

function normName(n: string) {
  return n.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function findLogo(name: string, logos: Record<string, string>) {
  return logos[name] ?? Object.entries(logos).find(([k]) => normName(k) === normName(name))?.[1];
}

// ── Team logo bubble ──────────────────────────────────────────────────────────
function TeamLogo({ name, logos }: { name: string; logos: Record<string, string> }) {
  const url = findLogo(name, logos);
  if (url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name}
      className="h-7 w-7 shrink-0 rounded-full object-cover border border-white/10 shadow-sm" />
  );
  return (
    <div className="h-7 w-7 shrink-0 rounded-full bg-[#1a2e45] border border-white/10 flex items-center justify-center text-[9px] font-black text-[#3a5a7a]">
      {[...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

// ── Upcoming game row ─────────────────────────────────────────────────────────
function UpcomingRow({ home, away, logos }: { home: string; away: string; logos: Record<string, string> }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
      {/* Home — logo right, name left of logo */}
      <Link href={`/team/${encodeURIComponent(home)}`} className="flex flex-1 items-center justify-end gap-2 min-w-0 group">
        <span className="truncate text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">{home}</span>
        <TeamLogo name={home} logos={logos} />
      </Link>

      <span className="shrink-0 rounded-lg bg-black/30 px-2.5 py-1 text-xs font-bold text-[#4a6a8a]">VS</span>

      {/* Away — logo left, name right of logo */}
      <Link href={`/team/${encodeURIComponent(away)}`} className="flex flex-1 items-center justify-start gap-2 min-w-0 group">
        <TeamLogo name={away} logos={logos} />
        <span className="truncate text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">{away}</span>
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function GamesPage() {
  const [currentRound, logos] = await Promise.all([
    getCurrentRound(),
    getTeamLogos(),
  ]);
  const nextRound = currentRound + 1;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-black text-white">לוח משחקים</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">מחזורים 1–14 · עונת 2025–2026</p>
      </div>

      {Array.from({ length: 14 }, (_, i) => 14 - i).map((round) => {
        const isPlayed = round <= currentRound;
        const isNext   = round === nextRound;
        const date     = ALL_ROUND_DATES[round] ?? '';
        const northGames = LIBI_SCHEDULE.filter((g) => g.round === round && g.division === 'North');
        const southGames = LIBI_SCHEDULE.filter((g) => g.round === round && g.division === 'South');

        return (
          <section key={round} id={`round-${round}`}>
            <div className="mb-4 flex items-center gap-3">
              <div className={`rounded-2xl border px-4 py-1.5 text-sm font-bold ${
                isNext   ? 'border-orange-500/50 bg-orange-500/15 text-orange-400' :
                isPlayed ? 'border-green-500/20 bg-green-500/10 text-green-400' :
                           'border-white/10 bg-white/5 text-[#8aaac8]'
              }`}>
                מחזור {round}{isNext ? ' ← הבא' : ''}{isPlayed ? ' ✓' : ''}
              </div>
              <span className="text-sm text-[#4a6a8a]">{date}</span>
              <div className="h-px flex-1 bg-white/[0.05]" />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-orange-400">
                  <span className="h-2 w-2 rounded-full bg-orange-400" /> מחוז דרום
                </h3>
                {southGames.map((g, i) => <UpcomingRow key={i} home={g.homeTeam} away={g.awayTeam} logos={logos} />)}
              </div>
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400">
                  <span className="h-2 w-2 rounded-full bg-blue-400" /> מחוז צפון
                </h3>
                {northGames.map((g, i) => <UpcomingRow key={i} home={g.homeTeam} away={g.awayTeam} logos={logos} />)}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
