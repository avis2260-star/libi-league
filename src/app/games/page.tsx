export const dynamic = 'force-dynamic';

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
  const [currentRound, logos] = await Promise.all([
    getCurrentRound(),
    getTeamLogos(),
  ]);

  return <GamesContent currentRound={currentRound} logos={logos} />;
}
