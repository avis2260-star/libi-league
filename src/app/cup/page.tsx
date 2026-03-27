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
        <div className="flex items-center justify-center gap-3 mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ליגת ליבי" className="h-12 w-12 object-contain rounded-full" />
          <h1 className="text-4xl font-black text-white">🏆 גביע ליגת ליבי</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ליגת ליבי" className="h-12 w-12 object-contain rounded-full" />
        </div>
        <p className="text-[#5a7a9a]">טורניר הגביע העונתי 2025–2026</p>
      </div>
      <TournamentBracket games={games ?? []} />
    </div>
  );
}
