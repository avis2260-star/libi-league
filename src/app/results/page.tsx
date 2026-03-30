export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { GAME_RESULTS, type GameResult } from '@/lib/league-data';
import ResultsContent from './ResultsContent';

async function getResults(): Promise<GameResult[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('game_results')
      .select('*')
      .order('round', { ascending: true });

    if (error || !data || data.length === 0) throw new Error('no data');

    return data.map((r) => ({
      round: r.round,
      date: r.date,
      division: r.division as 'North' | 'South',
      home: r.home_team,
      away: r.away_team,
      sh: r.home_score,
      sa: r.away_score,
      techni: r.techni ? r.techni_note : '',
    }));
  } catch {
    return GAME_RESULTS;
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

export default async function ResultsPage() {
  const [games, logos] = await Promise.all([getResults(), getTeamLogos()]);
  return <ResultsContent games={games} logos={logos} />;
}
