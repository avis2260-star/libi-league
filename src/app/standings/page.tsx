import Image from 'next/image';
import { getStandings } from '@/lib/supabase';

export const revalidate = 60;

export default async function StandingsPage() {
  const standings = await getStandings();

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">League Standings</h1>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Team</th>
              <th className="px-4 py-3 text-center">W</th>
              <th className="px-4 py-3 text-center">L</th>
              <th className="px-4 py-3 text-center">PF</th>
              <th className="px-4 py-3 text-center">PA</th>
              <th className="px-4 py-3 text-center">+/-</th>
              <th className="px-4 py-3 text-center font-bold text-orange-500">PTS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {standings.map((s, i) => (
              <tr key={s.id} className="hover:bg-orange-50">
                <td className="px-4 py-3 font-semibold text-gray-400">{i + 1}</td>
                <td className="flex items-center gap-3 px-4 py-3 font-semibold">
                  {s.logo_url ? (
                    <Image src={s.logo_url} alt={s.name} width={28} height={28} className="rounded-full object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-400">
                      {s.name.charAt(0)}
                    </span>
                  )}
                  {s.name}
                </td>
                <td className="px-4 py-3 text-center text-green-600">{s.wins}</td>
                <td className="px-4 py-3 text-center text-red-500">{s.losses}</td>
                <td className="px-4 py-3 text-center">{s.points_for}</td>
                <td className="px-4 py-3 text-center">{s.points_against}</td>
                <td className="px-4 py-3 text-center">
                  {s.points_for - s.points_against > 0 ? '+' : ''}
                  {s.points_for - s.points_against}
                </td>
                <td className="px-4 py-3 text-center font-bold text-orange-500">{s.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
