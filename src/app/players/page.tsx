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
  // Age is computed SERVER-SIDE and nulled when the player opted out
  // (age_visible=false). The raw date_of_birth must never be serialized to
  // the client — it's PII, and hiding it in the UI alone still ships it in
  // the page payload.
  age: number | null;
  points: number | null;
  three_pointers: number | null;
  fouls: number | null;
  team: { id: string; name: string; logo_url: string | null } | null;
};

export type TeamOption = { id: string; name: string; logo_url: string | null };

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

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

  type RawPlayer = Omit<EnrichedPlayer, 'team' | 'age'> & {
    date_of_birth: string | null;
    age_visible: boolean;
  };
  const enriched: EnrichedPlayer[] = ((rawPlayers ?? []) as RawPlayer[]).map(
    ({ date_of_birth, age_visible, ...p }) => ({
      ...p,
      age: age_visible === false ? null : calcAge(date_of_birth),
      team: p.team_id ? (teamMap[p.team_id] ?? null) : null,
    }),
  );

  return <PlayersClient players={enriched} teams={teams} />;
}
