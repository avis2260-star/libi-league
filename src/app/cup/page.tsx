export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import TournamentBracket from '@/components/TournamentBracket';

export default async function CupPage() {
  const { data: games } = await supabaseAdmin
    .from('cup_games')
    .select('*')
    .order('round_order', { ascending: true })
    .order('game_number', { ascending: true });

  return (
    <div className="space-y-8" dir="rtl">
      <div className="text-center">
        <h1 className="text-4xl font-black text-white mb-2">🏆 גביע ליגת ליבי</h1>
        <p className="text-[#5a7a9a]">טורניר הגביע העונתי 2025–2026</p>
      </div>
      <TournamentBracket games={games ?? []} />
    </div>
  );
}
