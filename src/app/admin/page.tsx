export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import GamesTab from '@/components/admin/GamesTab';
import BoxScoreTab from '@/components/admin/BoxScoreTab';
import MediaTab from '@/components/admin/MediaTab';
import ExcelSyncTab from '@/components/admin/ExcelSyncTab';
import PlayersTab from '@/components/admin/PlayersTab';
import SeasonsTab from '@/components/admin/SeasonsTab';
import OfficialsTab from '@/components/admin/OfficialsTab';
import DisciplinaryTab from '@/components/admin/DisciplinaryTab';
import LeagueSettingsTab from '@/components/admin/LeagueSettingsTab';
import AnnouncementsTab from '@/components/admin/AnnouncementsTab';
import SyncLogTab from '@/components/admin/SyncLogTab';
import TeamsTab from '@/components/admin/TeamsTab';
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
  let players: { id: string; name: string; jersey_number: number | null; position: string | null; team_id: string | null; photo_url: string | null; date_of_birth: string | null }[] = [];

  if (tab === 'players') {
    const [{ data: teamsData }, { data: playersData }] = await Promise.all([
      supabaseAdmin.from('teams').select('*').order('name'),
      supabaseAdmin.from('players').select('id,name,jersey_number,position,team_id,photo_url,date_of_birth').order('name'),
    ]);
    teams   = (teamsData  ?? []) as Team[];
    players = (playersData ?? []) as typeof players;
  }

  // Teams tab
  let teamsForTab: { id: string; name: string; logo_url: string | null; captain_name: string | null; contact_info: string | null }[] = [];
  if (tab === 'teams') {
    const { data } = await supabaseAdmin.from('teams').select('id,name,logo_url,captain_name,contact_info').order('name');
    teamsForTab = (data ?? []) as typeof teamsForTab;
  }

  // Seasons tab
  let seasons: { id: string; name: string; year: string | null; status: string; start_date: string | null; end_date: string | null; created_at: string }[] = [];
  if (tab === 'seasons') {
    const { data } = await supabaseAdmin.from('seasons').select('*').order('created_at', { ascending: false });
    seasons = (data ?? []) as typeof seasons;
  }

  // Officials tab
  let officials: { id: string; name: string; role: string; phone: string | null; email: string | null }[] = [];
  if (tab === 'officials') {
    const { data } = await supabaseAdmin.from('officials').select('*').order('name');
    officials = (data ?? []) as typeof officials;
  }

  // Disciplinary tab
  let disciplinaryRecords: { id: string; player_id: string | null; player_name: string; team_name: string | null; type: string; round: number | null; notes: string | null; created_at: string }[] = [];
  let playerOptions: { id: string; name: string; team_name: string | null }[] = [];
  if (tab === 'disciplinary') {
    const [{ data: recData }, { data: plData }, { data: tmData }] = await Promise.all([
      supabaseAdmin.from('disciplinary_records').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('players').select('id,name,team_id').order('name'),
      supabaseAdmin.from('teams').select('id,name'),
    ]);
    disciplinaryRecords = (recData ?? []) as typeof disciplinaryRecords;
    const teamMap: Record<string, string> = {};
    for (const t of (tmData ?? [])) teamMap[(t as { id: string; name: string }).id] = (t as { id: string; name: string }).name;
    playerOptions = ((plData ?? []) as { id: string; name: string; team_id: string | null }[]).map((p) => ({
      id: p.id,
      name: p.name,
      team_name: p.team_id ? (teamMap[p.team_id] ?? null) : null,
    }));
  }

  // League settings tab
  let leagueSettings: { key: string; value: string }[] = [];
  if (tab === 'settings') {
    const { data } = await supabaseAdmin.from('league_settings').select('key,value').order('key');
    leagueSettings = (data ?? []) as typeof leagueSettings;
  }

  // Announcements tab
  let announcements: { id: string; message: string; type: string; active: boolean; bg_color: string; created_at: string; expires_at: string | null }[] = [];
  if (tab === 'announcements') {
    const { data } = await supabaseAdmin.from('announcements').select('*').order('created_at', { ascending: false });
    announcements = (data ?? []) as typeof announcements;
  }

  // Sync log tab
  let syncLogs: { id: string; uploaded_at: string; filename: string | null; north_count: number; south_count: number; results_count: number; is_rolled_back: boolean }[] = [];
  if (tab === 'synclog') {
    const { data } = await supabaseAdmin
      .from('sync_logs')
      .select('id,uploaded_at,filename,north_count,south_count,results_count,is_rolled_back')
      .order('uploaded_at', { ascending: false })
      .limit(20);
    syncLogs = (data ?? []) as typeof syncLogs;
  }

  return (
    <>
      {tab === 'games'         && <GamesTab games={activeGames} />}
      {tab === 'teams'         && <TeamsTab teams={teamsForTab} />}
      {tab === 'boxscore'      && <BoxScoreTab games={games} />}
      {tab === 'media'         && <MediaTab games={games} />}
      {tab === 'sync'          && <ExcelSyncTab />}
      {tab === 'players'       && <PlayersTab teams={teams} players={players} />}
      {tab === 'seasons'       && <SeasonsTab seasons={seasons} />}
      {tab === 'officials'     && <OfficialsTab officials={officials} />}
      {tab === 'disciplinary'  && <DisciplinaryTab records={disciplinaryRecords} players={playerOptions} />}
      {tab === 'settings'      && <LeagueSettingsTab settings={leagueSettings} />}
      {tab === 'announcements' && <AnnouncementsTab announcements={announcements} />}
      {tab === 'synclog'       && <SyncLogTab logs={syncLogs} />}
    </>
  );
}
