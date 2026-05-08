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
import PerGameStatsTab, { type PerGameInfo, type PerGameStatRow } from '@/components/admin/PerGameStatsTab';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import { makeNameResolver } from '@/lib/team-name-resolver';
import MessagesTab, { type ContactMessage } from '@/components/admin/MessagesTab';
import TermsTab from '@/components/admin/TermsTab';
import AboutTab from '@/components/admin/AboutTab';
import AccessibilityTab from '@/components/admin/AccessibilityTab';
import HallOfFameTab from '@/components/admin/HallOfFameTab';
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
  searchParams: Promise<{ tab?: string; gameId?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab ?? 'games';
  const gameId = params.gameId ?? undefined;
  const games = await getAllGames();
  // Sort all games chronologically. The GamesTab itself groups them into
  // "active" (status!=Finished AND date>=today) for the top section, and
  // "past" (everything else) collapsed at the bottom.
  const allGamesSorted = [...games].sort((a, b) => {
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
      scoresheet_image_url: string | null;
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
      scoresheet_image_url: s.scoresheet_image_url ?? null,
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

  // About page tab
  let aboutHeroSubtitle = '';
  let aboutStory = '';
  let aboutAssociation = '';
  let aboutChairmanName = '';
  if (tab === 'about') {
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('key,value')
      .in('key', ['about_hero_subtitle', 'about_story', 'about_association', 'about_chairman_name']);
    const map = new Map<string, string>((data ?? []).map((r) => [r.key, r.value]));
    aboutHeroSubtitle = map.get('about_hero_subtitle') ?? '';
    aboutStory = map.get('about_story') ?? '';
    aboutAssociation = map.get('about_association') ?? '';
    aboutChairmanName = map.get('about_chairman_name') ?? '';
  }

  // Accessibility tab
  let a11yCoordinatorName = '';
  let a11yCoordinatorEmail = '';
  let a11yUpdatedAt = '';
  if (tab === 'accessibility') {
    const { data } = await supabaseAdmin
      .from('league_settings')
      .select('key,value')
      .in('key', [
        'accessibility_coordinator_name',
        'accessibility_coordinator_email',
        'accessibility_updated_at',
      ]);
    const map = new Map<string, string>((data ?? []).map((r) => [r.key, r.value]));
    a11yCoordinatorName  = map.get('accessibility_coordinator_name')  ?? '';
    a11yCoordinatorEmail = map.get('accessibility_coordinator_email') ?? '';
    a11yUpdatedAt        = map.get('accessibility_updated_at')        ?? '';
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

  // Hall of Fame tab
  let hofSeasons: { id: string; year: string; champion_name: string | null; champion_captain: string | null; runner_up_name: string | null; cup_holder_name: string | null; mvp_name: string | null; mvp_stats: string | null; final_score: string | null; final_date: string | null; final_location: string | null }[] = [];
  let hofRecords: { id: string; title: string; holder: string | null; value: string | null }[] = [];
  if (tab === 'halloffame') {
    const [{ data: s }, { data: r }] = await Promise.all([
      supabaseAdmin.from('league_history_seasons').select('id,year,champion_name,champion_captain,runner_up_name,cup_holder_name,mvp_name,mvp_stats,final_score,final_date,final_location').order('year', { ascending: false }),
      supabaseAdmin.from('league_history_records').select('id,title,holder,value').order('sort_order'),
    ]);
    hofSeasons = (s ?? []) as typeof hofSeasons;
    hofRecords = (r ?? []) as typeof hofRecords;
  }

  // Per-game stats tab (round → games → team rosters)
  let perGameInfos: PerGameInfo[] = [];
  let perGameExisting: PerGameStatRow[] = [];
  let perGameInitialRound = 1;
  if (tab === 'gamestats') {
    type GameRow = {
      id: string;
      game_date: string;
      home_team_id: string | null;
      away_team_id: string | null;
      home_score: number | null;
      away_score: number | null;
      home_team: { id: string; name: string } | { id: string; name: string }[] | null;
      away_team: { id: string; name: string } | { id: string; name: string }[] | null;
    };
    type PRow = { id: string; name: string; jersey_number: number | null; team_id: string | null };

    const [{ data: gamesRows }, { data: playersRows }, { data: pgsRows }, { data: teamsList }] = await Promise.all([
      supabaseAdmin
        .from('games')
        .select('id,game_date,home_team_id,away_team_id,home_score,away_score,home_team:teams!games_home_team_id_fkey(id,name),away_team:teams!games_away_team_id_fkey(id,name)')
        .order('game_date'),
      supabaseAdmin
        .from('players')
        .select('id,name,jersey_number,team_id')
        .eq('is_active', true)
        .order('name'),
      supabaseAdmin
        .from('player_game_stats')
        .select('player_id,game_id,points,three_pointers,fouls'),
      supabaseAdmin.from('teams').select('id,name'),
    ]);

    // Resolver maps any name variant (LIBI_SCHEDULE, alias, abbreviation)
    // to the canonical team name in the teams table — so the team-pair
    // key matches whether the schedule says "החברה הטובים גדרה" and the
    // DB stores "ה.ה. גדרה" (or vice versa).
    const resolveName = makeNameResolver((teamsList ?? []) as { id: string; name: string }[]);

    // Build roster map: team_id → players
    const playersByTeam = new Map<string, { id: string; name: string; jersey_number: number | null }[]>();
    for (const p of (playersRows ?? []) as PRow[]) {
      if (!p.team_id) continue;
      const arr = playersByTeam.get(p.team_id) ?? [];
      arr.push({ id: p.id, name: p.name, jersey_number: p.jersey_number });
      playersByTeam.set(p.team_id, arr);
    }

    // Helpers
    const teamObj = (t: GameRow['home_team']) =>
      Array.isArray(t) ? (t[0] ?? null) : t;
    const norm = (s: string) => s.replace(/["""''`״׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

    // Index DB games by team-pair so we can pick the best match per
    // LIBI_SCHEDULE entry. Key = "homeName|awayName" (normalized).
    // The `games` table can contain multiple rows for the same matchup
    // (Excel re-syncs, reschedules) — we dedupe by preferring the row
    // whose game_date matches the canonical schedule date, falling back
    // to the most recent game_date.
    type Indexed = { row: GameRow; home: { id: string; name: string }; away: { id: string; name: string } };
    const dbByPair = new Map<string, Indexed[]>();
    for (const g of (gamesRows ?? []) as GameRow[]) {
      const home = teamObj(g.home_team);
      const away = teamObj(g.away_team);
      if (!home || !away) continue;
      // Use the alias-resolving resolver so e.g. "ה.ה. גדרה" matches
      // LIBI_SCHEDULE's "החברה הטובים גדרה".
      const key = `${norm(resolveName(home.name))}|${norm(resolveName(away.name))}`;
      const arr = dbByPair.get(key) ?? [];
      arr.push({ row: g, home, away });
      dbByPair.set(key, arr);
    }

    // Iterate LIBI_SCHEDULE (the canonical source of truth) so we get
    // exactly ONE entry per scheduled matchup per round.
    perGameInfos = LIBI_SCHEDULE
      .map(entry => {
        const matches = dbByPair.get(`${norm(resolveName(entry.homeTeam))}|${norm(resolveName(entry.awayTeam))}`);
        if (!matches || matches.length === 0) return null;
        // Prefer the row whose game_date matches the schedule, else the
        // most recent (matches array is in DB-fetch order — sort by date desc).
        const sorted = [...matches].sort((a, b) =>
          (b.row.game_date ?? '').localeCompare(a.row.game_date ?? ''),
        );
        const best = sorted.find(m => m.row.game_date === entry.date) ?? sorted[0];
        return {
          id: best.row.id,
          round: entry.round,
          date: best.row.game_date,
          homeTeamName: best.home.name,
          awayTeamName: best.away.name,
          homeScore: best.row.home_score,
          awayScore: best.row.away_score,
          homePlayers: playersByTeam.get(best.home.id) ?? [],
          awayPlayers: playersByTeam.get(best.away.id) ?? [],
        } as PerGameInfo;
      })
      .filter((g): g is PerGameInfo => g !== null)
      .sort((a, b) => a.round - b.round || a.date.localeCompare(b.date));

    perGameExisting = (pgsRows ?? []) as PerGameStatRow[];

    // Default to the most recently played round if any, else round 1
    const playedRounds = perGameInfos
      .filter(g => g.homeScore != null && g.awayScore != null)
      .map(g => g.round);
    perGameInitialRound = playedRounds.length ? Math.max(...playedRounds) : 1;
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
      {tab === 'games'         && <GamesTab games={allGamesSorted} />}
      {tab === 'teams'         && <TeamsTab teams={teamsForTab} />}
      {tab === 'boxscore'      && <BoxScoreTab games={games} initialGameId={gameId} />}
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
      {tab === 'gamestats'     && <PerGameStatsTab games={perGameInfos} existingStats={perGameExisting} initialRound={perGameInitialRound} />}
      {tab === 'messages'      && <MessagesTab messages={contactMessages} />}
      {tab === 'terms'         && <TermsTab termsOfUse={termsOfUse} privacyPolicy={privacyPolicy} />}
      {tab === 'about'         && <AboutTab heroSubtitle={aboutHeroSubtitle} story={aboutStory} association={aboutAssociation} chairmanName={aboutChairmanName} />}
      {tab === 'accessibility' && <AccessibilityTab coordinatorName={a11yCoordinatorName} coordinatorEmail={a11yCoordinatorEmail} updatedAt={a11yUpdatedAt} />}
      {tab === 'halloffame'    && <HallOfFameTab seasons={hofSeasons} records={hofRecords} />}
    </>
  );
}
