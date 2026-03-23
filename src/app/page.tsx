import MatchCard from '@/components/MatchCard';
import { getLiveGames, getUpcomingGames } from '@/lib/supabase';

export const revalidate = 60; // ISR: refresh every 60 s

export default async function HomePage() {
  const [liveGames, upcomingGames] = await Promise.all([
    getLiveGames(),
    getUpcomingGames(),
  ]);

  return (
    <div className="space-y-10">
      {/* Live games */}
      {liveGames.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Live Now</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveGames.map((game) => (
              <MatchCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming games */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">Upcoming Games</h2>
        {upcomingGames.length === 0 ? (
          <p className="text-gray-400">No upcoming games scheduled.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingGames.map((game) => (
              <MatchCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
