export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import StageCardsBracket from '@/components/cup/StageCardsBracket';
import JourneyBracket from '@/components/cup/JourneyBracket';
import { getLang, st } from '@/lib/get-lang';
import { resolveSeasonFromParams, listKnownSeasons } from '@/lib/current-season';
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
  const [{ data: games }, { data: teams }, logoUrl, lang, seasons] = await Promise.all([
    supabaseAdmin.from('cup_games').select('*').eq('season', viewing).order('round_order', { ascending: true }).order('game_number', { ascending: true }),
    supabaseAdmin.from('teams').select('name, logo_url'),
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
      </div>
    </>
  );
}
