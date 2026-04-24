export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import TournamentBracket from '@/components/TournamentBracket';

async function getLogoUrl() {
  try {
    const { data } = await supabaseAdmin.from('league_settings').select('value').eq('key', 'league_logo_url').maybeSingle();
    return data?.value ?? '/logo.png';
  } catch { return '/logo.png'; }
}

export default async function CupPage() {
  const [{ data: games }, { data: teams }, logoUrl] = await Promise.all([
    supabaseAdmin.from('cup_games').select('*').order('round_order', { ascending: true }).order('game_number', { ascending: true }),
    supabaseAdmin.from('teams').select('name, logo_url'),
    getLogoUrl(),
  ]);

  const teamLogos: Record<string, string> = {};
  for (const t of teams ?? []) {
    if (t.name && t.logo_url) teamLogos[t.name] = t.logo_url;
  }

  return (
    <>
      {/* Scope-specific tweaks: let the /cup page fill the viewport without
          triggering a page scrollbar. Hide the tall desktop footer and
          mobile footer (top nav + bottom nav still give access to the rest
          of the site); trim the <main> padding so the bracket sits closer
          to the header. These styles are only in the DOM while /cup is
          mounted — they disappear on navigation. */}
      <style>{`
        main { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
        footer { display: none !important; }
      `}</style>

      <div className="space-y-3" dir="rtl">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="ליגת ליבי" className="h-8 w-8 object-contain rounded-full" />
            <h1 className="text-xl sm:text-2xl font-black text-white font-heading">🏆 גביע ליגת ליבי</h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="ליגת ליבי" className="h-8 w-8 object-contain rounded-full" />
          </div>
          <p className="text-[#5a7a9a] text-[11px] font-body">טורניר הגביע העונתי 2025–2026</p>
        </div>
        <TournamentBracket games={games ?? []} teamLogos={teamLogos} />
      </div>
    </>
  );
}
