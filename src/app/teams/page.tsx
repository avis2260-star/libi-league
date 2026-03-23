import Image from 'next/image';
import { getTeams } from '@/lib/supabase';

export const revalidate = 60;

export default async function TeamsPage() {
  const teams = await getTeams();

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Teams</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <div key={team.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border border-gray-100 bg-gray-50">
              {team.logo_url ? (
                <Image src={team.logo_url} alt={team.name} fill className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-300">
                  {team.name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <p className="font-bold">{team.name}</p>
              <p className="text-sm text-gray-500">Captain: {team.captain_name}</p>
              {team.contact_info && (
                <p className="text-xs text-gray-400">{team.contact_info}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
