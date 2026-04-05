export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import LiveClient from './LiveClient';

export type LiveGame = {
  id: string;
  game_date: string;
  round: number | null;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
  home_team_id: string;
  away_team_id: string;
};

export type LivePlayer = {
  name: string;
  jersey_number: number | null;
  team_id: string;
};

export default async function LivePage() {
  // 1. Current round from game_results
  const { data: roundRows } = await supabaseAdmin
    .from('game_results')
    .select('round')
    .order('round', { ascending: false })
    .limit(1);
  const currentRound: number = roundRows?.[0]?.round ?? 0;
  const nextRound = currentRound + 1;

  // 2. Schedule entries for the next round
  const entries = LIBI_SCHEDULE.filter(g => g.round === nextRound);
  // If no entries for next round, fall back to current round
  const targetEntries = entries.length > 0
    ? entries
    : LIBI_SCHEDULE.filter(g => g.round === currentRound);
  const targetRound = entries.length > 0 ? nextRound : currentRound;

  // 3. Team map: name → { id, logo_url }
  const { data: teamRows } = await supabaseAdmin
    .from('teams')
    .select('id, name, logo_url');
  const teamMap = new Map<string, { id: string; logo_url: string | null }>();
  for (const t of teamRows ?? []) {
    teamMap.set(t.name, { id: t.id, logo_url: t.logo_url });
  }

  // 4. Build LiveGame list
  const games: LiveGame[] = targetEntries.map((entry, i) => {
    const home = teamMap.get(entry.homeTeam);
    const away = teamMap.get(entry.awayTeam);
    return {
      id: `${targetRound}-${i}`,
      game_date: entry.date,
      round: targetRound,
      home_name: entry.homeTeam,
      away_name: entry.awayTeam,
      home_logo: home?.logo_url ?? null,
      away_logo: away?.logo_url ?? null,
      home_team_id: home?.id ?? '',
      away_team_id: away?.id ?? '',
    };
  });

  // 5. Players
  const { data: rawPlayers } = await supabaseAdmin
    .from('players')
    .select('name, jersey_number, team_id')
    .eq('is_active', true)
    .order('jersey_number', { nullsFirst: false });
  const players: LivePlayer[] = (rawPlayers ?? []) as LivePlayer[];

  return <LiveClient games={games} players={players} currentRound={targetRound} />;
}
