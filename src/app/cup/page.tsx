export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import StageCardsBracket from '@/components/cup/StageCardsBracket';
import JourneyBracket from '@/components/cup/JourneyBracket';
import PublicBoxScore from '@/components/PublicBoxScore';
import { getLang, st } from '@/lib/get-lang';
import { resolveSeasonFromParams, listKnownSeasons } from '@/lib/current-season';
import { makeNameResolver } from '@/lib/team-name-resolver';
import { bucketGameStats, type RawStat } from '@/lib/box-score';
import SeasonPicker from '@/components/SeasonPicker';
import ArchiveBanner from '@/components/ArchiveBanner';

async function getLogoUrl() {
  try {
    const { data } = await supabaseAdmin.from('league_settings').select('value').eq('key', 'league_logo_url').maybeSingle();
    return data?.value ?? '/logo.png';
  } catch { return '/logo.png'; }
}

export default async function CupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { viewing, current, isArchive } = await resolveSeasonFromParams(params);
  const [{ data: games }, { data: teams }, { data: settings }, { data: cupStatsData }, { data: playersData }, logoUrl, lang, seasons] = await Promise.all([
    supabaseAdmin.from('cup_games').select('*').eq('season', viewing).order('round_order', { ascending: true }).order('game_number', { ascending: true }),
    supabaseAdmin.from('teams').select('id, name, logo_url'),
    supabaseAdmin
      .from('league_settings')
      .select('key,value')
      .eq('key', 'cup_tournament_teams'),
    supabaseAdmin.from('cup_game_stats').select('cup_game_id, player_id, team_id, points, three_pointers, fouls').eq('season', viewing),
    supabaseAdmin.from('players').select('id, name, jersey_number'),
    getLogoUrl(),
    getLang(),
    listKnownSeasons(),
  ]);
  const T = (he: string) => st(he, lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  const teamLogos: Record<string, string> = {};
  for (const t of teams ?? []) {
    if (t.name && t.logo_url) teamLogos[t.name] = t.logo_url;
  }

  const cupGames = games ?? [];

  // Participating teams (date + location were dropped — each game is played
  // at the home_team's venue and dates live per-game on cup_games).
  let cupTeamIds: string[] = [];
  try {
    const raw = (settings ?? []).find((r) => r.key === 'cup_tournament_teams')?.value;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) cupTeamIds = parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch { /* malformed — ignore */ }
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const participatingTeams = cupTeamIds.map((id) => teamById.get(id)).filter((t): t is NonNullable<typeof t> => !!t);

  // ── Box scores: per-game player stats + quarter breakdown ────────────────
  const resolveName = makeNameResolver((teams ?? []).map((t) => ({ id: t.id, name: t.name })));
  const idByTeamName = new Map((teams ?? []).map((t) => [t.name, t.id]));
  const teamNameToId = (name: string) => idByTeamName.get(resolveName(name)) ?? null;

  const playerById = new Map(
    (playersData ?? []).map((p) => [p.id, { name: p.name, jersey_number: p.jersey_number }]),
  );

  const cupStatsByGame = new Map<string, RawStat[]>();
  for (const s of (cupStatsData ?? []) as (RawStat & { cup_game_id: string })[]) {
    const arr = cupStatsByGame.get(s.cup_game_id) ?? [];
    arr.push(s);
    cupStatsByGame.set(s.cup_game_id, arr);
  }

  const boxScores = cupGames
    .map((g) => {
      const statRows = cupStatsByGame.get(g.id) ?? [];
      const hasQuarters = (g.home_quarters?.length ?? 0) > 0 || (g.away_quarters?.length ?? 0) > 0;
      if (statRows.length === 0 && !hasQuarters) return null;
      const { homePlayers, awayPlayers } = bucketGameStats(
        statRows, playerById, teamNameToId(g.home_team), teamNameToId(g.away_team),
      );
      return { game: g, homePlayers, awayPlayers };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  return (
    <>
      {/* Scope-specific tweaks: let the /cup page fill the viewport without
          triggering a page scrollbar. Hide the tall desktop footer and mobile
          footer (top nav + bottom nav still give access to the rest of the
          site); trim the <main> padding so the bracket sits closer to the
          header. These styles are only in the DOM while /cup is mounted. */}
      <style>{`
        main { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
        footer { display: none !important; }
      `}</style>

      <div className="space-y-3" dir={dir}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={T('ליגת ליבי')} className="h-8 w-8 object-contain rounded-full" />
            <h1 className="text-xl sm:text-2xl font-black text-white font-heading">{T('🏆 גביע ליגת ליבי')}</h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={T('ליגת ליבי')} className="h-8 w-8 object-contain rounded-full" />
          </div>
          <p className="text-[#5a7a9a] text-[11px] font-body">
            {T('טורניר הגביע העונתי')} {viewing}
          </p>
          <div className="mt-2 flex justify-center">
            <SeasonPicker current={current} viewing={viewing} seasons={seasons} />
          </div>
          {participatingTeams.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 max-w-2xl mx-auto">
              <span className="text-[10px] font-black tracking-widest uppercase text-[#5a7a9a]">{T('קבוצות משתתפות')}:</span>
              {participatingTeams.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-[#c8d8e8]"
                >
                  {t.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo_url} alt={t.name} className="h-3.5 w-3.5 rounded-full object-cover" />
                  )}
                  {T(t.name)}
                </span>
              ))}
            </div>
          )}
          <p className="hidden sm:block text-[#8aaac8] text-[10px] mt-1">{T('💡 לחצו על כל קבוצה כדי לצפות במסע שלה בטורניר')}</p>
        </div>

        {isArchive && <ArchiveBanner viewing={viewing} current={current} pathname="/cup" />}

        {/* Mobile: stacked round cards (Option A) */}
        <div className="sm:hidden">
          <StageCardsBracket games={cupGames} teamLogos={teamLogos} />
        </div>

        {/* Desktop/tablet: interactive bracket with team-journey overlay (Option E) */}
        <div className="hidden sm:block">
          <JourneyBracket games={cupGames} teamLogos={teamLogos} />
        </div>

        {/* Box scores — games with recorded player stats / quarter breakdown */}
        {boxScores.length > 0 && (
          <div className="mx-auto max-w-3xl space-y-2 pt-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#8aaac8]">
              📋 {T('גיליונות משחק')}
            </h2>
            {boxScores.map(({ game, homePlayers, awayPlayers }) => (
              <PublicBoxScore
                key={game.id}
                lang={lang as 'he' | 'en'}
                gameLabel={T(game.round)}
                homeTeamName={T(game.home_team)}
                awayTeamName={T(game.away_team)}
                homeScore={game.home_score}
                awayScore={game.away_score}
                homeQuarters={game.home_quarters ?? null}
                awayQuarters={game.away_quarters ?? null}
                homePlayers={homePlayers}
                awayPlayers={awayPlayers}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
