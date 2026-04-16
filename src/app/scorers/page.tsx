export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';

type ScorerRow = {
  id: string;
  name: string;
  photo_url: string | null;
  jersey_number: number | null;
  team_name: string | null;
  points: number;
  three_pointers: number;
  fouls: number;
};

async function getScorers(): Promise<ScorerRow[]> {
  const { data } = await supabaseAdmin
    .from('players')
    .select('id, name, photo_url, jersey_number, points, three_pointers, fouls, team:teams(name)')
    .eq('is_active', true)
    .gt('points', 0)
    .order('points', { ascending: false })
    .limit(20);

  return ((data ?? []) as unknown as {
    id: string; name: string; photo_url: string | null; jersey_number: number | null;
    points: number; three_pointers: number; fouls: number;
    team: { name: string } | null;
  }[]).map(p => ({
    id:             p.id,
    name:           p.name,
    photo_url:      p.photo_url,
    jersey_number:  p.jersey_number,
    team_name:      p.team?.name ?? null,
    points:         p.points,
    three_pointers: p.three_pointers,
    fouls:          p.fouls,
  }));
}

const MEDAL = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

export default async function ScorersPage() {
  const scorers = await getScorers();

  return (
    <div dir="rtl" className="space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Link href="/" className="mb-2 inline-block text-xs text-[#5a7a9a] hover:text-orange-400 transition-colors">
            ← חזרה לדף הבית
          </Link>
          <h1 className="text-2xl font-black text-white flex items-center gap-2 font-heading">
            <span className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 px-2 py-1 text-sm">🏅</span>
            רשימת קלעי הליגה
          </h1>
          <p className="text-sm text-[#5a7a9a] mt-0.5 font-body">טבלת מובילי הנקודות — עונת 2025–2026</p>
        </div>
      </div>

      {scorers.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] py-20 text-center">
          <p className="text-4xl mb-3">🏀</p>
          <p className="text-[#5a7a9a]">אין נתוני קליעה עדיין</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[3rem_1fr_6rem_6rem_6rem] gap-2 px-5 py-3 border-b border-white/[0.08] text-[10px] font-bold uppercase tracking-widest text-[#3a5a7a]">
            <span className="text-center">מקום</span>
            <span>שחקן</span>
            <span className="text-center">נק׳</span>
            <span className="text-center">3נק׳</span>
            <span className="text-center">פאולים</span>
          </div>

          {scorers.map((p, i) => {
            const maxPts = scorers[0].points || 1;
            return (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="flex sm:grid sm:grid-cols-[3rem_1fr_6rem_6rem_6rem] gap-0 sm:gap-2 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors group"
              >
                {/* Rank */}
                <div className="w-14 sm:w-auto shrink-0 px-3 sm:px-0 py-4 flex flex-col items-center justify-center">
                  {i < 3 ? (
                    <span className="text-xl">{MEDAL[i]}</span>
                  ) : (
                    <span className={`text-sm font-black font-stats ${RANK_COLORS[i] ?? 'text-[#5a7a9a]'}`}>{i + 1}</span>
                  )}
                </div>

                {/* Player */}
                <div className="flex flex-1 min-w-0 items-center gap-3 py-3 pr-0 sm:pr-2">
                  {/* Avatar */}
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.10] bg-white/[0.04]">
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-black text-[#4a6a8a]">
                        {p.name.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Name / team */}
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white group-hover:text-orange-300 transition-colors leading-tight font-heading">
                      {p.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.jersey_number !== null && (
                        <span className="text-[10px] font-bold text-orange-400/80 shrink-0 font-stats">#{p.jersey_number}</span>
                      )}
                      {p.team_name && (
                        <span className="truncate text-[11px] text-[#3a5a7a] font-body">{p.team_name}</span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.06]">
                      <div
                        className="h-1 rounded-full bg-gradient-to-l from-orange-500 to-orange-700"
                        style={{ width: `${Math.round((p.points / maxPts) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Points */}
                <div className="w-16 sm:w-auto shrink-0 px-2 py-4 text-center">
                  <p className="text-lg font-black text-orange-400 font-stats">{p.points}</p>
                  <p className="text-[9px] text-[#3a5a7a] sm:hidden font-body">נק׳</p>
                </div>

                {/* 3PT */}
                <div className="hidden sm:block py-4 text-center">
                  <p className="text-base font-semibold text-sky-400 font-stats">{p.three_pointers}</p>
                </div>

                {/* Fouls */}
                <div className="hidden sm:block py-4 text-center">
                  <p className="text-base text-rose-400 font-stats">{p.fouls}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Mobile extra columns note */}
      <p className="text-center text-xs text-[#3a5a7a] sm:hidden">
        סובב למצב אופקי לצפייה בנתוני 3נק׳ ופאולים
      </p>
    </div>
  );
}
