export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Series {
  series_number: number;
  team_a: string;
  team_a_label: string;
  team_b: string;
  team_b_label: string;
}
interface Game {
  series_number: number;
  game_number: number;
  home_score: number | null;
  away_score: number | null;
  played: boolean;
  game_date: string | null;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function homeForGame(s: Series, gNum: number) {
  return gNum === 2 ? s.team_b : s.team_a;
}

function seriesScore(s: Series, games: Game[]) {
  let winsA = 0, winsB = 0;
  for (const g of games.filter(g => g.series_number === s.series_number && g.played)) {
    const home   = homeForGame(s, g.game_number);
    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
    if ((homeWon && home === s.team_a) || (!homeWon && home !== s.team_a)) winsA++;
    else winsB++;
  }
  const winner = winsA >= 2 ? s.team_a : winsB >= 2 ? s.team_b : null;
  return { winsA, winsB, winner };
}

/* ── Bracket card ───────────────────────────────────────────────────────── */
function MatchCard({
  series, allGames, alignStart,
}: { series: Series | null; allGames: Game[]; alignStart?: boolean }) {

  if (!series) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: alignStart ? 'flex-start' : 'flex-end', gap: 5 }}>
        <div className="po-card po-card-tbd">
          <div className="po-row po-tbd"><span className="po-seed">SF</span><span className="po-tname">ממתין לנצח</span><span className="po-wnum">—</span></div>
          <div className="po-row po-tbd"><span className="po-seed">SF</span><span className="po-tname">ממתין לנצח</span><span className="po-wnum">—</span></div>
        </div>
        <span className="po-chip po-pend">⏳ ממתין</span>
        <div className="po-dots"><div className="po-dot po-open" /><div className="po-dot po-open" /><div className="po-dot po-open" /></div>
      </div>
    );
  }

  const { winsA, winsB, winner } = seriesScore(series, allGames);
  const hasTeams = !!(series.team_a && series.team_b);
  const seriesGames = allGames.filter(g => g.series_number === series.series_number);
  const isDone   = !!winner;
  const isLive   = !isDone && (winsA + winsB) > 0;
  const scoreStr = `${winsA}–${winsB}`;

  const rowA = !hasTeams ? 'po-tbd' : (winsA > 0 ? 'po-win' : isDone ? 'po-lose' : 'po-tbd');
  const rowB = !hasTeams ? 'po-tbd' : (winsB > 0 ? 'po-win' : isDone ? 'po-lose' : 'po-tbd');

  const dots = [1, 2, 3].map(gNum => {
    const g = seriesGames.find(g => g.game_number === gNum);
    if (!g?.played) return 'po-open';
    const home    = homeForGame(series, gNum);
    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
    const aWon    = (homeWon && home === series.team_a) || (!homeWon && home !== series.team_a);
    return aWon ? 'po-won' : 'po-lost';
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: alignStart ? 'flex-start' : 'flex-end', gap: 5 }}>
      <div className={`po-card${!hasTeams ? ' po-card-tbd' : ''}`}>
        <div className={`po-row ${rowA}`}>
          <span className="po-seed">{series.team_a_label || 'A'}</span>
          <span className="po-tname">{hasTeams ? series.team_a : '— ממתין לנצח'}</span>
          <span className="po-wnum">{hasTeams ? winsA : '—'}</span>
        </div>
        <div className={`po-row ${rowB}`}>
          <span className="po-seed">{series.team_b_label || 'B'}</span>
          <span className="po-tname">{hasTeams ? series.team_b : '— ממתין לנצח'}</span>
          <span className="po-wnum">{hasTeams ? winsB : '—'}</span>
        </div>
      </div>
      {isDone  && <span className="po-chip po-done">✓ {scoreStr}</span>}
      {isLive  && <span className="po-chip po-live"><span className="po-live-dot" />{scoreStr}</span>}
      {!isDone && !isLive && <span className="po-chip po-pend">⏳ {hasTeams ? 'טרם החל' : 'ממתין'}</span>}
      <div className="po-dots">{dots.map((d, i) => <div key={i} className={`po-dot ${d}`} />)}</div>
    </div>
  );
}

/* ── Detail card ────────────────────────────────────────────────────────── */
function DetailCard({ series, allGames }: { series: Series | null; allGames: Game[] }) {
  if (!series) return null;
  const { winsA, winsB } = seriesScore(series, allGames);
  const hasTeams   = !!(series.team_a && series.team_b);
  const seriesGames = allGames.filter(g => g.series_number === series.series_number);
  const seriesOver = winsA >= 2 || winsB >= 2;

  return (
    <div className="po-detail" style={{ opacity: hasTeams ? 1 : 0.45 }}>
      <div className="po-detail-title">
        סדרה {series.series_number}
        {hasTeams
          ? ` · ${series.team_a_label} ${series.team_a} נגד ${series.team_b_label} ${series.team_b}`
          : ` · ${series.team_a_label || '—'} נגד ${series.team_b_label || '—'}`}
      </div>
      <div className="po-gpills">
        {[1, 2, 3].map(gNum => {
          const g      = seriesGames.find(g => g.game_number === gNum);
          const isG3   = gNum === 3;
          let cls      = 'po-gpe';
          let score    = '—';
          let loc      = 'ממתין';

          if (g?.played && g.home_score !== null && g.away_score !== null) {
            const home    = homeForGame(series, gNum);
            const homeWon = g.home_score > g.away_score;
            cls   = homeWon ? 'po-gwh' : 'po-gwa';
            score = `${g.home_score}–${g.away_score}`;
            loc   = `ב${home}`;
          } else if (isG3 && seriesOver) {
            loc = 'לא נדרש';
          } else if (g?.game_date) {
            loc = g.game_date.slice(5, 10).replace('-', '/');
          }

          return (
            <div key={gNum} className={`po-gpill ${cls}`}>
              <span className="po-gn">משחק {gNum}</span>
              <span className="po-gs">{score}</span>
              <span className="po-gw">{loc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default async function PlayoffPage() {
  const [{ data: seriesData }, { data: gamesData }] = await Promise.all([
    supabaseAdmin.from('playoff_series').select('*').order('series_number'),
    supabaseAdmin.from('playoff_games').select('*').order('series_number').order('game_number'),
  ]);

  const allSeries: Series[] = (seriesData ?? []) as Series[];
  const allGames:  Game[]   = (gamesData  ?? []) as Game[];

  const s = (n: number) => allSeries.find(s => s.series_number === n) ?? null;
  const s1 = s(1), s2 = s(2), s3 = s(3), s4 = s(4);

  return (
    <>
      {/* ── Bracket CSS ─────────────────────────────────────────────────── */}
      <style>{`
        /* Card */
        .po-card {
          width: 158px; border-radius: 12px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08); background: #0f1e2e;
          box-shadow: 0 4px 20px rgba(0,0,0,0.35); direction: rtl;
        }
        .po-card-tbd { border-color: rgba(255,255,255,0.04); opacity: 0.72; }
        /* Team rows */
        .po-row {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); min-height: 40px;
        }
        .po-row:last-child { border-bottom: none; }
        .po-win  { background: rgba(249,115,22,0.1); }
        .po-lose { background: transparent; }
        .po-tbd  { background: rgba(255,255,255,0.015); }
        .po-seed {
          font-size: 8px; font-weight: 800; color: #3a5a7a;
          background: rgba(255,255,255,0.05); border-radius: 4px;
          padding: 2px 4px; white-space: nowrap; flex-shrink: 0;
        }
        .po-tname {
          flex: 1; font-size: 0.8rem; font-weight: 700;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .po-win  .po-tname { color: #fff; }
        .po-lose .po-tname { color: #4a6a8a; }
        .po-tbd  .po-tname { color: #2a4a6a; font-style: italic; }
        .po-wnum { font-size: 1.1rem; font-weight: 900; min-width: 22px; text-align: center; }
        .po-win  .po-wnum { color: #f97316; }
        .po-lose .po-wnum { color: #1e3a5f; }
        .po-tbd  .po-wnum { color: #1a2a3a; }
        /* Chips */
        .po-chip {
          display: inline-flex; align-items: center; gap: 4px;
          border-radius: 999px; padding: 2px 8px;
          font-size: 9px; font-weight: 800; white-space: nowrap;
        }
        .po-done { background: rgba(34,197,94,0.1);   border: 1px solid rgba(34,197,94,0.2);   color: #22c55e; }
        .po-live { background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.25); color: #f97316; }
        .po-pend { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); color: #2a4a6a; }
        .po-live-dot { width:5px; height:5px; border-radius:50%; background:#f97316; animation:po-pulse 1.2s infinite; display:inline-block; }
        @keyframes po-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        /* Game dots */
        .po-dots { display: flex; gap: 3px; justify-content: center; margin-top: 2px; }
        .po-dot { width: 8px; height: 8px; border-radius: 50%; }
        .po-won  { background: #f97316; box-shadow: 0 0 5px rgba(249,115,22,0.5); }
        .po-lost { background: #1e3a5f; }
        .po-open { background: transparent; border: 1px solid #1e3a5f; }
        /* Bracket connectors */
        .po-arm {
          position: relative; width: 38px; height: 200px; flex-shrink: 0;
        }
        .po-arm-v { position: absolute; width: 2px; background: #1e3a5f; }
        .po-arm-h { position: absolute; height: 2px; background: #1e3a5f; }
        .po-hconn { width: 36px; height: 2px; background: #1e3a5f; flex-shrink: 0; align-self: center; }
        /* Round label */
        .po-round-lbl {
          text-align: center; margin-bottom: 10px;
          font-size: 9px; font-weight: 800; letter-spacing: 1.5px;
          text-transform: uppercase; color: #2a4a6a;
        }
        /* Detail cards */
        .po-detail {
          border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);
          background: #0f1e2e; padding: 12px 14px; direction: rtl;
        }
        .po-detail-title { font-size: 10px; font-weight: 800; color: #3a5a7a; letter-spacing: 1px; margin-bottom: 8px; }
        .po-gpills { display: flex; gap: 5px; }
        .po-gpill { flex:1; border-radius:7px; padding:5px 3px; text-align:center; font-size:9px; font-weight:700; }
        .po-gwh { background:rgba(249,115,22,0.1); border:1px solid rgba(249,115,22,0.2); color:#f97316; }
        .po-gwa { background:rgba(99,179,237,0.08); border:1px solid rgba(99,179,237,0.15); color:#63b3ed; }
        .po-gpe { background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.06); color:#1e3a5f; }
        .po-gn { font-size:7px; opacity:0.6; display:block; }
        .po-gs { font-size:10px; font-weight:900; }
        .po-gw { font-size:7px; opacity:0.45; display:block; }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-white">🏆 פלייאוף ליגת ליבי</h1>
        <p className="mt-1 text-sm text-[#5a7a9a]">2025–2026 · מיטב מ-3 משחקים · חצי גמר</p>
      </div>

      {allSeries.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] py-20 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <p className="text-[#5a7a9a]">פלייאוף טרם הוגדר</p>
          <p className="text-xs text-[#3a5a7a] mt-1">נא לחכות לפתיחת שלב הפלייאוף</p>
        </div>
      ) : (
        <>
          {/* ── Section labels ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 880, margin: '0 auto 8px', padding: '0 16px', direction: 'ltr' }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '3px 12px', borderRadius: 999, background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.2)', color: '#63b3ed' }}>
              🔵 צפון נגד דרום
            </span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '3px 12px', borderRadius: 999, background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', color: '#fbbf24' }}>
              🏆 גמר
            </span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '3px 12px', borderRadius: 999, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', color: '#f97316' }}>
              🟠 דרום נגד צפון
            </span>
          </div>

          {/* ── Bracket ────────────────────────────────────────────────── */}
          <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'ltr', minWidth: 860, gap: 0, padding: '20px 16px' }}>

              {/* ██ LEFT QF — S3 & S4 (צפון נגד דרום) ██ */}
              <div>
                <div className="po-round-lbl">רבע גמר</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
                  <MatchCard series={s3} allGames={allGames} alignStart={false} />
                  <MatchCard series={s4} allGames={allGames} alignStart={false} />
                </div>
              </div>

              {/* ██ LEFT CONNECTOR ██ */}
              <div className="po-arm">
                <div className="po-arm-h" style={{ top: 44, left: 0, right: 8 }} />
                <div className="po-arm-h" style={{ top: 154, left: 0, right: 8 }} />
                <div className="po-arm-v" style={{ top: 44, left: 30, height: 112 }} />
                <div className="po-arm-h" style={{ top: 99, left: 30, right: 0 }} />
              </div>

              {/* ██ LEFT SF ██ */}
              <div>
                <div className="po-round-lbl">חצי גמר</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div className="po-card po-card-tbd">
                    <div className="po-row po-tbd"><span className="po-seed">SF</span><span className="po-tname">ממתין לנצח</span><span className="po-wnum">—</span></div>
                    <div className="po-row po-tbd"><span className="po-seed">SF</span><span className="po-tname">ממתין לנצח</span><span className="po-wnum">—</span></div>
                  </div>
                  <span className="po-chip po-pend">⏳ טרם החל</span>
                </div>
              </div>

              {/* ██ SF → FINAL LEFT CONNECTOR ██ */}
              <div className="po-hconn" />

              {/* ██ FINAL ██ */}
              <div>
                <div className="po-round-lbl" style={{ color: '#a08020' }}>גמר</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div className="po-card" style={{ borderColor: 'rgba(250,204,21,0.25)', background: 'linear-gradient(135deg,#0f1e2e,#1a2a1a)', boxShadow: '0 0 30px rgba(250,204,21,0.08)' }}>
                    <div className="po-row po-tbd"><span className="po-seed" style={{ color: '#a08020' }}>🏆</span><span className="po-tname" style={{ color: '#5a7a2a' }}>ממתין לנצח</span><span className="po-wnum" style={{ color: '#1a2a1a' }}>—</span></div>
                    <div className="po-row po-tbd"><span className="po-seed" style={{ color: '#a08020' }}>🏆</span><span className="po-tname" style={{ color: '#5a7a2a' }}>ממתין לנצח</span><span className="po-wnum" style={{ color: '#1a2a1a' }}>—</span></div>
                  </div>
                  <span className="po-chip" style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.2)', color: '#fbbf24' }}>🏆 גמר</span>
                </div>
              </div>

              {/* ██ SF → FINAL RIGHT CONNECTOR ██ */}
              <div className="po-hconn" />

              {/* ██ RIGHT SF ██ */}
              <div>
                <div className="po-round-lbl">חצי גמר</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div className="po-card po-card-tbd">
                    <div className="po-row po-tbd"><span className="po-seed">SF</span><span className="po-tname">ממתין לנצח</span><span className="po-wnum">—</span></div>
                    <div className="po-row po-tbd"><span className="po-seed">SF</span><span className="po-tname">ממתין לנצח</span><span className="po-wnum">—</span></div>
                  </div>
                  <span className="po-chip po-pend">⏳ טרם החל</span>
                </div>
              </div>

              {/* ██ RIGHT CONNECTOR ██ */}
              <div className="po-arm">
                <div className="po-arm-h" style={{ top: 99, left: 0, right: 30 }} />
                <div className="po-arm-v" style={{ top: 44, right: 30, height: 112 }} />
                <div className="po-arm-h" style={{ top: 44, left: 8, right: 0 }} />
                <div className="po-arm-h" style={{ top: 154, left: 8, right: 0 }} />
              </div>

              {/* ██ RIGHT QF — S1 & S2 (דרום נגד צפון) ██ */}
              <div>
                <div className="po-round-lbl">רבע גמר</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
                  <MatchCard series={s1} allGames={allGames} alignStart={true} />
                  <MatchCard series={s2} allGames={allGames} alignStart={true} />
                </div>
              </div>

            </div>
          </div>

          {/* ── Game details below bracket ──────────────────────────────── */}
          <div style={{ maxWidth: 860, margin: '28px auto 0', padding: '0 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '1.5px', color: '#2a4a6a', textAlign: 'center', marginBottom: 12, textTransform: 'uppercase' }}>
              פירוט תוצאות
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, direction: 'rtl' }}>
              <DetailCard series={s1} allGames={allGames} />
              <DetailCard series={s2} allGames={allGames} />
              <DetailCard series={s3} allGames={allGames} />
              <DetailCard series={s4} allGames={allGames} />
            </div>
          </div>

          {/* ── Home advantage note ─────────────────────────────────────── */}
          <div className="mt-8 rounded-xl border border-[#1e3a5f] bg-[#0a1628]/60 px-4 py-3 text-xs text-[#5a7a9a] text-right" style={{ maxWidth: 860, margin: '24px auto 0' }}>
            <span className="font-bold text-[#8aaac8]">כלל הבית:</span> הקבוצה המדורגת גבוה יותר מארחת את משחק 1 ומשחק 3. הקבוצה המדורגת נמוך יותר מארחת את משחק 2.
          </div>
        </>
      )}
    </>
  );
}
