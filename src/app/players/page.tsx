export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import PlayersClient from './PlayersClient';

export type EnrichedPlayer = {
  id: string;
  name: string;
  jersey_number: number | null;
  position: string | null;
  staff_role: string | null;
  photo_url: string | null;
  team_id: string | null;
  is_active: boolean;
  date_of_birth: string | null;
  age_visible: boolean;
  points: number | null;
  three_pointers: number | null;
  fouls: number | null;
  team: { id: string; name: string; logo_url: string | null } | null;
};

export type TeamOption = { id: string; name: string; logo_url: string | null };

export default async function PlayersPage() {
  const [{ data: rawPlayers }, { data: rawTeams }] = await Promise.all([
    supabaseAdmin
      .from('players')
      .select('id,name,jersey_number,position,staff_role,photo_url,is_active,team_id,points,three_pointers,fouls,date_of_birth,age_visible')
      .order('name'),
    supabaseAdmin
      .from('teams')
      .select('id,name,logo_url')
      .order('name'),
  ]);

  const teams   = (rawTeams   ?? []) as TeamOption[];
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const enriched: EnrichedPlayer[] = ((rawPlayers ?? []) as Omit<EnrichedPlayer,'team'>[]).map(p => ({
    ...p,
    team: p.team_id ? (teamMap[p.team_id] ?? null) : null,
  }));

  return <PlayersClient players={enriched} teams={teams} />;
}
