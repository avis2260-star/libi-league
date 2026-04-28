export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';
import ScoreboardClient from './ScoreboardClient';
import { getLang } from '@/lib/get-lang';

export type ScoreboardGame = {
  id: string;
  round: number;
  game_date: string;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
  home_team_id: string;
  away_team_id: string;
};

const FALLBACK_DATES: Record<number, string> = {
  1:'01.11.25',2:'08.11.25',3:'29.11.25',4:'20.12.25',
  5:'10.01.26',6:'17.01.26',7:'07.02.26',8:'21.02.26',
  9:'24.04.26',10:'01.05.26',11:'08.05.26',
  12:'05.06.26',13:'12.06.26',14:'19.06.26',
};

export type ScoreboardPlayer = {
  name: string;
  jersey_number: number | null;
  team_id: string;
};

function normName(n: string) {
  return n.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export default async function ScoreboardPage() {
  const today = new Date().toISOString().split('T')[0];

  // 1. Get all teams with id + logo from DB
  const { data: teamsData } = await supabaseAdmin
    .from('teams')
    .select('id, name, logo_url');

  const teamsByName = new Map<string, { id: string; logo: string | null }>();
  for (const t of teamsData ?? []) {
    teamsByName.set(normName(t.name), { id: t.id, logo: t.logo_url ?? null });
  }

  function findTeam(name: string) {
    return teamsByName.get(normName(name)) ?? { id: '', logo: null };
  }

  // 2. Find next round: last round with recorded results + 1
  const { data: lastResultRow } = await supabaseAdmin
    .from('game_results')
    .select('round')
    .order('round', { ascending: false })
    .limit(1);

  const lastResultRound = lastResultRow?.[0]?.round ?? 0;
  const maxRound = Math.max(...LIBI_SCHEDULE.map(g => g.round));
  const nextRound = Math.min(lastResultRound + 1, maxRound);

  // 3. Get all games for that round
  const roundGames = LIBI_SCHEDULE.filter(g => g.round === nextRound);

  const games: ScoreboardGame[] = roundGames.map(g => {
    const ht = findTeam(g.homeTeam);
    const at = findTeam(g.awayTeam);
    return {
      id: `${g.round}-${g.homeTeam}-${g.awayTeam}`,
      round: g.round,
      game_date: g.date,
      home_name: g.homeTeam,
      away_name: g.awayTeam,
      home_logo: ht.logo,
      away_logo: at.logo,
      home_team_id: ht.id,
      away_team_id: at.id,
    };
  });

  // 3b. Get round date from DB, fall back to static
  let roundDate = FALLBACK_DATES[nextRound] ?? '';
  try {
    const { data: rdData } = await supabaseAdmin
      .from('league_settings').select('value').eq('key', 'round_dates').maybeSingle();
    if (rdData?.value) {
      const parsed = JSON.parse(rdData.value) as Record<string, string>;
      roundDate = parsed[String(nextRound)] ?? roundDate;
    }
  } catch { /* use fallback */ }

  // 4. Fetch players only for teams in this round
  const teamIds = [...new Set(
    games.flatMap(g => [g.home_team_id, g.away_team_id]).filter(Boolean)
  )];

  const { data: rawPlayers } = teamIds.length > 0
    ? await supabaseAdmin
        .from('players')
        .select('name, jersey_number, team_id')
        .in('team_id', teamIds)
        .eq('is_active', true)
        .order('jersey_number', { nullsFirst: false })
    : { data: [] };

  const players: ScoreboardPlayer[] = (rawPlayers ?? []) as ScoreboardPlayer[];

  const lang = await getLang();

  return (
    <ScoreboardClient
      games={games}
      players={players}
      currentRound={nextRound}
      roundDate={roundDate}
      initialLang={lang}
    />
  );
}
