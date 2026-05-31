export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import StageCardsBracket from '@/components/cup/StageCardsBracket';
import JourneyBracket from '@/components/cup/JourneyBracket';
import { getLang, st } from '@/lib/get-lang';
import { resolveSeasonFromParams, listKnownSeasons } from '@/lib/current-season';
import SeasonPicker from '@/components/SeasonPicker';
import ArchiveBanner from '@/components/ArchiveBanner';
import { deriveCupScores } from '@/lib/cup-derived-scores';

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
  const [{ data: games }, { data: teams }, { data: settings }, { data: cupStatsData }, logoUrl, lang, seasons] = await Promise.all([
    supabaseAdmin.from('cup_games').select('*').eq('season', viewing).order('round_order', { ascending: true }).order('game_number', { ascending: true }),
    supabaseAdmin.from('teams').select('id, name, logo_url'),
    supabaseAdmin
      .from('league_settings')
      .select('key,value')
      .eq('key', 'cup_tournament_teams'),
    supabaseAdmin.from('cup_game_stats').select('cup_game_id, team_id, points').eq('season', viewing),
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

  // Enrich games with a score derived from per-player stats / quarters when
  // the admin never typed an explicit home_score/away_score. Games with a
  // derived result are marked played so the bracket shows the winner + the
  // "אלוף הגביע" banner (the deriving function leaves official scores intact).
  const rawCupGames = games ?? [];
  const derivedScores = deriveCupScores(
    rawCupGames,
    teams ?? [],
    (cupStatsData ?? []) as { cup_game_id: string; team_id: string | null; points: number | null }[],
  );
  const cupGames = rawCupGames.map((g) => {
    const d = derivedScores.get(g.id);
    return d ? { ...g, home_score: d.home, away_score: d.away, played: true } : g;
  });

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

  // Game IDs that have recorded stats (player stats or a quarter breakdown) —
  // bracket cards for these games link to the per-game box-score page.
  const statsGameIds = Array.from(
    new Set<string>([
      ...(cupStatsData ?? []).map((s: { cup_game_id: string }) => s.cup_game_id),
      ...cupGames
        .filter((g) => (g.home_quarters?.length ?? 0) > 0 || (g.away_quarters?.length ?? 0) > 0)
        .map((g) => g.id),
    ]),
  );

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
          <div className="mt-2 flex justify-center items-center gap-2 flex-wrap">
            <SeasonPicker current={current} viewing={viewing} seasons={seasons} />
            <Link
              href="/cup/stats"
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/[0.08] px-3 py-1 text-[11px] font-black text-orange-300 hover:bg-orange-500/[0.15] transition-colors"
            >
              📊 {T('סטטיסטיקה גביע')}
            </Link>
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

        {/* Mobile: stacked round cards. statsGameIds tells the bracket which
            game cards link out to their per-game box-score page. */}
        <div className="sm:hidden">
          <StageCardsBracket games={cupGames} teamLogos={teamLogos} statsGameIds={statsGameIds} />
        </div>

        {/* Desktop/tablet: interactive bracket with team-journey overlay */}
        <div className="hidden sm:block">
          <JourneyBracket games={cupGames} teamLogos={teamLogos} statsGameIds={statsGameIds} />
        </div>
      </div>
    </>
  );
}
