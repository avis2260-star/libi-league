import MatchCard from '@/components/MatchCard';
import { getRecentGames, getUpcomingGames } from '@/lib/supabase';

export const revalidate = 60;

export default async function GamesPage() {
  const [upcoming, recent] = await Promise.all([
    getUpcomingGames(),
    getRecentGames(20),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-3xl font-bold">Upcoming Games</h1>
        {upcoming.length === 0 ? (
          <p className="text-gray-400">No upcoming games.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((g) => <MatchCard key={g.id} game={g} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold">Recent Results</h2>
        {recent.length === 0 ? (
          <p className="text-gray-400">No results yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((g) => <MatchCard key={g.id} game={g} />)}
          </div>
        )}
      </section>
    </div>
  );
}
