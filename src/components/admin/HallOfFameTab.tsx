'use client';

import { useState } from 'react';

type Season = {
  id: string;
  year: string;
  champion_name: string | null;
  champion_captain: string | null;
  mvp_name: string | null;
  mvp_stats: string | null;
};

type Record = {
  id: string;
  title: string;
  holder: string | null;
  value: string | null;
};

export default function HallOfFameTab({
  seasons: initialSeasons,
  records: initialRecords,
}: {
  seasons: Season[];
  records: Record[];
}) {
  /* ── Seasons state ── */
  const [seasons, setSeasons] = useState<Season[]>(initialSeasons);
  const [sYear, setSYear] = useState('');
  const [sChampion, setSChampion] = useState('');
  const [sCaptain, setSCaptain] = useState('');
  const [sMvpName, setSMvpName] = useState('');
  const [sMvpStats, setSMvpStats] = useState('');
  const [sAdding, setSAdding] = useState(false);
  const [sDeleting, setSDeleting] = useState<string | null>(null);
  const [sMsg, setSMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dbReady, setDbReady] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupMsg, setSetupMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* ── Records state ── */
  const [records, setRecords] = useState<Record[]>(initialRecords);
  const [rTitle, setRTitle] = useState('');
  const [rHolder, setRHolder] = useState('');
  const [rValue, setRValue] = useState('');
  const [rAdding, setRAdding] = useState(false);
  const [rDeleting, setRDeleting] = useState<string | null>(null);
  const [rMsg, setRMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* ── One-time DB setup ── */
  async function handleSetup() {
    setSetupLoading(true); setSetupMsg(null);
    try {
      const res = await fetch('/api/admin/hall-of-fame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'setup', action: 'init' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'שגיאה');
      setDbReady(true);
      setSetupMsg({ ok: true, text: '✅ הטבלאות נוצרו בהצלחה — תוכל להוסיף נתונים עכשיו' });
    } catch (err: unknown) {
      setSetupMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally { setSetupLoading(false); }
  }

  /* ── Add season ── */
  async function handleAddSeason(e: React.FormEvent) {
    e.preventDefault();
    if (!sYear.trim()) return;
    setSAdding(true); setSMsg(null);
    try {
      const res = await fetch('/api/admin/hall-of-fame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'season', action: 'add',
          year: sYear.trim(),
          champion_name: sChampion.trim() || null,
          champion_captain: sCaptain.trim() || null,
          mvp_name: sMvpName.trim() || null,
          mvp_stats: sMvpStats.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if ((json.error ?? '').includes('league_history')) setDbReady(false);
        throw new Error(json.error ?? 'שגיאה');
      }
      setSMsg({ ok: true, text: '✅ עונה נוספה' });
      setSYear(''); setSChampion(''); setSCaptain(''); setSMvpName(''); setSMvpStats('');
      // reload from server by adding a placeholder until next navigation
      setSeasons(prev => [...prev, {
        id: Date.now().toString(),
        year: sYear.trim(),
        champion_name: sChampion.trim() || null,
        champion_captain: sCaptain.trim() || null,
        mvp_name: sMvpName.trim() || null,
        mvp_stats: sMvpStats.trim() || null,
      }]);
    } catch (err: unknown) {
      setSMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally { setSAdding(false); }
  }

  /* ── Delete season ── */
  async function handleDeleteSeason(id: string) {
    if (!confirm('למחוק עונה זו?')) return;
    setSDeleting(id);
    try {
      const res = await fetch('/api/admin/hall-of-fame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'season', action: 'delete', id }),
      });
      if (!res.ok) throw new Error('מחיקה נכשלה');
      setSeasons(prev => prev.filter(s => s.id !== id));
    } catch (err: unknown) {
      setSMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally { setSDeleting(null); }
  }

  /* ── Add record ── */
  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!rTitle.trim()) return;
    setRAdding(true); setRMsg(null);
    try {
      const res = await fetch('/api/admin/hall-of-fame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'record', action: 'add',
          title: rTitle.trim(),
          holder: rHolder.trim() || null,
          value: rValue.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if ((json.error ?? '').includes('league_history')) setDbReady(false);
        throw new Error(json.error ?? 'שגיאה');
      }
      setRMsg({ ok: true, text: '✅ שיא נוסף' });
      setRecords(prev => [...prev, {
        id: Date.now().toString(),
        title: rTitle.trim(),
        holder: rHolder.trim() || null,
        value: rValue.trim() || null,
      }]);
      setRTitle(''); setRHolder(''); setRValue('');
    } catch (err: unknown) {
      setRMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally { setRAdding(false); }
  }

  /* ── Delete record ── */
  async function handleDeleteRecord(id: string) {
    if (!confirm('למחוק שיא זה?')) return;
    setRDeleting(id);
    try {
      const res = await fetch('/api/admin/hall-of-fame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'record', action: 'delete', id }),
      });
      if (!res.ok) throw new Error('מחיקה נכשלה');
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err: unknown) {
      setRMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally { setRDeleting(null); }
  }

  const inputCls = 'w-full rounded-lg border border-white/[0.10] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder-white/30 focus:border-orange-500 focus:outline-none';
  const labelCls = 'mb-1 block text-xs text-[#5a7a9a]';

  return (
    <div dir="rtl" className="space-y-10">
      <div>
        <h2 className="text-xl font-bold text-white">היכל התהילה</h2>
        <p className="text-sm text-[#5a7a9a]">ניהול אלופות ושיאי הליגה</p>
      </div>

      {/* ── DB setup banner (shown when tables are missing) ── */}
      {!dbReady && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 space-y-3">
          <p className="font-bold text-yellow-300 text-sm">⚠️ הטבלאות עדיין לא נוצרו במסד הנתונים</p>
          <p className="text-xs text-yellow-400/70">לחץ על הכפתור להלן ליצירת הטבלאות אוטומטית בסופאבייס:</p>
          {setupMsg && (
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${setupMsg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
              {setupMsg.text}
            </p>
          )}
          <button
            onClick={handleSetup}
            disabled={setupLoading}
            className="rounded-lg bg-yellow-500 px-5 py-2 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:opacity-50"
          >
            {setupLoading ? '⏳ יוצר טבלאות...' : '🛠️ צור טבלאות עכשיו'}
          </button>
        </div>
      )}

      {/* ── Seasons section ── */}
      <div className="border border-white/[0.07] bg-white/[0.04] rounded-2xl p-6 space-y-6">
        <h3 className="font-bold text-orange-400 text-base">🏆 אלופות הליגה ({seasons.length})</h3>

        {/* Add season form */}
        <form onSubmit={handleAddSeason} className="space-y-4 border border-white/[0.06] rounded-xl p-4 bg-white/[0.02]">
          <p className="text-sm font-semibold text-white/70">➕ הוסף עונה</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelCls}>עונה *</label>
              <input value={sYear} onChange={e => setSYear(e.target.value)} placeholder="2024-2025" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>שם האלופה</label>
              <input value={sChampion} onChange={e => setSChampion(e.target.value)} placeholder="שם הקבוצה" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>קפטן</label>
              <input value={sCaptain} onChange={e => setSCaptain(e.target.value)} placeholder="שם הקפטן" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>MVP</label>
              <input value={sMvpName} onChange={e => setSMvpName(e.target.value)} placeholder="שם השחקן" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>סטטיסטיקת MVP</label>
              <input value={sMvpStats} onChange={e => setSMvpStats(e.target.value)} placeholder="24.5 PPG" className={inputCls} />
            </div>
          </div>

          {sMsg && (
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${sMsg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
              {sMsg.text}
            </p>
          )}

          <button type="submit" disabled={sAdding}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-orange-400 disabled:opacity-50">
            {sAdding ? 'שומר...' : 'הוסף עונה'}
          </button>
        </form>

        {/* Seasons list */}
        {seasons.length === 0 ? (
          <p className="text-center text-[#3a5a7a] py-6 text-sm">אין עונות עדיין</p>
        ) : (
          <div className="space-y-3">
            {seasons.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-orange-400 text-sm">{s.year}</span>
                    {s.champion_name && <span className="text-white text-sm font-medium">{s.champion_name}</span>}
                    {s.champion_captain && <span className="text-[#5a7a9a] text-xs">קפטן: {s.champion_captain}</span>}
                  </div>
                  {(s.mvp_name || s.mvp_stats) && (
                    <p className="text-xs text-[#5a7a9a] mt-0.5">
                      MVP: {s.mvp_name ?? '—'} {s.mvp_stats ? `· ${s.mvp_stats}` : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteSeason(s.id)}
                  disabled={sDeleting === s.id}
                  className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition disabled:opacity-40 shrink-0"
                >
                  {sDeleting === s.id ? '⏳' : '🗑 מחק'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Records section ── */}
      <div className="border border-white/[0.07] bg-white/[0.04] rounded-2xl p-6 space-y-6">
        <h3 className="font-bold text-orange-400 text-base">📊 שיאי כל הזמנים ({records.length})</h3>

        {/* Add record form */}
        <form onSubmit={handleAddRecord} className="space-y-4 border border-white/[0.06] rounded-xl p-4 bg-white/[0.02]">
          <p className="text-sm font-semibold text-white/70">➕ הוסף שיא</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>קטגוריה *</label>
              <input value={rTitle} onChange={e => setRTitle(e.target.value)} placeholder="שיא נקודות למשחק" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>בעל השיא</label>
              <input value={rHolder} onChange={e => setRHolder(e.target.value)} placeholder="שם השחקן / קבוצה" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>נתון</label>
              <input value={rValue} onChange={e => setRValue(e.target.value)} placeholder="99" className={inputCls} />
            </div>
          </div>

          {rMsg && (
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${rMsg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
              {rMsg.text}
            </p>
          )}

          <button type="submit" disabled={rAdding}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-orange-400 disabled:opacity-50">
            {rAdding ? 'שומר...' : 'הוסף שיא'}
          </button>
        </form>

        {/* Records list */}
        {records.length === 0 ? (
          <p className="text-center text-[#3a5a7a] py-6 text-sm">אין שיאים עדיין</p>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <div className="min-w-0 flex-1 flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-white text-sm">{r.title}</span>
                  {r.holder && <span className="text-[#5a7a9a] text-xs">{r.holder}</span>}
                  {r.value && <span className="font-bold text-orange-400 text-sm">{r.value}</span>}
                </div>
                <button
                  onClick={() => handleDeleteRecord(r.id)}
                  disabled={rDeleting === r.id}
                  className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition disabled:opacity-40 shrink-0"
                >
                  {rDeleting === r.id ? '⏳' : '🗑 מחק'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
