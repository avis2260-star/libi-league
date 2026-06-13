import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentSeason } from '@/lib/current-season';

// Generate a per-game stats template (.xlsx) pre-filled with both teams'
// rosters and any stats already recorded for the game. The admin fills in
// points / three-pointers / fouls and re-uploads via /api/admin/game-stats/import.

type TeamRef = { name?: string } | { name?: string }[] | null;
const teamName = (t: TeamRef): string => {
  const v = Array.isArray(t) ? t[0] : t;
  return v?.name ?? '';
};

// Shape of the joined games row — the embedded select confuses Supabase's
// inferred type, so we cast the result to this.
type GameTemplateRow = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team: TeamRef;
  away_team: TeamRef;
};

export async function GET(req: NextRequest) {
  try {
    const gameId = req.nextUrl.searchParams.get('gameId');
    if (!gameId) return NextResponse.json({ error: 'gameId required' }, { status: 400 });

    const { data: gameData, error: gErr } = await supabaseAdmin
      .from('games')
      .select(
        'id, home_team_id, away_team_id,' +
        ' home_team:teams!games_home_team_id_fkey(name),' +
        ' away_team:teams!games_away_team_id_fkey(name)',
      )
      .eq('id', gameId)
      .maybeSingle();
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
    if (!gameData) return NextResponse.json({ error: 'game not found' }, { status: 404 });

    const game = gameData as unknown as GameTemplateRow;
    const homeName = teamName(game.home_team);
    const awayName = teamName(game.away_team);

    const season = await getCurrentSeason();
    const [{ data: players }, { data: stats }] = await Promise.all([
      supabaseAdmin
        .from('players')
        .select('id, name, jersey_number, team_id')
        .in('team_id', [game.home_team_id, game.away_team_id].filter(Boolean))
        .eq('is_active', true)
        .order('jersey_number'),
      supabaseAdmin
        .from('game_stats')
        .select('player_id, points, three_pointers, fouls')
        .eq('season', season)
        .eq('game_id', gameId),
    ]);

    const statByPlayer = new Map<string, { points: number; three_pointers: number; fouls: number }>();
    for (const s of stats ?? []) statByPlayer.set(s.player_id, s);

    const HEADER = ['שם השחקן', 'מספר', 'נקודות', 'שלשות', 'עבירות'];
    const sectionFor = (teamId: string | null, label: string): unknown[][] => {
      const list = (players ?? []).filter((p) => p.team_id === teamId);
      const rows: unknown[][] = [[`— ${label} —`, '', '', '', '']];
      if (list.length === 0) {
        rows.push(['(אין שחקנים פעילים)', '', '', '', '']);
        return rows;
      }
      for (const p of list) {
        const s = statByPlayer.get(p.id);
        rows.push([
          p.name,
          p.jersey_number ?? '',
          s?.points ?? '',
          s?.three_pointers ?? '',
          s?.fouls ?? '',
        ]);
      }
      return rows;
    };

    const aoa: unknown[][] = [
      HEADER,
      ...sectionFor(game.home_team_id, `בית: ${homeName}`),
      ['', '', '', '', ''],
      ...sectionFor(game.away_team_id, `חוץ: ${awayName}`),
    ];

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 26 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] }; // open right-to-left in Excel
    XLSX.utils.book_append_sheet(wb, ws, 'סטטיסטיקה');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const filename = `game-stats-${gameId}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'template failed';
    console.error('game-stats/template error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
