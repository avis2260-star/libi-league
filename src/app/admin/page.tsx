import { supabaseAdmin } from '@/lib/supabase-admin';
import GamesTab from '@/components/admin/GamesTab';
import BoxScoreTab from '@/components/admin/BoxScoreTab';
import MediaTab from '@/components/admin/MediaTab';
import ExcelSyncTab from '@/components/admin/ExcelSyncTab';
import PlayersTab from '@/components/admin/PlayersTab';
import type { GameWithTeams, Team } from '@/types';

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
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab ?? 'games';
  const games = await getAllGames();
  const activeGames = games.filter((g) => g.status !== 'Finished');

  let teams: Team[] = [];
  let players: { id: string; name: string; jersey_number: number | null; position: string | null; team_id: string | null; photo_url: string | null }[] = [];

  if (tab === 'players') {
    const [{ data: teamsData }, { data: playersData }] = await Promise.all([
      supabaseAdmin.from('teams').select('*').order('name'),
      supabaseAdmin.from('players').select('id,name,jersey_number,position,team_id,photo_url').order('name'),
    ]);
    teams   = (teamsData  ?? []) as Team[];
    players = (playersData ?? []) as typeof players;
  }

  return (
    <>
      {tab === 'games'    && <GamesTab games={activeGames} />}
      {tab === 'boxscore' && <BoxScoreTab games={games} />}
      {tab === 'media'    && <MediaTab games={games} />}
      {tab === 'sync'     && <ExcelSyncTab />}
      {tab === 'players'  && <PlayersTab teams={teams} players={players} />}
    </>
  );
}
