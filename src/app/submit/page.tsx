import { supabaseAdmin } from '@/lib/supabase-admin';
import SubmitFlow from './SubmitFlow';
import { getLang } from '@/lib/get-lang';

export const dynamic = 'force-dynamic';

export default async function SubmitPage() {
  // Submissions are for games that already happened. Filter by date instead
  // of status — admins don't always flip status to 'Finished' after a game,
  // and submissions should be possible for any past game.
  const today = new Date().toISOString().slice(0, 10);
  const { data: games } = await supabaseAdmin
    .from('games')
    .select(
      'id, game_date, game_time, status, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)',
    )
    .lte('game_date', today)
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

  // Fetch active players for fuzzy roster matching in the confirm step
  const { data: playersData } = await supabaseAdmin
    .from('players')
    .select('id, name, jersey_number, team_id')
    .eq('is_active', true)
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

  const lang = await getLang();
  const en = lang === 'en';

  const formattedGames = ((games ?? []) as unknown as RawGame[]).map((g) => ({
    id: g.id,
    home_name: teamName(g.home_team) || (en ? 'Home' : 'בית'),
    away_name: teamName(g.away_team) || (en ? 'Away' : 'חוץ'),
    game_date: g.game_date,
    game_time: g.game_time,
    is_locked: lockedIds.has(g.id),
  }));

  const teams   = (teamsData   ?? []) as { id: string; name: string }[];
  const players = (playersData ?? []) as { id: string; name: string; jersey_number: number | null; team_id: string | null }[];

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl" dir={en ? 'ltr' : 'rtl'}>
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-black">
          <span className="text-white">{en ? 'Submit ' : 'הגשת '}</span>
          <span className="text-orange-500">{en ? 'Results' : 'תוצאות'}</span>
        </h1>
        <p className="text-sm text-[#5a7a9a]">
          {en
            ? 'Photograph the game stats sheet and send it for approval'
            : 'צלם את דף הסטטיסטיקות של המשחק ושלח לאישור'}
        </p>
      </div>

      <SubmitFlow games={formattedGames} teams={teams} players={players} />
    </main>
  );
}
