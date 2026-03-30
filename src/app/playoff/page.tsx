export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NORTH_TABLE, SOUTH_TABLE } from '@/lib/league-data';
import ChampionshipPlate from '@/components/ChampionshipPlate';
import ChampionReveal from '@/components/ChampionReveal';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Series {
  series_number: number; team_a: string; team_a_label: string;
  team_b: string; team_b_label: string;
}
interface Game {
  series_number: number; game_number: number;
  home_score: number | null; away_score: number | null;
  played: boolean; game_date: string | null;
}
type StandingRow = { rank: number; name: string; division: string };

/* ── Virtual bracket (used when playoff_series table is empty) ──────────── */
const VIRTUAL_SERIES: Series[] = [
  { series_number: 1, team_a: '', team_a_label: '🟠 דרום #1', team_b: '', team_b_label: '🔵 צפון #4' },
  { series_number: 2, team_a: '', team_a_label: '🟠 דרום #2', team_b: '', team_b_label: '🔵 צפון #3' },
  { series_number: 3, team_a: '', team_a_label: '🔵 צפון #1', team_b: '', team_b_label: '🟠 דרום #4' },
  { series_number: 4, team_a: '', team_a_label: '🔵 צפון #2', team_b: '', team_b_label: '🟠 דרום #3' },
  { series_number: 5, team_a: '', team_a_label: 'נצח סדרה 1', team_b: '', team_b_label: 'נצח סדרה 2' },
  { series_number: 6, team_a: '', team_a_label: 'נצח סדרה 3', team_b: '', team_b_label: 'נצח סדרה 4' },
  { series_number: 7, team_a: '', team_a_label: 'נצח סדרה 5', team_b: '', team_b_label: 'נצח סדרה 6' },
];

/* Which earlier series feed each SF/Final series */
const SERIES_FEED: Record<number, [number, number]> = {
  5: [1, 2],
  6: [3, 4],
  7: [5, 6],
};

/* ── Score helpers ──────────────────────────────────────────────────────── */
function homeForGame(s: Series, gNum: number) { return gNum === 2 ? s.team_b : s.team_a; }

function seriesScore(s: Series, games: Game[]) {
  let winsA = 0, winsB = 0;
  for (const g of games.filter(g => g.series_number === s.series_number && g.played)) {
    const home    = homeForGame(s, g.game_number);
    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
    if ((homeWon && home === s.team_a) || (!homeWon && home !== s.team_a)) winsA++;
    else winsB++;
  }
  return { winsA, winsB, winner: winsA >= 2 ? s.team_a : winsB >= 2 ? s.team_b : null };
}

/* ── Logo helpers ───────────────────────────────────────────────────────── */
function normName(n: string) {
  return n.replace(/["""״'']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function findLogo(name: string, logos: Record<string, string>) {
  return logos[name] ?? Object.entries(logos).find(([k]) => normName(k) === normName(name))?.[1];
}

function TeamLogo({
  name, logos, size = 'md',
}: { name: string; logos: Record<string, string>; size?: 'sm' | 'md' | 'lg' }) {
  const url = findLogo(name, logos);
  const sz  = size === 'lg' ? 'h-16 w-16 text-2xl' : size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-11 w-11 text-xs';
  if (url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name}
      className={`${sz} shrink-0 rounded-full object-cover border-2 border-white/10 shadow-md`} />
  );
  return (
    <div className={`${sz} shrink-0 rounded-full bg-[#1a2e45] border-2 border-white/10 flex items-center justify-center font-black text-[#3a5a7a]`}>
      {[...name].find(c => /\S/.test(c)) ?? '?'}
    </div>
  );
}

/* ── Label parser ───────────────────────────────────────────────────────── */
function parseLabel(label: string) {
  const isNorth   = label.includes('צפון');
  const isSouth   = label.includes('דרום');
  const hasEmoji  = /[\u{1F300}-\u{1FFFF}]/u.test(label);
  const emoji     = hasEmoji ? '' : (isNorth ? '🔵' : isSouth ? '🟠' : '');
  const divName   = isNorth ? 'צפון' : isSouth ? 'דרום' : '';
  const seed      = label.match(/#(\d+)/)?.[1] ?? '';
  return {
    emoji, divName, seed,
    full: `${emoji} ${divName}${seed ? ` #${seed}` : ''}`.trim() || label,
  };
}

/* ── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({
  winsA, winsB, winner, teamA, teamB,
}: { winsA: number; winsB: number; winner: string | null; teamA: string; teamB: string }) {
  if (winner) return (
    <span className="rounded-full bg-green-500/15 border border-green-500/30 px-2.5 py-0.5 text-[10px] font-black text-green-400 tracking-wide">
      FINAL
    </span>
  );
  if (winsA === 0 && winsB === 0) return (
    <span className="rounded-full bg-white/[0.05] border border-white/[0.08] px-2.5 py-0.5 text-[10px] font-black text-[#3a5a7a] tracking-wide">
      טרם החל
    </span>
  );
  if (winsA === winsB) return (
    <span className="rounded-full bg-yellow-400/10 border border-yellow-400/25 px-2.5 py-0.5 text-[10px] font-black text-yellow-400 tracking-wide">
      שוויון
    </span>
  );
  const leader = winsA > winsB ? teamA : teamB;
  return (
    <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[10px] font-black text-blue-400 tracking-wide">
      מוביל: {leader}
    </span>
  );
}

/* ── Game result dots ───────────────────────────────────────────────────── */
function GameDots({ series, allGames }: { series: Series; allGames: Game[] }) {
  const seriesGames = allGames.filter(g => g.series_number === series.series_number);
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {[1, 2, 3].map(gNum => {
        const g      = seriesGames.find(g => g.game_number === gNum);
        const played = g?.played && g.home_score !== null && g.away_score !== null;
        const home   = homeForGame(series, gNum);
        const homeWon = played && (g!.home_score! > g!.away_score!);
        const aWon   = played && ((homeWon && home === series.team_a) || (!homeWon && home !== series.team_a));
        return (
          <div key={gNum} className="flex flex-col items-center gap-0.5">
            <div className={`h-2 w-2 rounded-full ${
              !played ? 'border border-white/[0.12] bg-transparent' :
              aWon    ? 'bg-orange-400' : 'bg-[#4a6a8a]'
            }`} />
            <span className="text-[8px] text-[#2a4a6a]">{gNum}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── NBA Scoreboard Card ────────────────────────────────────────────────── */
function ScoreboardCard({
  series, allGames, teamLogos, roundLabel, isFinal, champion,
}: {
  series: Series | null; allGames: Game[];
  teamLogos: Record<string, string>; roundLabel: string; isFinal?: boolean;
  champion?: string | null;
}) {
  const hasTeams = !!(series?.team_a?.trim()) && !!(series?.team_b?.trim());

  /* ── Placeholder ── */
  if (!series || !hasTeams) {
    const lA = series?.team_a_label ? parseLabel(series.team_a_label) : null;
    const lB = series?.team_b_label ? parseLabel(series.team_b_label) : null;
    return (
      <div className={`rounded-2xl border overflow-hidden
        ${isFinal ? 'border-yellow-400/20 bg-[#0f1c2a]' : 'border-white/[0.08] bg-[#0c1825]'}`}>
        <div className={`flex items-center justify-between px-4 py-2.5 border-b
          ${isFinal ? 'border-yellow-400/10' : 'border-white/[0.05]'}`}>
          <div className="flex items-center gap-2">
            {isFinal && (
            <span className="inline-flex h-5 w-5 shrink-0 rounded-full border border-yellow-400/60 items-center justify-center"
              style={{ background: 'radial-gradient(circle at 38% 35%, #e8e8e8, #a0a0a0)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
              <span className="text-[7px]">🏀</span>
            </span>
          )}
            <span className={`text-[11px] font-black tracking-widest uppercase
              ${isFinal ? 'text-yellow-400' : 'text-[#4a6a8a]'}`}>{roundLabel}</span>
            {series && <span className="text-[10px] text-[#2a4a6a] font-semibold">· סדרה {series.series_number}</span>}
          </div>
          <span className="rounded-full bg-white/[0.04] border border-white/[0.07] px-2.5 py-0.5 text-[10px] font-black text-[#3a5a7a]">
            טרם נקבע
          </span>
        </div>
        {isFinal && (
          <div className="py-6 flex justify-center border-b border-yellow-400/10">
            <ChampionReveal champion={champion ?? null} season="2025–2026" />
          </div>
        )}
        <div className="px-4 sm:px-6 py-5 flex items-center gap-2 sm:gap-4">
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-11 w-11 rounded-full bg-[#1a2e45] border-2 border-white/[0.07] flex items-center justify-center text-[#2a4a6a] text-lg font-black">?</div>
            {lA && <p className="text-[10px] text-[#1e3a5f] text-center">{lA.full}</p>}
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-4xl sm:text-5xl font-black text-[#1a2e45] tabular-nums leading-none">–</span>
              <span className="text-lg text-[#1a2e45] font-black leading-none">:</span>
              <span className="text-4xl sm:text-5xl font-black text-[#1a2e45] tabular-nums leading-none">–</span>
            </div>
            {!isFinal && <p className="text-[9px] text-[#1e3a5f] tracking-widest uppercase font-bold mt-0.5">הטוב מ-3</p>}
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-11 w-11 rounded-full bg-[#1a2e45] border-2 border-white/[0.07] flex items-center justify-center text-[#2a4a6a] text-lg font-black">?</div>
            {lB && <p className="text-[10px] text-[#1e3a5f] text-center">{lB.full}</p>}
          </div>
        </div>
      </div>
    );
  }

  const { winsA, winsB, winner } = seriesScore(series, allGames);
  const aWon    = winner === series.team_a;
  const bWon    = winner === series.team_b;
  const started = winsA > 0 || winsB > 0;
  const lA      = parseLabel(series.team_a_label);
  const lB      = parseLabel(series.team_b_label);

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-lg
      ${isFinal
        ? 'border-orange-500/30 shadow-[0_0_40px_rgba(255,121,56,0.1)] bg-gradient-to-br from-[#0f1e2e] via-[#0c1825] to-[#0f2030]'
        : 'border-white/[0.07] bg-gradient-to-br from-[#0c1825] to-[#0b1520]'}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b
        ${isFinal ? 'border-orange-500/15 bg-orange-500/[0.05]' : 'border-white/[0.05]'}`}>
        <div className="flex items-center gap-2">
          {isFinal && (
            <span className="inline-flex h-5 w-5 shrink-0 rounded-full border border-yellow-400/60 items-center justify-center"
              style={{ background: 'radial-gradient(circle at 38% 35%, #e8e8e8, #a0a0a0)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
              <span className="text-[7px]">🏀</span>
            </span>
          )}
          <span className={`text-[11px] font-black tracking-widest uppercase
            ${isFinal ? 'text-yellow-400' : 'text-[#4a6a8a]'}`}>{roundLabel}</span>
          <span className="text-[10px] text-[#2a4a6a] font-semibold">· סדרה {series.series_number}</span>
        </div>
        <StatusBadge winsA={winsA} winsB={winsB} winner={winner} teamA={series.team_a} teamB={series.team_b} />
      </div>

      {/* Championship Plate for final */}
      {isFinal && (
        <div className="py-6 flex justify-center border-b border-orange-500/10">
          <ChampionReveal champion={champion ?? null} season="2025–2026" />
        </div>
      )}

      {/* Scoreboard */}
      <div className="px-4 sm:px-6 py-5 flex items-center gap-2 sm:gap-4">
        {/* Team A */}
        <div className={`flex-1 flex flex-col items-center gap-2 transition-opacity ${bWon ? 'opacity-35' : ''}`}>
          <TeamLogo name={series.team_a} logos={teamLogos} size="md" />
          <div className="text-center">
            <p className={`text-sm font-black leading-tight ${aWon ? 'text-orange-400' : 'text-white'}`}>
              {series.team_a}
            </p>
            <p className="text-[10px] text-[#4a6a8a] mt-0.5 font-semibold">{lA.full}</p>
          </div>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`text-4xl sm:text-5xl font-black tabular-nums leading-none
              ${aWon ? 'text-orange-400' : started ? 'text-white' : 'text-[#1e3a5f]'}`}>
              {started ? winsA : '–'}
            </span>
            <span className="text-lg text-[#1e3a5f] font-black leading-none">:</span>
            <span className={`text-4xl sm:text-5xl font-black tabular-nums leading-none
              ${bWon ? 'text-orange-400' : started ? 'text-white' : 'text-[#1e3a5f]'}`}>
              {started ? winsB : '–'}
            </span>
          </div>
          {!isFinal && (
            <p className="text-[9px] text-[#2a4a6a] tracking-widest uppercase font-bold mt-0.5">
              {started ? 'ניצחונות' : 'הטוב מ-3'}
            </p>
          )}
          <GameDots series={series} allGames={allGames} />
        </div>

        {/* Team B */}
        <div className={`flex-1 flex flex-col items-center gap-2 transition-opacity ${aWon ? 'opacity-35' : ''}`}>
          <TeamLogo name={series.team_b} logos={teamLogos} size="md" />
          <div className="text-center">
            <p className={`text-sm font-black leading-tight ${bWon ? 'text-orange-400' : 'text-white'}`}>
              {series.team_b}
            </p>
            <p className="text-[10px] text-[#4a6a8a] mt-0.5 font-semibold">{lB.full}</p>
          </div>
        </div>
      </div>

      {/* Winner strip */}
      {winner && (
        <div className="border-t border-green-500/15 bg-green-500/[0.05] px-4 py-2 text-center">
          <span className="text-[11px] font-black text-green-400">🏆 {winner} ניצחו בסדרה</span>
        </div>
      )}
    </div>
  );
}

/* ── Logo URL ───────────────────────────────────────────────────────────── */
async function getLogoUrl() {
  try {
    const { data } = await supabaseAdmin.from('league_settings').select('value').eq('key', 'league_logo_url').maybeSingle();
    return data?.value ?? '/logo.png';
  } catch { return '/logo.png'; }
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default async function PlayoffPage() {
  const [
    { data: seriesData },
    { data: gamesData },
    { data: teamsData },
    { data: standingsData },
    logoUrl,
  ] = await Promise.all([
    supabaseAdmin.from('playoff_series').select('*').order('series_number'),
    supabaseAdmin.from('playoff_games').select('*').order('series_number').order('game_number'),
    supabaseAdmin.from('teams').select('name, logo_url'),
    supabaseAdmin.from('standings').select('name, rank, division').order('rank', { ascending: true }),
    getLogoUrl(),
  ]);

  const allGames: Game[] = (gamesData ?? []) as Game[];

  /* ── Build logos map ── */
  const teamLogos: Record<string, string> = {};
  for (const t of teamsData ?? []) {
    if (t.name && t.logo_url) teamLogos[t.name] = t.logo_url;
  }

  /* ── Build standings lookup: division → rank → name ── */
  const allStandings: StandingRow[] = (standingsData?.length
    ? standingsData
    : [
        ...NORTH_TABLE.map(t => ({ rank: t.rank, name: t.name, division: 'North' })),
        ...SOUTH_TABLE.map(t => ({ rank: t.rank, name: t.name, division: 'South' })),
      ]
  ) as StandingRow[];

  /* ── Resolve a team from a label like "🟠 דרום #1" using live standings ── */
  function resolveFromLabel(label: string): string {
    if (!label) return '';
    const isNorth = label.includes('צפון');
    const isSouth = label.includes('דרום');
    if (!isNorth && !isSouth) return '';
    const m = label.match(/#(\d+)/);
    if (!m) return '';
    const rank = parseInt(m[1]);
    const div  = isNorth ? 'North' : 'South';
    return allStandings.find(s => s.division === div && s.rank === rank)?.name ?? '';
  }

  /* ── Base series: DB data or virtual bracket ── */
  const baseSeries: Series[] = ((seriesData ?? []) as Series[]).length > 0
    ? (seriesData as Series[])
    : VIRTUAL_SERIES;

  /* ── Pass 1: fill QF team names from live standings ── */
  const pass1 = baseSeries.map(sr => ({
    ...sr,
    team_a: sr.team_a?.trim() || resolveFromLabel(sr.team_a_label),
    team_b: sr.team_b?.trim() || resolveFromLabel(sr.team_b_label),
  }));

  /* ── Helper: get winner of a series (from pass1 data) ── */
  function winnerOf(seriesNum: number, resolved: Series[]): string {
    const sr = resolved.find(s => s.series_number === seriesNum);
    if (!sr?.team_a || !sr?.team_b) return '';
    return seriesScore(sr, allGames).winner ?? '';
  }

  /* ── Pass 2: fill SF teams from QF winners, Final from SF winners ── */
  const resolvedSeries = pass1.map(sr => {
    if (sr.team_a?.trim() && sr.team_b?.trim()) return sr;
    const feed = SERIES_FEED[sr.series_number];
    if (!feed) return sr;
    const [feedA, feedB] = feed;
    // For final (s7), feeders are s5/s6 which are in pass1 still resolving — handle below
    return {
      ...sr,
      team_a: sr.team_a?.trim() || winnerOf(feedA, pass1),
      team_b: sr.team_b?.trim() || winnerOf(feedB, pass1),
    };
  });

  /* ── Pass 3: Final (s7) needs SF winners from pass2 ── */
  const allSeries = resolvedSeries.map(sr => {
    if (sr.series_number !== 7) return sr;
    if (sr.team_a?.trim() && sr.team_b?.trim()) return sr;
    return {
      ...sr,
      team_a: sr.team_a?.trim() || winnerOf(5, resolvedSeries),
      team_b: sr.team_b?.trim() || winnerOf(6, resolvedSeries),
    };
  });

  const s  = (n: number) => allSeries.find(s => s.series_number === n) ?? null;
  const s1 = s(1), s2 = s(2), s3 = s(3), s4 = s(4);
  const s5 = s(5), s6 = s(6), s7 = s(7);

  const champion = s7?.team_a && s7?.team_b ? seriesScore(s7, allGames).winner : null;

  const rounds = [
    { label: 'רבע גמר', series: [s1, s2, s3, s4], cols: 'sm:grid-cols-2', isFinal: false },
    { label: 'חצי גמר', series: [s5, s6],          cols: 'sm:grid-cols-2', isFinal: false },
    { label: 'גמר',      series: [s7],              cols: 'sm:grid-cols-1 max-w-3xl mx-auto', isFinal: true },
  ];

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="ליגת ליבי" className="h-12 w-12 object-contain rounded-full" />
          <h1 className="text-3xl font-black text-white">🏆 פלייאוף ליגת ליבי</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="ליגת ליבי" className="h-12 w-12 object-contain rounded-full" />
        </div>
        <p className="text-sm text-[#5a7a9a]">2025–2026 · רבע גמר וחצי גמר: הטוב מ-3 · גמר: משחק אחד</p>
      </div>

      <div className="space-y-10">
        {/* ── Rounds ──────────────────────────────────────────────────────── */}
        {rounds.map(round => (
          <section key={round.label}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`rounded-2xl border px-4 py-1.5 text-sm font-black tracking-wide
                ${round.isFinal
                  ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400'
                  : 'border-white/[0.08] bg-white/[0.03] text-[#7aaac8]'}`}>
                {round.isFinal && (
                  <span className="inline-flex h-5 w-5 shrink-0 rounded-full border border-yellow-400/60 items-center justify-center mr-1"
                    style={{ background: 'radial-gradient(circle at 38% 35%, #e8e8e8, #a0a0a0)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
                    <span className="text-[7px] font-black" style={{ color: '#3a2a00' }}>🏀</span>
                  </span>
                )}
                {round.label}
              </div>
              <div className="h-px flex-1 bg-white/[0.04]" />
            </div>

            <div className={`grid grid-cols-1 gap-4 ${round.cols}`}>
              {round.series.map((sr, i) => (
                <Link key={i} href={sr ? `/playoff/series/${sr.series_number}` : '#'} className="block transition hover:scale-[1.01]">
                  <ScoreboardCard
                    series={sr}
                    allGames={allGames}
                    teamLogos={teamLogos}
                    roundLabel={round.label}
                    isFinal={round.isFinal}
                    champion={round.isFinal ? champion : undefined}
                  />
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* ── Champion banner ──────────────────────────────────────────────── */}
        {champion && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-yellow-400/40
            bg-gradient-to-b from-yellow-400/10 to-transparent p-10
            shadow-[0_0_80px_rgba(250,204,21,0.15)] max-w-lg mx-auto">
            <ChampionshipPlate year="2025–2026" />
            <TeamLogo name={champion} logos={teamLogos} size="lg" />
            <p className="text-[11px] font-black uppercase tracking-[3px] text-[#a08020]">
              אלוף הפלייאוף 2025–2026
            </p>
            <p className="text-3xl font-black text-yellow-400 text-center">{champion}</p>
          </div>
        )}

      </div>
    </>
  );
}
