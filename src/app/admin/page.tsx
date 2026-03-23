import { supabaseAdmin } from '@/lib/supabase-admin';
import GamesTab from '@/components/admin/GamesTab';
import BoxScoreTab from '@/components/admin/BoxScoreTab';
import MediaTab from '@/components/admin/MediaTab';
import type { GameWithTeams } from '@/types';

async function getAllGames(): Promise<GameWithTeams[]> {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select(
      '*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)',
    )
    .order('game_date', { ascending: false })
    .order('game_time', { ascending: false });

  if (error) throw error;
  return data as GameWithTeams[];
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab ?? 'games';
  const games = await getAllGames();

  // Games relevant to each tab
  const activeGames = games.filter((g) => g.status !== 'Finished');
  const allGames = games;

  return (
    <>
      {tab === 'games' && <GamesTab games={activeGames} />}
      {tab === 'boxscore' && <BoxScoreTab games={allGames} />}
      {tab === 'media' && <MediaTab games={allGames} />}
    </>
  );
}
