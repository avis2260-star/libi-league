export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import GamesContent from './GamesContent';

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

export default async function GamesPage() {
  const [currentRound, logos, closeGamesData, roundDatesData] = await Promise.all([
    getCurrentRound(),
    getTeamLogos(),
    supabaseAdmin
      .from('game_results')
      .select('round,date,home_team,away_team,home_score,away_score')
      .filter('techni', 'eq', false)
      .then(({ data }) =>
        (data ?? []).filter(
          (g) => Math.abs((g.home_score ?? 0) - (g.away_score ?? 0)) <= 3,
        )
      ),
    supabaseAdmin
      .from('league_settings')
      .select('value')
      .eq('key', 'round_dates')
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.value) return {} as Record<number, string>;
        try {
          const parsed = JSON.parse(data.value) as Record<string, string>;
          const r: Record<number, string> = {};
          for (const [k, v] of Object.entries(parsed)) r[parseInt(k)] = String(v);
          return r;
        } catch { return {} as Record<number, string>; }
      }),
  ]);

  type CloseGame = { round: number; date: string; home_team: string; away_team: string; home_score: number; away_score: number };

  return (
    <Suspense fallback={<div className="py-16 text-center text-[#5a7a9a]">טוען...</div>}>
      <GamesContent
        currentRound={currentRound}
        logos={logos}
        closeGames={closeGamesData as CloseGame[]}
        roundDates={roundDatesData}
      />
    </Suspense>
  );
}
