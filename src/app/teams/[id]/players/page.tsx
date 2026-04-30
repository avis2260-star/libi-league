import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPlayersByTeam, getTeams } from '@/lib/supabase';
import { getLang, st } from '@/lib/get-lang';
import type { Player, Team } from '@/types';

export const dynamic = 'force-dynamic';

const POSITION_LABELS_HE: Record<string, string> = {
  PG: 'פוינט גארד', SG: 'שוטינג גארד',
  SF: 'סמול פורוורד', PF: 'פאואר פורוורד', C: 'סנטר',
};
const POSITION_LABELS_EN: Record<string, string> = {
  PG: 'Point Guard', SG: 'Shooting Guard',
  SF: 'Small Forward', PF: 'Power Forward', C: 'Center',
};

// ── Trading Card ──────────────────────────────────────────────────────────────

function PlayerCard({ player, T, en }: { player: Player & { team?: Team }; T: (he: string) => string; en: boolean }) {
  const POSITION_LABELS = en ? POSITION_LABELS_EN : POSITION_LABELS_HE;
  const position = player.position ? POSITION_LABELS[player.position] ?? player.position : null;
  const teamName = T(player.team?.name ?? '');
  const isInactive = player.is_active === false;

  return (
    <Link href={`/players/${player.id}`} className="group block">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1a2a3a] to-[#0b1520] transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/40 hover:shadow-[0_8px_32px_rgba(255,107,26,0.15)]"
        style={isInactive ? { filter: 'grayscale(55%)', opacity: 0.72 } : undefined}
      >
        {/* Inactive ribbon */}
        {isInactive && (
          <div className="absolute top-3 right-0 z-10 flex items-center gap-1 rounded-r-none rounded-l-full bg-red-600/90 px-3 py-0.5 text-[10px] font-black text-white shadow-md">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {T('לא פעיל')}
          </div>
        )}

        {/* Top banner with team name */}
        <div className="relative bg-gradient-to-l from-orange-600 to-orange-800 px-4 py-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/80">{en ? 'LIBI LEAGUE · 2025–2026 SEASON' : 'ליגת ליבי · עונת 2025–2026'}</p>
          <p className="truncate text-xs font-bold text-white">{teamName}</p>
          {/* Jersey number badge */}
          {player.jersey_number != null && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/30 bg-black/30 text-lg font-black text-white">
              {player.jersey_number}
            </div>
          )}
        </div>

        {/* Player photo area */}
        <div className="relative flex items-center justify-center bg-gradient-to-b from-[#1e3048] to-[#0f1e2e] py-6">
          {player.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.photo_url} alt={player.name} className="h-24 w-24 rounded-full object-cover border-2 border-orange-500/40 shadow-lg" />
          ) : player.team?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.team.logo_url} alt={teamName} className="h-20 w-20 rounded-full object-cover border-2 border-white/20" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10 bg-white/5 text-4xl font-black text-[#2a4a6a]">
              {[...player.name].find(c => c.trim()) ?? '?'}
            </div>
          )}
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1520] via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Player name + position */}
        <div className="relative px-4 pb-1 pt-2 text-center">
          <p className="text-base font-black leading-tight text-white group-hover:text-orange-400 transition-colors">
            {player.name}
          </p>
          {position && (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#5a7a9a]">
              {position}
            </p>
          )}
        </div>

        {/* Stats strip */}
        <div className="mx-3 mb-4 mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/30">
          <div className="px-2 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#4a6a8a]">{T('נק׳')}</p>
            <p className="text-lg font-black text-orange-400">{player.points}</p>
          </div>
          <div className="px-2 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#4a6a8a]">{en ? '3PT' : '3 נק׳'}</p>
            <p className="text-lg font-black text-[#e0c97a]">{player.three_pointers}</p>
          </div>
          <div className="px-2 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#4a6a8a]">{T('עבירות')}</p>
            <p className="text-lg font-black text-red-400">{player.fouls}</p>
          </div>
        </div>

        {/* Card footer — status indicator */}
        <div className="border-t border-white/[0.05] px-4 py-2 flex items-center justify-between">
          <p className="text-[9px] font-semibold tracking-widest text-[#2a4a6a]">LIBI LEAGUE · OFFICIAL CARD</p>
          {isInactive ? (
            <span className="flex items-center gap-1 text-[9px] font-bold text-red-500">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {T('לא פעיל')}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-bold text-green-500">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(74,222,128,0.7)]" />
              {T('פעיל')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function TeamPlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [players, teams, lang] = await Promise.all([
    getPlayersByTeam(id),
    getTeams(),
    getLang(),
  ]);
  const T = (he: string) => st(he, lang);
  const en = lang === 'en';

  const team = teams.find((t) => t.id === id);
  if (!team) notFound();

  const translatedTeamName = T(team.name);
  const teamInitial = [...translatedTeamName].find(c => c.trim()) ?? '🏀';

  return (
    <div className="space-y-8" dir={en ? 'ltr' : 'rtl'}>
      {/* Back + title */}
      <div>
        <Link href="/teams" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#5a7a9a] hover:text-white transition-colors">
          {en ? '← Back to Teams' : '← חזרה לקבוצות'}
        </Link>
        <h1 className="text-3xl font-black text-white">{translatedTeamName}</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">
          {players.length > 0
            ? (en ? `${players.length} registered players · 2025–2026 season` : `${players.length} שחקנים רשומים · עונת 2025–2026`)
            : (en ? 'No players registered yet' : 'אין שחקנים רשומים עדיין')}
        </p>
      </div>

      {/* Team info card — click to go to team stats */}
      <Link
        href={`/team/${encodeURIComponent(team.name)}`}
        className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-5 transition hover:border-orange-500/30 hover:bg-orange-500/[0.04] group"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-orange-500/10 flex items-center justify-center">
          {team.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo_url} alt={translatedTeamName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-black text-orange-400">
              {teamInitial}
            </span>
          )}
        </div>
        <div className="flex-1">
          <p className="font-bold text-white group-hover:text-orange-400 transition-colors">{translatedTeamName}</p>
          {team.captain_name && team.captain_name !== 'TBD' && (
            <p className="text-sm text-[#5a7a9a]">{T('קפטן')}: <span className="text-[#8aaac8]">{team.captain_name}</span></p>
          )}
          {team.contact_info && (
            <p className="text-sm text-[#5a7a9a]">{en ? 'Contact' : 'פרטי קשר'}: <span className="text-[#8aaac8]">{team.contact_info}</span></p>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <p className="text-[9px] font-bold text-[#3a5a7a] group-hover:text-orange-400 transition-colors whitespace-nowrap">{en ? 'View team statistics' : 'למעבר לסטטיסטיקה קבוצתית'}</p>
          <span className="text-[#3a5a7a] group-hover:text-orange-400 transition-colors text-lg">{en ? '→' : '←'}</span>
        </div>
      </Link>

      {/* Player cards grid */}
      {players.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] py-16 text-center">
          <p className="text-4xl mb-3">🏀</p>
          <p className="text-sm text-[#5a7a9a]">{en ? 'No players found for this team.' : 'לא נמצאו שחקנים עבור קבוצה זו.'}</p>
          <p className="mt-1 text-xs text-[#3a5a7a]">{en ? 'Add players via the admin panel.' : 'הוסף שחקנים דרך לוח הניהול.'}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} T={T} en={en} />
          ))}
        </div>
      )}
    </div>
  );
}
