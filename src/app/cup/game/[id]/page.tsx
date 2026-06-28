export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import PublicBoxScore from '@/components/PublicBoxScore';
import { getLang, st } from '@/lib/get-lang';
import { makeNameResolver } from '@/lib/team-name-resolver';
import { bucketGameStats, type RawStat } from '@/lib/box-score';

export default async function CupGameBoxScorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ data: game }, { data: teams }, { data: statRows }, { data: playersData }, lang] = await Promise.all([
    supabaseAdmin.from('cup_games').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('teams').select('id, name, logo_url'),
    supabaseAdmin
      .from('cup_game_stats')
      .select('cup_game_id, player_id, team_id, points, three_pointers, fouls')
      .eq('cup_game_id', id),
    supabaseAdmin.from('players').select('id, name, jersey_number'),
    getLang(),
  ]);

  if (!game) notFound();

  const T = (he: string) => st(he, lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const en = lang === 'en';

  const resolveName = makeNameResolver((teams ?? []).map((t) => ({ id: t.id, name: t.name })));
  const idByTeamName = new Map((teams ?? []).map((t) => [t.name, t.id]));
  const teamNameToId = (name: string) => idByTeamName.get(resolveName(name)) ?? null;

  const playerById = new Map(
    (playersData ?? []).map((p) => [p.id, { name: p.name, jersey_number: p.jersey_number }]),
  );

  const { homePlayers, awayPlayers } = bucketGameStats(
    (statRows ?? []) as RawStat[],
    playerById,
    teamNameToId(game.home_team),
    teamNameToId(game.away_team),
  );

  const hasQuarters = (game.home_quarters?.length ?? 0) > 0 || (game.away_quarters?.length ?? 0) > 0;
  const hasStats = (statRows?.length ?? 0) > 0 || hasQuarters;

  return (
    <div className="mx-auto max-w-3xl space-y-4" dir={dir}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#5a7a9a]">
            🏆 {en ? `Cup · ${game.round}` : `גביע · ${game.round}`}
          </p>
          <h1 className="text-xl sm:text-2xl font-black text-white font-heading">
            {T(game.home_team)} <span className="text-[#5a7a9a]">vs</span> {T(game.away_team)}
          </h1>
          {game.location && (
            <p className="mt-1 text-xs font-bold text-[#8aaac8]">📍 {game.location}</p>
          )}
        </div>
        <Link href="/cup" className="shrink-0 text-xs font-bold text-amber-300 hover:text-amber-200 transition">
          {en ? 'Bracket →' : '← לבראקט'}
        </Link>
      </div>

      {hasStats ? (
        <PublicBoxScore
          lang={lang as 'he' | 'en'}
          gameLabel={T(game.round)}
          award={<span className="text-base" aria-hidden>🏆</span>}
          homeTeamName={T(game.home_team)}
          awayTeamName={T(game.away_team)}
          homeScore={game.home_score}
          awayScore={game.away_score}
          homeQuarters={game.home_quarters ?? null}
          awayQuarters={game.away_quarters ?? null}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          defaultOpen
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
          <p className="text-5xl mb-3">📊</p>
          <p className="text-base font-bold text-[#8aaac8]">
            {en ? 'No box score yet' : 'גיליון המשחק טרם הוזן'}
          </p>
          <p className="mt-2 text-sm text-[#5a7a9a]">
            {en ? 'Stats appear here once the admin enters them.' : 'הנתונים יופיעו כאן לאחר שהמנהל יזין אותם.'}
          </p>
        </div>
      )}

      {game.video_url && (
        <a
          href={game.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-3 text-sm font-bold text-orange-400 hover:bg-orange-500/20 transition-colors"
        >
          🎬 {en ? 'Watch Game Video' : 'צפה בסרטון המשחק'}
        </a>
      )}
    </div>
  );
}
