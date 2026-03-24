import { NORTH_TABLE, SOUTH_TABLE, type Standing } from '@/lib/league-data';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getStandings(): Promise<{ north: Standing[]; south: Standing[] }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('standings')
      .select('*')
      .order('rank', { ascending: true });

    if (error || !data || data.length === 0) throw new Error('no data');

    const north = (data as (Standing & { division: string })[]).filter((r) => r.division === 'North');
    const south = (data as (Standing & { division: string })[]).filter((r) => r.division === 'South');

    if (north.length === 0 && south.length === 0) throw new Error('empty');

    return { north, south };
  } catch {
    return { north: NORTH_TABLE, south: SOUTH_TABLE };
  }
}

// ── Table ─────────────────────────────────────────────────────────────────────

function StandingsTable({ data, title }: { data: Standing[]; title: string }) {
  const COLS = ["#", "קבוצה", "מ'", "נ'", "ה'", "זכות", "חובה", "+/-", "טכ'", "*", "נק'"];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04]">
      {/* Card header */}
      <div className="border-b border-white/[0.06] px-5 py-4">
        <span className="text-base font-bold text-[#e0c97a]">🏀 {title}</span>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-white/[0.03]">
              {COLS.map((h) => (
                <th
                  key={h}
                  className="border-b border-white/[0.05] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#4a6a8a]"
                  style={{ textAlign: h === 'קבוצה' ? 'right' : 'center' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((team, i) => {
              const rankColor =
                team.rank === 1 ? '#e0c97a'
                : team.rank === 2 ? '#b0b8c8'
                : team.rank === 3 ? '#c87d3a'
                : '#4a6a8a';

              const hasTechni    = team.techni > 0;
              const hasPenalty   = team.penalty < 0;
              const diffPositive = team.diff > 0;

              const rowBg =
                team.rank === 1 ? 'rgba(224,201,122,0.07)'
                : team.rank === 2 ? 'rgba(176,184,200,0.06)'
                : team.rank === 3 ? 'rgba(200,125,58,0.07)'
                : team.rank === 4 ? 'rgba(74,106,138,0.08)'
                : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';

              return (
                <tr
                  key={team.name}
                  className="border-b border-white/[0.04] transition-colors hover:bg-orange-500/[0.06]"
                  style={{ background: rowBg }}
                >
                  {/* # Rank */}
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-sm font-bold" style={{ color: rankColor }}>
                      {team.rank}
                    </span>
                  </td>

                  {/* Team name */}
                  <td className="px-3 py-2.5 text-right font-semibold text-[#e8edf5]">
                    {team.name}
                  </td>

                  {/* Games played */}
                  <td className="px-3 py-2.5 text-center text-[#8aaac8]">{team.games}</td>

                  {/* Wins */}
                  <td className="px-3 py-2.5 text-center font-semibold text-green-400">{team.wins}</td>

                  {/* Losses */}
                  <td className="px-3 py-2.5 text-center font-semibold text-red-400">{team.losses}</td>

                  {/* Points for */}
                  <td className="px-3 py-2.5 text-center text-[#8aaac8]">{team.pf}</td>

                  {/* Points against */}
                  <td className="px-3 py-2.5 text-center text-[#8aaac8]">{team.pa}</td>

                  {/* +/- Spread — dir="ltr" so sign appears before number */}
                  <td dir="ltr" className={`px-3 py-2.5 text-center font-semibold ${diffPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {diffPositive ? `+${team.diff}` : team.diff}
                  </td>

                  {/* טכ' — game-forfeit count; empty if 0 */}
                  <td className="px-3 py-2.5 text-center text-[#8aaac8]">
                    {hasTechni ? team.techni : ''}
                  </td>

                  {/* * — point deduction from Excel; empty if 0 */}
                  <td dir="ltr" className="px-3 py-2.5 text-center font-semibold text-red-400">
                    {hasPenalty ? team.penalty : ''}
                  </td>

                  {/* Total points */}
                  <td className="px-3 py-2.5 text-center text-base font-black text-orange-400">
                    {team.pts}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="border-t border-white/[0.04] px-4 py-2.5 text-[10px] text-[#3a5a7a]">
        <span className="text-red-400/80">*</span>{' '}
        הורדת נקודות על אי-הגעה לגמר אליפות / מפגש פתיחת עונה ·{' '}
        <span className="text-[#4a6a8a]">עמודת &quot;טכ׳&quot; = מספר עונשים</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StandingsPage() {
  const { north, south } = await getStandings();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">טבלאות ליגה</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">עדכני עד מחזור 8 · עונת 2025–2026</p>
      </div>

      {/*
        RTL grid: first child renders on the RIGHT.
        South is placed first → appears on the right side.
        North is placed second → appears on the left side.
      */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StandingsTable data={south} title="טבלת דרום" />
        <StandingsTable data={north} title="טבלת צפון" />
      </div>
    </div>
  );
}
