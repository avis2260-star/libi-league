import { getAllPlayers } from '@/lib/supabase';
import CollapsibleTeamSection from '@/components/CollapsibleTeamSection';

export const dynamic = 'force-dynamic';

export default async function PlayersPage() {
  const players = await getAllPlayers();

  // Group by team, sorted alphabetically
  const byTeam = players.reduce<Record<string, typeof players>>((acc, p) => {
    const key = p.team?.name ?? 'ללא קבוצה';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const teamEntries = Object.entries(byTeam).sort(([a], [b]) => a.localeCompare(b, 'he'));

  return (
    <div>
      <h1 className="mb-2 text-3xl font-black text-white">שחקנים</h1>
      <p className="mb-8 text-sm text-[#5a7a9a]">
        {players.length} שחקנים · {teamEntries.length} קבוצות
      </p>

      {teamEntries.length === 0 && (
        <p className="text-[#5a7a9a]">לא נמצאו שחקנים.</p>
      )}

      <div className="space-y-2">
        {teamEntries.map(([teamName, teamPlayers], i) => (
          <CollapsibleTeamSection
            key={teamName}
            teamName={teamName}
            teamLogo={teamPlayers[0]?.team?.logo_url}
            players={teamPlayers}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
