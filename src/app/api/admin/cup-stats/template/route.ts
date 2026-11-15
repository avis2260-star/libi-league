import { requireAdmin } from '@/lib/require-admin';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildStatsTemplateRows } from '@/lib/stats-import';
import { cupTeamIds } from '../team-ids';

// A cup game's stats template (.xlsx): both teams' active rosters with any
// stats already saved for the game. The admin fills in points / threes /
// fouls and uploads it back via /api/admin/cup-stats/import.

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const cupGameId = req.nextUrl.searchParams.get('cupGameId');
    if (!cupGameId) return NextResponse.json({ error: 'cupGameId required' }, { status: 400 });

    const [{ data: game, error: gErr }, { data: teams }] = await Promise.all([
      supabaseAdmin.from('cup_games').select('id, home_team, away_team').eq('id', cupGameId).maybeSingle(),
      supabaseAdmin.from('teams').select('id, name'),
    ]);
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
    if (!game) return NextResponse.json({ error: 'משחק לא נמצא' }, { status: 404 });

    const { homeId, awayId } = cupTeamIds((teams ?? []) as { id: string; name: string }[], game.home_team, game.away_team);
    const teamIds = [homeId, awayId].filter((x): x is string => !!x);

    const [{ data: players }, { data: stats }] = await Promise.all([
      teamIds.length
        ? supabaseAdmin
            .from('players')
            .select('id, name, jersey_number, team_id')
            .in('team_id', teamIds)
            .eq('is_active', true)
            .order('jersey_number')
        : Promise.resolve({ data: [] as { id: string; name: string; jersey_number: number | null; team_id: string }[] }),
      supabaseAdmin
        .from('cup_game_stats')
        .select('player_id, points, three_pointers, fouls')
        .eq('cup_game_id', cupGameId),
    ]);

    const statByPlayer = new Map<string, { points: number; three_pointers: number; fouls: number }>();
    for (const s of stats ?? []) statByPlayer.set(s.player_id, s);
    const rosterOf = (teamId: string | null) => (players ?? []).filter((p) => teamId && p.team_id === teamId);

    const aoa = buildStatsTemplateRows(
      { label: `בית: ${game.home_team}`, players: rosterOf(homeId) },
      { label: `חוץ: ${game.away_team}`, players: rosterOf(awayId) },
      statByPlayer,
    );

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 26 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] }; // open right-to-left in Excel
    XLSX.utils.book_append_sheet(wb, ws, 'סטטיסטיקה');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cup-game-stats-${cupGameId}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'template failed';
    console.error('cup-stats/template error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
