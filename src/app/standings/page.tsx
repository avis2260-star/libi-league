export const dynamic = 'force-dynamic';

import { NORTH_TABLE, SOUTH_TABLE, type Standing } from '@/lib/league-data';
import { supabaseAdmin } from '@/lib/supabase-admin';
import StandingsTables, { type StandingWithStreak } from './StandingsTables';
import { getLang, st } from '@/lib/get-lang';
import { makeNameResolver } from '@/lib/team-name-resolver';

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
  techni: boolean | null;
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
        .select('round, home_team, away_team, home_score, away_score, techni')
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

    // Admin Teams tab is the canonical source for display names; rewrite
    // every row's name through it so standings always reflects the latest
    // rename (e.g. "אדיס אשדוד" → "שועלי אדיס אשדוד").
    const resolveName = makeNameResolver(teamRows.map(t => ({ id: t.name, name: t.name })));

    // per-team results, newest first (keyed by normalized team name).
    // We key by the alias-resolved canonical name so that a team called
    // "א.ס. ק. גת" in game_results matches "אריות קריית גת" in standings.
    type FormEntry = { result: 'W' | 'L'; round: number };
    const byTeamResults = new Map<string, FormEntry[]>();
    const keyFor = (name: string) => normName(resolveAlias(name));
    for (const g of gameRows) {
      if (g.home_score == null || g.away_score == null) continue;
      // Skip genuinely unplayed rows (0:0 with no techni flag).
      // A double-loss (both teams forfeit) is stored as 0:0 WITH techni=true —
      // that must NOT be skipped; both teams receive 'L'.
      if (g.home_score === 0 && g.away_score === 0 && !g.techni) continue;

      // Double-loss: both teams forfeit (techni, 0:0) → both get 'L'
      if (g.home_score === 0 && g.away_score === 0 && g.techni) {
        for (const teamName of [g.home_team, g.away_team]) {
          if (!teamName) continue;
          const k = keyFor(teamName);
          const arr = byTeamResults.get(k) ?? [];
          arr.push({ result: 'L', round: g.round });
          byTeamResults.set(k, arr);
        }
        continue;
      }

      const homeWon = g.home_score > g.away_score;
      if (g.home_team) {
        const result: 'W' | 'L' = homeWon ? 'W' : 'L';
        const k = keyFor(g.home_team);
        const arr = byTeamResults.get(k) ?? [];
        arr.push({ result, round: g.round });
        byTeamResults.set(k, arr);
      }
      if (g.away_team) {
        const result: 'W' | 'L' = homeWon ? 'L' : 'W';
        const k = keyFor(g.away_team);
        const arr = byTeamResults.get(k) ?? [];
        arr.push({ result, round: g.round });
        byTeamResults.set(k, arr);
      }
    }

    function enrich(s: Standing): StandingWithStreak {
      const results = byTeamResults.get(keyFor(s.name)) ?? [];
      const form: FormEntry[] = results.slice(0, 5);
      let streak = '';
      if (results.length > 0) {
        const kind = results[0].result;
        let n = 0;
        for (const r of results) {
          if (r.result === kind) n++; else break;
        }
        streak = `${kind}${n}`;
      }
      return { ...s, name: resolveName(s.name), streak, form };
    }

    const rows = data as (Standing & { division: string })[];
    const north = rows.filter(r => r.division === 'North').map(enrich);
    const south = rows.filter(r => r.division === 'South').map(enrich);

    if (north.length === 0 && south.length === 0) throw new Error('empty');

    return { north, south, logos };
  } catch {
    const empty = { streak: '', form: [] as { result: 'W' | 'L'; round: number }[] };
    return {
      north: NORTH_TABLE.map(s => ({ ...s, ...empty })),
      south: SOUTH_TABLE.map(s => ({ ...s, ...empty })),
      logos: {},
    };
  }
}

export default async function StandingsPage() {
  const [{ north, south, logos }, lang] = await Promise.all([getStandings(), getLang()]);
  const T = (he: string) => st(he, lang);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">{T('טבלאות ליגה')}</h1>
        <p className="mt-1 text-sm font-bold text-[#8aaac8]">{lang === 'en' ? 'Updated through Round 8 · Season 2025–2026' : 'עדכני עד מחזור 8 · עונת 2025–2026'}</p>
      </div>

      <StandingsTables north={north} south={south} logos={logos} />
    </div>
  );
}
