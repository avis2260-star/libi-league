export const dynamic = 'force-dynamic';

import { NORTH_TABLE, SOUTH_TABLE, type Standing } from '@/lib/league-data';
import { supabaseAdmin } from '@/lib/supabase-admin';
import StandingsTables, { type StandingWithStreak } from './StandingsTables';

/* ── Team name normalizer ─────────────────────────────────────────────── */
function normName(s: string) {
  return s.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/* ── Team name aliases ────────────────────────────────────────────────── */
const TEAM_ALIASES: [string, string][] = [
  ['אריות קריית גת', 'א.ס. ק. גת'],
  ['אריות קריית גת', 'א.ט. ק. גת'],
  ['אריות קריית גת', 'אריות ק. גת'],
  ['ה.ה. גדרה',      'החברה הטובים גדרה'],
  ['ה.ה. גדרה',      'החברה הטובים'],
];
function resolveAlias(name: string): string {
  const norm = normName(name);
  for (const [canonical, alias] of TEAM_ALIASES) {
    if (normName(alias) === norm || normName(canonical) === norm) return canonical;
  }
  return name;
}

type GameResultRow = {
  round: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
};

type TeamRow = { name: string; logo_url: string | null };

async function getStandings(): Promise<{
  north: StandingWithStreak[];
  south: StandingWithStreak[];
  logos: Record<string, string>;
}> {
  try {
    const [
      { data, error },
      { data: teamsData },
      { data: results },
    ] = await Promise.all([
      supabaseAdmin.from('standings').select('*').order('rank', { ascending: true }),
      supabaseAdmin.from('teams').select('name, logo_url'),
      // Pull round results from the Excel-sync table. Sort by round DESC so
      // the most recent round is first — string dates like "22.11.25" don't
      // sort chronologically, but the round number does.
      supabaseAdmin
        .from('game_results')
        .select('round, home_team, away_team, home_score, away_score')
        .order('round', { ascending: false }),
    ]);

    if (error || !data || data.length === 0) throw new Error('no data');

    const teamRows = (teamsData ?? []) as TeamRow[];
    const gameRows = (results ?? []) as GameResultRow[];

    // logos map (by team name)
    const logos: Record<string, string> = {};
    for (const t of teamRows) {
      if (t.name && t.logo_url) logos[t.name] = t.logo_url;
    }

    // per-team results, newest first (keyed by normalized team name).
    // We key by the alias-resolved canonical name so that a team called
    // "א.ס. ק. גת" in game_results matches "אריות קריית גת" in standings.
    const byTeamResults = new Map<string, ('W' | 'L')[]>();
    const keyFor = (name: string) => normName(resolveAlias(name));
    for (const g of gameRows) {
      if (g.home_score == null || g.away_score == null) continue;
      // skip unplayed rows (both scores 0 usually means not played yet)
      if (g.home_score === 0 && g.away_score === 0) continue;
      const homeWon = g.home_score > g.away_score;
      if (g.home_team) {
        const r: 'W' | 'L' = homeWon ? 'W' : 'L';
        const k = keyFor(g.home_team);
        const arr = byTeamResults.get(k) ?? [];
        arr.push(r);
        byTeamResults.set(k, arr);
      }
      if (g.away_team) {
        const r: 'W' | 'L' = homeWon ? 'L' : 'W';
        const k = keyFor(g.away_team);
        const arr = byTeamResults.get(k) ?? [];
        arr.push(r);
        byTeamResults.set(k, arr);
      }
    }

    function enrich(s: Standing): StandingWithStreak {
      const results = byTeamResults.get(keyFor(s.name)) ?? [];
      const form: ('W' | 'L')[] = results.slice(0, 5);
      let streak = '';
      if (results.length > 0) {
        const kind = results[0];
        let n = 0;
        for (const r of results) {
          if (r === kind) n++; else break;
        }
        streak = `${kind}${n}`;
      }
      return { ...s, streak, form };
    }

    const rows = data as (Standing & { division: string })[];
    const north = rows.filter(r => r.division === 'North').map(enrich);
    const south = rows.filter(r => r.division === 'South').map(enrich);

    if (north.length === 0 && south.length === 0) throw new Error('empty');

    return { north, south, logos };
  } catch {
    const empty = { streak: '', form: [] as ('W' | 'L')[] };
    return {
      north: NORTH_TABLE.map(s => ({ ...s, ...empty })),
      south: SOUTH_TABLE.map(s => ({ ...s, ...empty })),
      logos: {},
    };
  }
}

export default async function StandingsPage() {
  const { north, south, logos } = await getStandings();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">טבלאות ליגה</h1>
        <p className="mt-1 text-sm font-bold text-[#8aaac8]">עדכני עד מחזור 8 · עונת 2025–2026</p>
      </div>

      <StandingsTables north={north} south={south} logos={logos} />
    </div>
  );
}
