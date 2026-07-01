export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLang, st } from '@/lib/get-lang';
import { displayName } from '@/lib/names';
import { makeNameResolver } from '@/lib/team-name-resolver';
import { getCurrentSeason } from '@/lib/current-season';

type Season = {
  id: string;
  year: string;
  champion_name: string | null;
  champion_logo: string | null;
  champion_captain: string | null;
  runner_up_name: string | null;
  cup_holder_name: string | null;
  cup_holder_logo: string | null;
  mvp_name: string | null;
  mvp_stats: string | null;
  is_current: boolean | null;
  sort_order: number | null;
};

type Record = {
  id: string;
  title: string;
  holder: string | null;
  value: string | null;
  record_date: string | null;
  sort_order: number | null;
};

// A row in the rendered "All-time records" table — comes from either
// the league_history_records DB table (admin-managed) OR is computed
// live from players / game_stats / standings. The `auto` flag flips
// the visual indicator so admins can see at a glance which lines
// haven't been curated yet.
type RenderedRecord = {
  id: string;
  title: string;
  holder: string | null;
  value: string | null;
  auto: boolean;
};

type PlayoffSeries = {
  series_number: number;
  team_a: string;
  team_b: string;
};

type PlayoffGame = {
  series_number: number;
  game_number: number;
  home_score: number | null;
  away_score: number | null;
  played: boolean | null;
};

type CupGame = {
  round: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  played: boolean | null;
};

/* ── helpers ───────────────────────────────────────────────────────────── */
function normName(s: string) {
  return s.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Lowercase + strip punctuation for stable title matching when admin
// adds a record with the same Hebrew title as a computed one. Without
// this, "שיא נקודות במשחק" vs "שיא נקודות במשחק " (trailing space)
// would be considered different titles.
function normTitle(s: string) {
  return s.replace(/[״׳'"`.,]/g, '').replace(/\s+/g, ' ').trim();
}

// Format a list of tied holder names into a single display string.
// Ties show ALL holders alphabetically, but past `limit` they collapse to
// "first N, ועוד K" so the table stays readable when many players share
// an achievement (e.g. early-season records where multiple players are
// tied at low single-game totals).
function joinHolders(names: string[], limit = 3): string {
  // Dedupe (a player can appear multiple times for the same stat if they
  // posted that value in more than one game) and sort for stability.
  const unique = Array.from(new Set(names.filter((n) => n && n.trim() !== ''))).sort(
    (a, b) => a.localeCompare(b, 'he'),
  );
  if (unique.length === 0) return '—';
  if (unique.length <= limit) return unique.join(', ');
  return unique.slice(0, limit).join(', ') + ` ועוד ${unique.length - limit}`;
}

// Find every row at the max value (>0) and return the formatted holder
// string + the max. Returns null when nothing crosses the threshold so
// empty leagues don't produce bogus "0 נק׳" rows.
function pickAtMax<T>(
  rows: T[],
  getValue: (r: T) => number,
  getName: (r: T) => string,
  limit = 3,
): { holder: string; value: number; tied: number } | null {
  if (rows.length === 0) return null;
  let max = 0;
  for (const r of rows) {
    const v = getValue(r);
    if (v > max) max = v;
  }
  if (max <= 0) return null;
  const tiedNames = rows.filter((r) => getValue(r) === max).map(getName);
  // Dedupe count by unique name (one player tied with themselves across
  // multiple games shouldn't inflate the tie count).
  const uniqueCount = new Set(tiedNames.filter((n) => n && n.trim() !== '')).size;
  return { holder: joinHolders(tiedNames, limit), value: max, tied: uniqueCount };
}

// Build the auto-derived records list. Returns title/holder/value triples
// in the order they should display; each value is omitted entirely if no
// real data backs it (so empty leagues don't get bogus rows).
function buildComputedRecords(
  players: { name: string; points: number; three_pointers: number; team?: { name: string } | null }[],
  gameStats: { points: number; three_pointers: number; player_id: string }[],
  playersById: Map<string, { name: string }>,
  gameResults: { home_team: string; away_team: string; home_score: number; away_score: number; round: number }[],
  standings: { name: string; wins: number; losses: number; diff: number; division: string }[],
): { title: string; holder: string | null; value: string | null }[] {
  const out: { title: string; holder: string | null; value: string | null }[] = [];

  // ── Per-game player records (from game_stats) ───────────────────────────
  if (gameStats.length > 0) {
    const topPts = pickAtMax(
      gameStats,
      (r) => r.points,
      (r) => playersById.get(r.player_id)?.name ?? '',
    );
    if (topPts) {
      out.push({
        title: 'שיא נקודות במשחק',
        holder: topPts.holder,
        value: `${topPts.value} נק׳`,
      });
    }
    const top3pt = pickAtMax(
      gameStats,
      (r) => r.three_pointers,
      (r) => playersById.get(r.player_id)?.name ?? '',
    );
    if (top3pt) {
      out.push({
        title: 'שיא שלשות במשחק',
        holder: top3pt.holder,
        value: `${top3pt.value}`,
      });
    }
  }

  // ── Single-game team records (from game_results) ────────────────────────
  // Build a per-game "winning team / score" view first so the max-by-team
  // logic also handles ties correctly. Each game contributes one row: the
  // winning team's score (or both if tied).
  if (gameResults.length > 0) {
    type TeamGame = { team: string; score: number; opp: string; oppScore: number; round: number; diff: number };
    const teamGameRows: TeamGame[] = [];
    for (const g of gameResults) {
      teamGameRows.push({ team: g.home_team, score: g.home_score, opp: g.away_team, oppScore: g.away_score, round: g.round, diff: g.home_score - g.away_score });
      teamGameRows.push({ team: g.away_team, score: g.away_score, opp: g.home_team, oppScore: g.home_score, round: g.round, diff: g.away_score - g.home_score });
    }

    const topTeam = pickAtMax(teamGameRows, (r) => r.score, (r) => r.team);
    if (topTeam) {
      out.push({
        title: 'שיא נקודות לקבוצה במשחק',
        holder: topTeam.holder,
        value: `${topTeam.value}`,
      });
    }
    const biggestGap = pickAtMax(teamGameRows, (r) => r.diff, (r) => r.team);
    if (biggestGap) {
      out.push({
        title: 'שיא הפרש במשחק',
        holder: biggestGap.holder,
        value: `+${biggestGap.value}`,
      });
    }
  }

  // ── Season-long player records (from players cumulative totals) ─────────
  if (players.length > 0) {
    const playerWithTeam = (p: { name: string; team?: { name: string } | null }) =>
      p.team?.name ? `${p.name} · ${p.team.name}` : p.name;

    const topSeasonScorer = pickAtMax(players, (p) => p.points, playerWithTeam);
    if (topSeasonScorer) {
      out.push({
        title: 'מלך הסלים העונתי',
        holder: topSeasonScorer.holder,
        value: `${topSeasonScorer.value} נק׳`,
      });
    }
    const top3ptShooter = pickAtMax(players, (p) => p.three_pointers, playerWithTeam);
    if (top3ptShooter) {
      out.push({
        title: 'מלך השלשות העונתי',
        holder: top3ptShooter.holder,
        value: `${top3ptShooter.value}`,
      });
    }
  }

  // ── Season standings records ───────────────────────────────────────────
  if (standings.length > 0) {
    const topWins = pickAtMax(standings, (s) => s.wins, (s) => s.name);
    if (topWins) {
      out.push({
        title: 'הכי הרבה ניצחונות בעונה',
        holder: topWins.holder,
        value: `${topWins.value}`,
      });
    }
    const topDiff = pickAtMax(standings, (s) => s.diff, (s) => s.name);
    if (topDiff) {
      out.push({
        title: 'הפרש סלים מצטבר הטוב ביותר',
        holder: topDiff.holder,
        value: `+${topDiff.value}`,
      });
    }
  }

  return out;
}

function homeForGame(s: PlayoffSeries, gNum: number) {
  return gNum === 2 ? s.team_b : s.team_a;
}

function playoffSeriesWinner(s: PlayoffSeries, games: PlayoffGame[]): string | null {
  let winsA = 0, winsB = 0;
  for (const g of games.filter(g => g.series_number === s.series_number && g.played)) {
    const home = homeForGame(s, g.game_number);
    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
    if ((homeWon && home === s.team_a) || (!homeWon && home !== s.team_a)) winsA++;
    else winsB++;
  }
  return winsA >= 2 ? s.team_a : winsB >= 2 ? s.team_b : null;
}

function cupFinalWinner(games: CupGame[]): string | null {
  const finalGame = games.find(g => g.round === 'גמר' && g.played && g.home_score !== null && g.away_score !== null);
  if (!finalGame) return null;
  return (finalGame.home_score ?? 0) > (finalGame.away_score ?? 0)
    ? finalGame.home_team
    : finalGame.away_team;
}

/* ── Trophy card component ────────────────────────────────────────────── */
function TrophyCard({
  title,
  subtitle,
  team,
  teamLabel,
  logo,
  badge,
  icon,
}: {
  title: string;
  subtitle: string;
  team: string;
  teamLabel: string;
  logo: string | null;
  badge: string;
  icon: string;
}) {
  return (
    <section>
      <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
        <span className="w-8 h-px bg-orange-500 inline-block"></span> {title}
      </h2>
      <div className="relative overflow-hidden rounded-3xl border-2 border-yellow-400/40 bg-gradient-to-br from-yellow-400/10 via-slate-900 to-slate-950 p-8 shadow-[0_0_60px_rgba(250,204,21,0.12)]">
        <div className="absolute -left-6 -top-10 text-[10rem] leading-none text-yellow-400/[0.05] select-none">
          {icon}
        </div>
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={team}
              className="h-28 w-28 rounded-full object-cover border-4 border-yellow-400/50 shadow-[0_0_30px_rgba(250,204,21,0.25)]"
            />
          ) : (
            <div className="h-28 w-28 rounded-full bg-slate-800 border-4 border-yellow-400/50 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(250,204,21,0.25)]">
              {icon}
            </div>
          )}
          <div className="flex-1 text-center sm:text-right">
            <p className="text-[11px] font-black uppercase tracking-[3px] text-yellow-400/80 mb-2">
              {subtitle}
            </p>
            <h3 className="font-heading font-black text-4xl sm:text-5xl text-yellow-400 mb-3">
              {teamLabel}
            </h3>
          </div>
          <div className="bg-yellow-400 text-black px-4 py-1.5 rounded-full text-xs font-black font-heading tracking-wider shrink-0">
            {badge}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function HallOfFamePage() {
  const lang = await getLang();
  const T = (he: string) => st(he, lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  let seasons: Season[] = [];
  let records: Record[] = [];
  let renderedRecords: RenderedRecord[] = [];
  let leagueChampion: string | null = null;
  let leagueChampionLogo: string | null = null;
  let cupHolder: string | null = null;
  let cupHolderLogo: string | null = null;

  try {
    // league_history_seasons / league_history_records are intentionally
    // all-time (the manual archive). Everything else here is the live,
    // current-season picture: who's the league champion right now,
    // current cup holder, this season's records.
    const season = await getCurrentSeason();
    const [
      { data: s },
      { data: r },
      { data: playoffSeries },
      { data: playoffGames },
      { data: cupGames },
      { data: teams },
      { data: playersData },
      { data: gameStatsData },
      { data: gameResultsData },
      { data: standingsData },
    ] = await Promise.all([
      supabaseAdmin.from('league_history_seasons').select('*').order('year', { ascending: false }),
      supabaseAdmin.from('league_history_records').select('*').order('sort_order'),
      supabaseAdmin.from('playoff_series').select('series_number, team_a, team_b').eq('season', season).order('series_number'),
      supabaseAdmin.from('playoff_games').select('series_number, game_number, home_score, away_score, played').eq('season', season),
      supabaseAdmin.from('cup_games').select('round, home_team, away_team, home_score, away_score, played').eq('season', season),
      supabaseAdmin.from('teams').select('name, logo_url'),
      supabaseAdmin.from('players').select('id, name, points, three_pointers, team:teams(name)'),
      supabaseAdmin.from('game_stats').select('player_id, points, three_pointers').eq('season', season),
      supabaseAdmin.from('game_results').select('home_team, away_team, home_score, away_score, round').eq('season', season),
      supabaseAdmin.from('standings').select('name, wins, losses, diff, division').eq('season', season),
    ]);
    seasons = (s ?? []) as Season[];
    records = (r ?? []) as Record[];

    const teamList = (teams ?? []) as { name: string; logo_url: string | null }[];
    const findLogo = (name: string) =>
      teamList.find(t => normName(t.name) === normName(name))?.logo_url ?? null;
    // Resolve cached cup_games / playoff team strings to the current admin name.
    const resolveName = makeNameResolver(teamList.map(t => ({ id: t.name, name: t.name })));

    /* ── League champion: ONLY the live winner of the playoff finals
       (playoff_series #7). Nothing shown until the finals are decided. ── */
    const finalSeries = (playoffSeries ?? []).find(
      (ps: PlayoffSeries) => ps.series_number === 7 && ps.team_a && ps.team_b,
    ) as PlayoffSeries | undefined;

    if (finalSeries) {
      const winner = playoffSeriesWinner(finalSeries, (playoffGames ?? []) as PlayoffGame[]);
      if (winner) {
        leagueChampion = resolveName(winner);
        leagueChampionLogo = findLogo(leagueChampion) ?? findLogo(winner);
      }
    }

    /* ── Cup holder: ONLY the live winner of the cup final (round='גמר').
       Nothing shown until the final is played. ── */
    const cupWinner = cupFinalWinner((cupGames ?? []) as CupGame[]);
    if (cupWinner) {
      cupHolder = resolveName(cupWinner);
      cupHolderLogo = findLogo(cupHolder) ?? findLogo(cupWinner);
    }

    /* ── All-time records: merge live-computed entries with admin-curated
       ones. Admin-entered records take precedence on title match (case-
       and punctuation-insensitive), so the admin can override an auto
       value by adding a record with the same title. ── */
    type PlayerRow = { id: string; name: string; points: number; three_pointers: number; team: { name: string } | { name: string }[] | null };
    const playerRows = ((playersData ?? []) as PlayerRow[]).map((p) => ({
      ...p,
      team: Array.isArray(p.team) ? p.team[0] ?? null : p.team,
    }));
    const playersById = new Map(playerRows.map((p) => [p.id, { name: p.name }]));
    const gameStats = (gameStatsData ?? []) as { player_id: string; points: number; three_pointers: number }[];
    const gameResultsRows = ((gameResultsData ?? []) as { home_team: string; away_team: string; home_score: number; away_score: number; round: number }[]).map(
      (g) => ({ ...g, home_team: resolveName(g.home_team), away_team: resolveName(g.away_team) })
    );
    const standingsRows = ((standingsData ?? []) as { name: string; wins: number; losses: number; diff: number; division: string }[]).map(
      (s) => ({ ...s, name: resolveName(s.name) })
    );
    const computed = buildComputedRecords(playerRows, gameStats, playersById, gameResultsRows, standingsRows);

    // Admin records first (preserved order via sort_order), then any
    // computed records whose title isn't already overridden.
    const adminTitles = new Set(records.map((r) => normTitle(r.title)));
    renderedRecords = [
      ...records.map((r) => ({ id: r.id, title: r.title, holder: r.holder, value: r.value, auto: false })),
      ...computed
        .filter((c) => !adminTitles.has(normTitle(c.title)))
        .map((c, i) => ({ id: `auto-${i}`, title: c.title, holder: c.holder, value: c.value, auto: true })),
    ];
  } catch {
    seasons = [];
    records = [];
    renderedRecords = [];
  }

  return (
    <div className={`bg-slate-950 min-h-screen p-8 text-white font-body ${lang === 'he' ? 'text-right' : 'text-left'}`} dir={dir}>

      <header className="mb-12 border-b border-orange-500/30 pb-6">
        <h1 className="font-heading font-black text-5xl mb-2 italic uppercase">{T('היכל התהילה')}</h1>
        <p className="text-slate-300 text-lg font-semibold font-body">{T('מורשת הכדורסל של ליגת ליבי')}</p>
      </header>

      {/* League Champion + Cup Holder */}
      {(leagueChampion || cupHolder) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
          {leagueChampion && (
            <TrophyCard
              title={T('אלופת הליגה')}
              subtitle={T('אלופת הפלייאוף · 2025–2026')}
              team={leagueChampion}
              teamLabel={T(leagueChampion)}
              logo={leagueChampionLogo}
              badge="CHAMPION"
              icon="🏆"
            />
          )}
          {cupHolder && (
            <TrophyCard
              title={T('מחזיקת הגביע')}
              subtitle={T('אלופת הגביע · 2025–2026')}
              team={cupHolder}
              teamLabel={T(cupHolder)}
              logo={cupHolderLogo}
              badge="CUP HOLDER"
              icon="🥇"
            />
          )}
        </div>
      )}

      {/* Champions wall */}
      <section className="mb-16">
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-orange-500 inline-block"></span> {T('אלופות הליגה')}
        </h2>
        {seasons.length === 0 ? (
          <p className="text-slate-300 font-bold text-center py-12">{T('אין עונות להצגה עדיין')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {seasons.map((season) => (
              <Link
                key={season.id}
                href={`/hall-of-fame/${encodeURIComponent(season.year)}`}
                className="relative group overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 hover:border-orange-500 transition-all cursor-pointer block"
              >
                {/* Large year watermark */}
                <div className="absolute -left-4 -top-4 font-stats text-8xl text-white/5 group-hover:text-orange-500/10 transition-colors select-none">
                  {season.year.split('-')[0]}
                </div>

                <p className="font-stats text-2xl text-orange-500">{season.year}</p>
                <h3 className="font-heading font-black text-3xl mb-2">{season.champion_name ? T(season.champion_name) : '—'}</h3>

                {season.runner_up_name && (
                  <p className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-300">
                    <span className="text-slate-400">🥈</span>
                    <span className="text-slate-400">{T('סגנית אלופה:')}</span>
                    <span className="text-white">{T(season.runner_up_name)}</span>
                  </p>
                )}

                <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                  <div>
                    <p className="text-xs font-black text-slate-300 uppercase font-body">{T('MVP של העונה')}</p>
                    <p className="font-heading font-black text-white">{season.mvp_name ? displayName(season.mvp_name, lang) : '—'}</p>
                    <p className="font-stats text-lg font-black text-orange-400">{season.mvp_stats ?? ''}</p>
                  </div>
                  <div className="bg-orange-500 text-black px-3 py-1 rounded-full text-xs font-black font-heading">
                    CHAMPIONS
                  </div>
                </div>
                <div className="mt-3 text-sm font-bold text-orange-400 group-hover:text-orange-300 transition font-body">
                  {T('לחץ לפרטי הגמר ←')}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Cup holders wall */}
      <section className="mb-16">
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-yellow-400 inline-block"></span> {T('מחזיקות הגביע')}
        </h2>
        {seasons.filter(s => s.cup_holder_name).length === 0 ? (
          <p className="font-bold text-[#8aaac8] text-center py-12">{T('אין מחזיקות גביע להצגה עדיין')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {seasons.filter(s => s.cup_holder_name).map((season) => (
              <div
                key={`cup-${season.id}`}
                className="relative overflow-hidden rounded-2xl bg-slate-900 border border-yellow-400/20 p-6 hover:border-yellow-400/60 transition-all"
              >
                {/* Large year watermark */}
                <div className="absolute -left-4 -top-4 font-stats text-8xl text-yellow-400/[0.05] select-none">
                  {season.year.split('-')[0]}
                </div>

                <p className="font-stats text-2xl text-yellow-400">{season.year}</p>
                <h3 className="font-heading font-black text-3xl mb-4">{season.cup_holder_name ? T(season.cup_holder_name) : ''}</h3>

                <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                  <div>
                    <p className="text-xs font-black text-slate-300 uppercase font-body">{T('מחזיקת הגביע')}</p>
                    <p className="font-heading font-black text-white">🥇 {season.cup_holder_name ? T(season.cup_holder_name) : ''}</p>
                  </div>
                  <div className="bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-black font-heading">
                    CUP HOLDER
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All-time records */}
      <section>
        <h2 className="font-heading text-2xl mb-6 flex items-center gap-2">
          <span className="w-8 h-px bg-orange-500 inline-block"></span> {T('שיאי כל הזמנים')}
        </h2>
        {renderedRecords.length === 0 ? (
          <p className="text-slate-300 font-bold text-center py-12">{T('אין שיאים להצגה עדיין')}</p>
        ) : (
          <>
            <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800">
              <table className="w-full">
                <thead className="bg-slate-800/50 font-heading text-orange-500 text-sm italic">
                  <tr>
                    <th className={`p-4 ${lang === 'he' ? 'text-right' : 'text-left'}`}>{T('קטגוריה')}</th>
                    <th className={`p-4 ${lang === 'he' ? 'text-right' : 'text-left'}`}>{T('בעל השיא')}</th>
                    <th className="p-4 text-center">{T('נתון')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {renderedRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-orange-500/5 transition-colors">
                      <td className="p-4 font-heading font-bold">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{T(record.title)}</span>
                          {record.auto && (
                            <span
                              title={T('שיא זה מחושב אוטומטית מהנתונים הזמינים. ניתן לדרוס ידנית דרך לוח הניהול.')}
                              className="rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-black text-orange-400"
                            >
                              ⚡ {T('אוטומטי')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-body font-bold text-white">{record.holder ? record.holder.split(/(\s·\s|,\s)/).map((part) => displayName(part, lang)).join('') : '—'}</td>
                      <td className="p-4 text-center font-stats text-3xl text-orange-500">{record.value ? (lang === 'en' ? record.value.replace('נק׳', 'pts') : record.value) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderedRecords.some((r) => r.auto) && (
              <p className="mt-3 text-xs font-bold text-slate-400">
                {T('⚡ סימון "אוטומטי" = השיא נגזר מהנתונים הקיימים בליגה.')}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
