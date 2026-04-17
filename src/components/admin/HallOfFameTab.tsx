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

type HRecord = {
  id: string;
  title: string;
  holder: string | null;
  value: string | null;
};

const inputCls = 'w-full rounded-lg border border-white/[0.10] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder-white/30 focus:border-orange-500 focus:outline-none';
const labelCls = 'mb-1 block text-xs text-[#5a7a9a]';
const btnOrange = 'rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-orange-400 disabled:opacity-50';
const btnGhost  = 'rounded-lg border border-white/10 px-4 py-1.5 text-sm font-bold text-[#8aaac8] hover:border-white/20 hover:text-white transition';
const btnRed    = 'rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition disabled:opacity-40';

export default function HallOfFameTab({
  seasons: initialSeasons,
  records: initialRecords,
}: {
  seasons: Season[];
  records: HRecord[];
}) {
  /* ── Seasons ── */
  const [seasons, setSeasons]     = useState<Season[]>(initialSeasons);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [sYear, setSYear]         = useState('');
  const [sChampion, setSChampion] = useState('');
  const [sCaptain, setSCaptain]   = useState('');
  const [sMvpName, setSMvpName]   = useState('');
  const [sMvpStats, setSMvpStats] = useState('');
  const [sAdding, setSAdding]     = useState(false);
  const [sSaving, setSSaving]     = useState(false);
  const [sDeleting, setSDeleting] = useState<string | null>(null);
  const [sMsg, setSMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  /* ── Records ── */
  const [records, setRecords]     = useState<HRecord[]>(initialRecords);
  const [editingRecord, setEditingRecord] = useState<HRecord | null>(null);
  const [rTitle, setRTitle]       = useState('');
  const [rHolder, setRHolder]     = useState('');
  const [rValue, setRValue]       = useState('');
  const [rAdding, setRAdding]     = useState(false);
  const [rSaving, setRSaving]     = useState(false);
  const [rDeleting, setRDeleting] = useState<string | null>(null);
  const [rMsg, setRMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  /* ── DB setup ── */
  const [dbReady, setDbReady]         = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupMsg, setSetupMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  async function post(body: object) {
    const res = await fetch('/api/admin/hall-of-fame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      if ((json.error ?? '').includes('league_history')) setDbReady(false);
      throw new Error(json.error ?? 'Error');
    }
    return json;
  }

  /* ── DB setup ── */
  async function handleSetup() {
    setSetupLoading(true); setSetupMsg(null);
    try {
      await post({ type: 'setup', action: 'init' });
      setDbReady(true);
      setSetupMsg({ ok: true, text: '✅ Tables created — you can now add data' });
    } catch (e: unknown) {
      setSetupMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' });
    } finally { setSetupLoading(false); }
  }

  /* ─── SEASONS ─────────────────────────────────────────────────────────── */

  async function handleAddSeason(e: React.FormEvent) {
    e.preventDefault();
    if (!sYear.trim()) return;
    setSAdding(true); setSMsg(null);
    try {
      await post({ type: 'season', action: 'add', year: sYear.trim(), champion_name: sChampion.trim() || null, champion_captain: sCaptain.trim() || null, mvp_name: sMvpName.trim() || null, mvp_stats: sMvpStats.trim() || null });
      setSMsg({ ok: true, text: '✅ Season added' });
      setSeasons(prev => [...prev, { id: Date.now().toString(), year: sYear.trim(), champion_name: sChampion.trim() || null, champion_captain: sCaptain.trim() || null, mvp_name: sMvpName.trim() || null, mvp_stats: sMvpStats.trim() || null }]);
      setSYear(''); setSChampion(''); setSCaptain(''); setSMvpName(''); setSMvpStats('');
    } catch (e: unknown) { setSMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' }); }
    finally { setSAdding(false); }
  }

  function startEditSeason(s: Season) {
    setEditingSeason(s);
    setSMsg(null);
  }

  async function handleSaveSeason(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSeason) return;
    setSSaving(true); setSMsg(null);
    try {
      await post({ type: 'season', action: 'edit', id: editingSeason.id, year: editingSeason.year, champion_name: editingSeason.champion_name, champion_captain: editingSeason.champion_captain, mvp_name: editingSeason.mvp_name, mvp_stats: editingSeason.mvp_stats });
      setSeasons(prev => prev.map(s => s.id === editingSeason.id ? editingSeason : s));
      setSMsg({ ok: true, text: '✅ Saved' });
      setEditingSeason(null);
    } catch (e: unknown) { setSMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' }); }
    finally { setSSaving(false); }
  }

  async function handleDeleteSeason(id: string) {
    if (!confirm('Delete this season?')) return;
    setSDeleting(id);
    try {
      await post({ type: 'season', action: 'delete', id });
      setSeasons(prev => prev.filter(s => s.id !== id));
    } catch (e: unknown) { setSMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' }); }
    finally { setSDeleting(null); }
  }

  /* ─── RECORDS ─────────────────────────────────────────────────────────── */

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!rTitle.trim()) return;
    setRAdding(true); setRMsg(null);
    try {
      await post({ type: 'record', action: 'add', title: rTitle.trim(), holder: rHolder.trim() || null, value: rValue.trim() || null });
      setRMsg({ ok: true, text: '✅ Record added' });
      setRecords(prev => [...prev, { id: Date.now().toString(), title: rTitle.trim(), holder: rHolder.trim() || null, value: rValue.trim() || null }]);
      setRTitle(''); setRHolder(''); setRValue('');
    } catch (e: unknown) { setRMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' }); }
    finally { setRAdding(false); }
  }

  function startEditRecord(r: HRecord) {
    setEditingRecord(r);
    setRMsg(null);
  }

  async function handleSaveRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRecord) return;
    setRSaving(true); setRMsg(null);
    try {
      await post({ type: 'record', action: 'edit', id: editingRecord.id, title: editingRecord.title, holder: editingRecord.holder, value: editingRecord.value });
      setRecords(prev => prev.map(r => r.id === editingRecord.id ? editingRecord : r));
      setRMsg({ ok: true, text: '✅ Saved' });
      setEditingRecord(null);
    } catch (e: unknown) { setRMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' }); }
    finally { setRSaving(false); }
  }

  async function handleDeleteRecord(id: string) {
    if (!confirm('Delete this record?')) return;
    setRDeleting(id);
    try {
      await post({ type: 'record', action: 'delete', id });
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (e: unknown) { setRMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' }); }
    finally { setRDeleting(null); }
  }

  /* ─── RENDER ──────────────────────────────────────────────────────────── */
  return (
    <div dir="rtl" className="space-y-10">
      <div>
        <h2 className="text-xl font-bold text-white">Hall of Fame</h2>
        <p className="text-sm text-[#5a7a9a]">Manage league champions and all-time records</p>
      </div>

      {/* DB setup banner */}
      {!dbReady && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 space-y-3">
          <p className="font-bold text-yellow-300 text-sm">⚠️ Tables not found in database</p>
          <p className="text-xs text-yellow-400/70">Click below to create the tables automatically in Supabase.</p>
          {setupMsg && (
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${setupMsg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
              {setupMsg.text}
            </p>
          )}
          <button onClick={handleSetup} disabled={setupLoading} className={btnOrange}>
            {setupLoading ? '⏳ Creating tables...' : '🛠️ Create tables now'}
          </button>
        </div>
      )}

      {/* ══ SEASONS ══════════════════════════════════════════════════════════ */}
      <div className="border border-white/[0.07] bg-white/[0.04] rounded-2xl p-6 space-y-6">
        <h3 className="font-bold text-orange-400 text-base">🏆 League Champions ({seasons.length})</h3>

        {/* Add form */}
        <form onSubmit={handleAddSeason} className="space-y-4 border border-white/[0.06] rounded-xl p-4 bg-white/[0.02]">
          <p className="text-sm font-semibold text-white/70">+ Add season</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className={labelCls}>Year *</label><input value={sYear} onChange={e => setSYear(e.target.value)} placeholder="2024-2025" required className={inputCls} /></div>
            <div><label className={labelCls}>Champion</label><input value={sChampion} onChange={e => setSChampion(e.target.value)} placeholder="Team name" className={inputCls} /></div>
            <div><label className={labelCls}>Captain</label><input value={sCaptain} onChange={e => setSCaptain(e.target.value)} placeholder="Captain name" className={inputCls} /></div>
            <div><label className={labelCls}>MVP</label><input value={sMvpName} onChange={e => setSMvpName(e.target.value)} placeholder="Player name" className={inputCls} /></div>
            <div><label className={labelCls}>MVP Stats</label><input value={sMvpStats} onChange={e => setSMvpStats(e.target.value)} placeholder="24.5 PPG" className={inputCls} /></div>
          </div>
          {sMsg && <p className={`rounded-lg px-3 py-2 text-sm font-medium ${sMsg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>{sMsg.text}</p>}
          <button type="submit" disabled={sAdding} className={btnOrange}>{sAdding ? 'Saving...' : 'Add season'}</button>
        </form>

        {/* Edit modal */}
        {editingSeason && (
          <form onSubmit={handleSaveSeason} className="space-y-4 border border-orange-500/30 rounded-xl p-4 bg-orange-500/[0.04]">
            <p className="text-sm font-semibold text-orange-400">✏️ Editing: {editingSeason.year}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={labelCls}>Year *</label><input value={editingSeason.year} onChange={e => setEditingSeason(s => s ? { ...s, year: e.target.value } : s)} required className={inputCls} /></div>
              <div><label className={labelCls}>Champion</label><input value={editingSeason.champion_name ?? ''} onChange={e => setEditingSeason(s => s ? { ...s, champion_name: e.target.value } : s)} className={inputCls} /></div>
              <div><label className={labelCls}>Captain</label><input value={editingSeason.champion_captain ?? ''} onChange={e => setEditingSeason(s => s ? { ...s, champion_captain: e.target.value } : s)} className={inputCls} /></div>
              <div><label className={labelCls}>MVP</label><input value={editingSeason.mvp_name ?? ''} onChange={e => setEditingSeason(s => s ? { ...s, mvp_name: e.target.value } : s)} className={inputCls} /></div>
              <div><label className={labelCls}>MVP Stats</label><input value={editingSeason.mvp_stats ?? ''} onChange={e => setEditingSeason(s => s ? { ...s, mvp_stats: e.target.value } : s)} className={inputCls} /></div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={sSaving} className={btnOrange}>{sSaving ? 'Saving...' : 'Save changes'}</button>
              <button type="button" onClick={() => setEditingSeason(null)} className={btnGhost}>Cancel</button>
            </div>
          </form>
        )}

        {/* List */}
        {seasons.length === 0
          ? <p className="text-center text-[#3a5a7a] py-6 text-sm">No seasons yet</p>
          : (
            <div className="space-y-3">
              {seasons.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-orange-400 text-sm">{s.year}</span>
                      {s.champion_name && <span className="text-white text-sm font-medium">{s.champion_name}</span>}
                      {s.champion_captain && <span className="text-[#5a7a9a] text-xs">Captain: {s.champion_captain}</span>}
                    </div>
                    {(s.mvp_name || s.mvp_stats) && (
                      <p className="text-xs text-[#5a7a9a] mt-0.5">MVP: {s.mvp_name ?? '—'} {s.mvp_stats ? `· ${s.mvp_stats}` : ''}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEditSeason(s)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-[#8aaac8] hover:bg-white/5 hover:text-white transition">
                      ✏️ Edit
                    </button>
                    <button onClick={() => handleDeleteSeason(s.id)} disabled={sDeleting === s.id} className={btnRed}>
                      {sDeleting === s.id ? '⏳' : '🗑 Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* ══ RECORDS ══════════════════════════════════════════════════════════ */}
      <div className="border border-white/[0.07] bg-white/[0.04] rounded-2xl p-6 space-y-6">
        <h3 className="font-bold text-orange-400 text-base">📊 All-Time Records ({records.length})</h3>

        {/* Add form */}
        <form onSubmit={handleAddRecord} className="space-y-4 border border-white/[0.06] rounded-xl p-4 bg-white/[0.02]">
          <p className="text-sm font-semibold text-white/70">+ Add record</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className={labelCls}>Category *</label><input value={rTitle} onChange={e => setRTitle(e.target.value)} placeholder="Most points in a game" required className={inputCls} /></div>
            <div><label className={labelCls}>Holder</label><input value={rHolder} onChange={e => setRHolder(e.target.value)} placeholder="Player / team name" className={inputCls} /></div>
            <div><label className={labelCls}>Value</label><input value={rValue} onChange={e => setRValue(e.target.value)} placeholder="99" className={inputCls} /></div>
          </div>
          {rMsg && <p className={`rounded-lg px-3 py-2 text-sm font-medium ${rMsg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>{rMsg.text}</p>}
          <button type="submit" disabled={rAdding} className={btnOrange}>{rAdding ? 'Saving...' : 'Add record'}</button>
        </form>

        {/* Edit modal */}
        {editingRecord && (
          <form onSubmit={handleSaveRecord} className="space-y-4 border border-orange-500/30 rounded-xl p-4 bg-orange-500/[0.04]">
            <p className="text-sm font-semibold text-orange-400">✏️ Editing: {editingRecord.title}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={labelCls}>Category *</label><input value={editingRecord.title} onChange={e => setEditingRecord(r => r ? { ...r, title: e.target.value } : r)} required className={inputCls} /></div>
              <div><label className={labelCls}>Holder</label><input value={editingRecord.holder ?? ''} onChange={e => setEditingRecord(r => r ? { ...r, holder: e.target.value } : r)} className={inputCls} /></div>
              <div><label className={labelCls}>Value</label><input value={editingRecord.value ?? ''} onChange={e => setEditingRecord(r => r ? { ...r, value: e.target.value } : r)} className={inputCls} /></div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={rSaving} className={btnOrange}>{rSaving ? 'Saving...' : 'Save changes'}</button>
              <button type="button" onClick={() => setEditingRecord(null)} className={btnGhost}>Cancel</button>
            </div>
          </form>
        )}

        {/* List */}
        {records.length === 0
          ? <p className="text-center text-[#3a5a7a] py-6 text-sm">No records yet</p>
          : (
            <div className="space-y-2">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <div className="min-w-0 flex-1 flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-white text-sm">{r.title}</span>
                    {r.holder && <span className="text-[#5a7a9a] text-xs">{r.holder}</span>}
                    {r.value && <span className="font-bold text-orange-400 text-sm">{r.value}</span>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEditRecord(r)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-[#8aaac8] hover:bg-white/5 hover:text-white transition">
                      ✏️ Edit
                    </button>
                    <button onClick={() => handleDeleteRecord(r.id)} disabled={rDeleting === r.id} className={btnRed}>
                      {rDeleting === r.id ? '⏳' : '🗑 Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
