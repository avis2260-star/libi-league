export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import StageCardsBracket from '@/components/cup/StageCardsBracket';
import JourneyBracket from '@/components/cup/JourneyBracket';
import { getLang, st } from '@/lib/get-lang';

async function getLogoUrl() {
  try {
    const { data } = await supabaseAdmin.from('league_settings').select('value').eq('key', 'league_logo_url').maybeSingle();
    return data?.value ?? '/logo.png';
  } catch { return '/logo.png'; }
}

export default async function CupPage() {
  const [{ data: games }, { data: teams }, { data: settings }, logoUrl, lang] = await Promise.all([
    supabaseAdmin.from('cup_games').select('*').order('round_order', { ascending: true }).order('game_number', { ascending: true }),
    supabaseAdmin.from('teams').select('id, name, logo_url'),
    supabaseAdmin
      .from('league_settings')
      .select('key,value')
      .in('key', ['cup_tournament_date', 'cup_tournament_location', 'cup_tournament_teams']),
    getLogoUrl(),
    getLang(),
  ]);
  const T = (he: string) => st(he, lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  const teamLogos: Record<string, string> = {};
  for (const t of teams ?? []) {
    if (t.name && t.logo_url) teamLogos[t.name] = t.logo_url;
  }

  const cupGames = games ?? [];

  // Cup tournament meta (date / location / participating teams)
  const settingsMap = new Map<string, string>((settings ?? []).map((r) => [r.key, r.value]));
  const cupDate = settingsMap.get('cup_tournament_date') ?? '';
  const cupLocation = settingsMap.get('cup_tournament_location') ?? '';
  let cupTeamIds: string[] = [];
  try {
    const raw = settingsMap.get('cup_tournament_teams');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) cupTeamIds = parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch { /* malformed — ignore */ }
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const participatingTeams = cupTeamIds.map((id) => teamById.get(id)).filter((t): t is NonNullable<typeof t> => !!t);
  const cupDateLabel = cupDate
    ? new Date(cupDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

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
          <p className="text-[#5a7a9a] text-[11px] font-body">{T('טורניר הגביע העונתי 2025–2026')}</p>
          {(cupDateLabel || cupLocation) && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-bold">
              {cupDateLabel && (
                <span className="text-[#c8d8e8]">📅 {cupDateLabel}</span>
              )}
              {cupLocation && (
                <span className="text-[#c8d8e8]">📍 {cupLocation}</span>
              )}
            </div>
          )}
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
