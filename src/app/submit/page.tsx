import { supabaseAdmin } from '@/lib/supabase-admin';
import SubmitFlow from './SubmitFlow';

export const dynamic = 'force-dynamic';

export default async function SubmitPage() {
  // Only fetch finished/played games — submissions are for games that already happened
  const { data: games } = await supabaseAdmin
    .from('games')
    .select(
      'id, game_date, game_time, status, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)',
    )
    .eq('status', 'Finished')
    .order('game_date', { ascending: false });

  // Fetch locked game IDs — games that already have an active submission
  const { data: submissions } = await supabaseAdmin
    .from('game_submissions')
    .select('game_id')
    .in('status', ['pending', 'needs_review', 'approved']);

  const lockedIds = new Set((submissions ?? []).map((s: { game_id: string }) => s.game_id));

  // Fetch all teams for the team selector
  const { data: teamsData } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .order('name');

  type RawGame = {
    id: string;
    game_date: string;
    game_time: string | null;
    home_team: { name: string }[] | { name: string } | null;
    away_team: { name: string }[] | { name: string } | null;
  };

  function teamName(t: { name: string }[] | { name: string } | null): string {
    if (!t) return '';
    if (Array.isArray(t)) return t[0]?.name ?? '';
    return t.name ?? '';
  }

  const formattedGames = ((games ?? []) as unknown as RawGame[]).map((g) => ({
    id: g.id,
    home_name: teamName(g.home_team) || 'בית',
    away_name: teamName(g.away_team) || 'חוץ',
    game_date: g.game_date,
    game_time: g.game_time,
    is_locked: lockedIds.has(g.id),
  }));

  const teams = (teamsData ?? []) as { id: string; name: string }[];

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl" dir="rtl">
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-black">
          <span className="text-white">הגשת </span>
          <span className="text-orange-500">תוצאות</span>
        </h1>
        <p className="text-sm text-[#5a7a9a]">צלם את דף הסטטיסטיקות של המשחק ושלח לאישור</p>
      </div>
      <SubmitFlow games={formattedGames} teams={teams} />
    </main>
  );
}
