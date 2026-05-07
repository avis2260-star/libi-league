export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import GamesContent from './GamesContent';
import { getLang, st } from '@/lib/get-lang';
import { makeNameResolver } from '@/lib/team-name-resolver';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';

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
  const [currentRound, logos, closeGamesData, roundDatesData, lang] = await Promise.all([
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
    getLang(),
  ]);
  const T = (he: string) => st(he, lang);

  type CloseGame = { round: number; date: string; home_team: string; away_team: string; home_score: number; away_score: number };

  // Re-render every team name through the admin Teams tab — that's the
  // canonical source for display names, so renames there propagate here.
  const { data: teamRows } = await supabaseAdmin.from('teams').select('id, name');
  const resolveName = makeNameResolver((teamRows ?? []) as { id: string; name: string }[]);
  const closeGamesResolved = (closeGamesData as CloseGame[]).map((g) => ({
    ...g,
    home_team: resolveName(g.home_team),
    away_team: resolveName(g.away_team),
  }));

  // Build a lookup from every schedule team name → its current admin name
  // so the round listings (which key off LIBI_SCHEDULE) can render the
  // canonical name without re-running the resolver per row.
  const scheduleTeamNames = Array.from(new Set(
    LIBI_SCHEDULE.flatMap((g) => [g.homeTeam, g.awayTeam]),
  ));
  const displayNames: Record<string, string> = {};
  for (const n of scheduleTeamNames) displayNames[n] = resolveName(n);

  return (
    <Suspense fallback={<div className="py-16 text-center text-[#5a7a9a]">{T('טוען...')}</div>}>
      <GamesContent
        currentRound={currentRound}
        logos={logos}
        closeGames={closeGamesResolved}
        roundDates={roundDatesData}
        displayNames={displayNames}
      />
    </Suspense>
  );
}
