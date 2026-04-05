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
import TakanonTab from '@/components/admin/TakanonTab';
import PlayoffTab from '@/components/admin/PlayoffTab';
import SubmissionsTab, { type SubmissionRow } from '@/components/admin/SubmissionsTab';
import MessagesTab, { type ContactMessage } from '@/components/admin/MessagesTab';
import TermsTab from '@/components/admin/TermsTab';
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
  const activeGames = games
    .filter((g) => g.status !== 'Finished')
    .sort((a, b) => {
      const d = a.game_date.localeCompare(b.game_date);
      return d !== 0 ? d : (a.game_time ?? '').localeCompare(b.game_time ?? '');
    });

  let teams: Team[] = [];
  let players: { id: string; name: string; jersey_number: number | null; position: string | null; team_id: string | null; photo_url: string | null; date_of_birth: string | null; is_active: boolean }[] = [];

  if (tab === 'players') {
    const [{ data: teamsData }, { data: playersData }] = await Promise.all([
      supabaseAdmin.from('teams').select('*').order('name'),
      supabaseAdmin.from('players').select('id,name,jersey_number,position,team_id,photo_url,date_of_birth,is_active').order('name'),
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
  let tickerSpeed = 25;
  if (tab === 'announcements') {
    const [{ data }, { data: speedRow }] = await Promise.all([
      supabaseAdmin.from('announcements').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('league_settings').select('value').eq('key', 'ticker_speed').maybeSingle(),
    ]);
    announcements = (data ?? []) as typeof announcements;
    tickerSpeed = speedRow?.value ? parseInt(speedRow.value, 10) : 25;
  }

  // Submissions tab
  let submissions: SubmissionRow[] = [];
  if (tab === 'submissions') {
    type RawSub = {
      id: string; game_id: string; submitted_by: string; confidence_score: number;
      quality_status: string; extracted_stats: SubmissionRow['extracted_stats'];
      home_score: number; away_score: number;
      status: 'pending' | 'needs_review' | 'approved' | 'rejected';
      review_notes: string | null; created_at: string;
      game: {
        game_date: string;
        home_team: { name: string } | null;
        away_team: { name: string } | null;
      } | null;
    };
    const { data: subData } = await supabaseAdmin
      .from('game_submissions')
      .select(`
        *,
        game:games(
          game_date,
          home_team:teams!games_home_team_id_fkey(name),
          away_team:teams!games_away_team_id_fkey(name)
        )
      `)
      .order('created_at', { ascending: false });

    submissions = ((subData ?? []) as RawSub[]).map((s) => ({
      id: s.id,
      game_id: s.game_id,
      submitted_by: s.submitted_by,
      confidence_score: s.confidence_score ?? 0,
      quality_status: s.quality_status ?? 'pass',
      extracted_stats: s.extracted_stats,
      home_score: s.home_score ?? 0,
      away_score: s.away_score ?? 0,
      status: s.status,
      review_notes: s.review_notes,
      created_at: s.created_at,
      home_name: s.game?.home_team?.name ?? 'בית',
      away_name: s.game?.away_team?.name ?? 'חוץ',
      game_date: s.game?.game_date ?? '',
    }));
  }

  // Terms & privacy tab
  let termsOfUse = '';
  let privacyPolicy = '';
  if (tab === 'terms') {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabaseAdmin.from('league_settings').select('value').eq('key', 'terms_of_use').maybeSingle(),
      supabaseAdmin.from('league_settings').select('value').eq('key', 'privacy_policy').maybeSingle(),
    ]);
    termsOfUse = t?.value ?? '';
    privacyPolicy = p?.value ?? '';
  }

  // Contact messages tab
  let contactMessages: ContactMessage[] = [];
  if (tab === 'messages') {
    const { data } = await supabaseAdmin
      .from('contact_submissions')
      .select('id,name,email,message,is_read,created_at')
      .order('created_at', { ascending: false });
    contactMessages = (data ?? []) as ContactMessage[];
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
      {tab === 'announcements' && <AnnouncementsTab announcements={announcements} tickerSpeed={tickerSpeed} />}
      {tab === 'synclog'       && <SyncLogTab logs={syncLogs} />}
      {tab === 'takanon'       && <TakanonTab />}
      {tab === 'playoff'       && <PlayoffTab />}
      {tab === 'submissions'   && <SubmissionsTab submissions={submissions} />}
      {tab === 'messages'      && <MessagesTab messages={contactMessages} />}
      {tab === 'terms'         && <TermsTab termsOfUse={termsOfUse} privacyPolicy={privacyPolicy} />}
    </>
  );
}
