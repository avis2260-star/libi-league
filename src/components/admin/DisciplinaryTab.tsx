'use client';

import { useEffect, useState } from 'react';
import { LIBI_SCHEDULE } from '@/lib/libi-schedule';

type PlayerOption = {
  id: string;
  name: string;
  team_name: string | null;
};

type DisciplinaryRecord = {
  id: string;
  player_id: string | null;
  player_name: string;
  team_name: string | null;
  type: string;
  round: number | null;
  suspension_until_round: number | null;
  notes: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  technical:       'טכנית',
  unsportsmanlike: 'התנהגות בלתי ספורטיבית',
  ejection:        'גירוש',
  suspension:      'הרחקה',
};

const TYPE_COLORS: Record<string, string> = {
  technical:       'bg-yellow-900/50 text-yellow-300',
  unsportsmanlike: 'bg-orange-900/50 text-orange-300',
  ejection:        'bg-red-900/50 text-red-300',
  suspension:      'bg-red-900/70 text-red-200 ring-1 ring-red-500/30',
};

const SUSPENSION_THRESHOLD = 5;

// Canonical round → date map for the modal, built once.
const DATE_OF_ROUND: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  for (const e of LIBI_SCHEDULE) {
    if (m[e.round] === undefined) m[e.round] = e.date;
  }
  return m;
})();

function fmtRoundDate(round: number | null): string {
  if (round == null) return '—';
  const iso = DATE_OF_ROUND[round];
  if (!iso) return `${round}`;
  const [y, mo, d] = iso.split('-');
  return `${parseInt(d, 10)}.${parseInt(mo, 10)}.${y.slice(2)}`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

export default function DisciplinaryTab({
  records: initial,
  players,
}: {
  records: DisciplinaryRecord[];
  players: PlayerOption[];
}) {
  const [list, setList] = useState<DisciplinaryRecord[]>(initial);

  // ── Add form state ─────────────────────────────────────────────────
  const [playerId, setPlayerId]                       = useState('');
  const [playerName, setPlayerName]                   = useState('');
  const [teamName, setTeamName]                       = useState('');
  const [type, setType]                               = useState('technical');
  const [round, setRound]                             = useState('');
  const [suspensionUntil, setSuspensionUntil]         = useState('');
  const [notes, setNotes]                             = useState('');
  const [saving, setSaving]                           = useState(false);
  const [msg, setMsg]                                 = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting]                       = useState<string | null>(null);

  // ── Detail/edit modal state ────────────────────────────────────────
  const [modalRec, setModalRec]   = useState<DisciplinaryRecord | null>(null);
  const [editMode, setEditMode]   = useState(false);
  const [editDraft, setEditDraft] = useState<{
    player_name: string; team_name: string; type: string;
    round: string; suspension_until_round: string; notes: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [modalMsg, setModalMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  // Close the modal on Escape.
  useEffect(() => {
    if (!modalRec) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeModal(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalRec]);

  function openModal(rec: DisciplinaryRecord) {
    setModalRec(rec);
    setEditMode(false);
    setModalMsg(null);
  }
  function closeModal() {
    setModalRec(null);
    setEditMode(false);
    setEditDraft(null);
    setModalMsg(null);
  }
  function startEditing() {
    if (!modalRec) return;
    setEditMode(true);
    setEditDraft({
      player_name: modalRec.player_name,
      team_name:   modalRec.team_name ?? '',
      type:        modalRec.type,
      round:       modalRec.round != null ? String(modalRec.round) : '',
      suspension_until_round: modalRec.suspension_until_round != null ? String(modalRec.suspension_until_round) : '',
      notes:       modalRec.notes ?? '',
    });
  }

  async function saveEdit() {
    if (!modalRec || !editDraft) return;
    setEditSaving(true);
    setModalMsg(null);
    try {
      const res = await fetch('/api/admin/disciplinary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modalRec.id,
          player_name: editDraft.player_name.trim(),
          team_name:   editDraft.team_name.trim() || null,
          type:        editDraft.type,
          round:       editDraft.round,
          suspension_until_round: editDraft.suspension_until_round,
          notes:       editDraft.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'עדכון נכשל');
      setList((prev) => prev.map((r) => (r.id === data.record.id ? data.record : r)));
      setModalRec(data.record);
      setEditMode(false);
      setEditDraft(null);
      setModalMsg({ ok: true, text: '✅ הרשומה עודכנה' });
    } catch (err: unknown) {
      setModalMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setEditSaving(false);
    }
  }

  function handlePlayerSelect(id: string) {
    setPlayerId(id);
    if (id) {
      const p = players.find((pl) => pl.id === id);
      if (p) { setPlayerName(p.name); setTeamName(p.team_name ?? ''); }
    } else {
      setPlayerName(''); setTeamName('');
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim() || !type) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/disciplinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerId || null,
          player_name: playerName.trim(),
          team_name: teamName || null,
          type,
          round: round ? parseInt(round) : null,
          notes: notes || null,
          suspension_until_round: type === 'suspension' && suspensionUntil ? parseInt(suspensionUntil) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => [data.record, ...prev]);
      setPlayerId(''); setPlayerName(''); setTeamName('');
      setType('technical'); setRound(''); setSuspensionUntil(''); setNotes('');
      setMsg({ ok: true, text: '✅ רשומת משמעת נוספה' });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק רשומה זו?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/disciplinary?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('מחיקה נכשלה');
      setList((prev) => prev.filter((r) => r.id !== id));
      if (modalRec?.id === id) closeModal();
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setDeleting(null);
    }
  }

  // Count technicals per player for the suspensions-summary at the top.
  const technicalsMap: Record<string, { name: string; team: string | null; count: number }> = {};
  for (const rec of list) {
    if (rec.type === 'technical') {
      const key = rec.player_name;
      if (!technicalsMap[key]) {
        technicalsMap[key] = { name: rec.player_name, team: rec.team_name, count: 0 };
      }
      technicalsMap[key].count++;
    }
  }
  const suspended = Object.values(technicalsMap).filter((p) => p.count >= SUSPENSION_THRESHOLD);

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">משמעת</h2>
        <p className="text-sm text-gray-400">ניהול עבירות משמעת · {list.length} רשומות</p>
      </div>

      {/* Suspensions summary */}
      {suspended.length > 0 && (
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-4">
          <h3 className="mb-3 font-bold text-red-400">⚠️ שחקנים מושעים ({suspended.length})</h3>
          <div className="flex flex-wrap gap-2">
            {suspended.map((p) => (
              <div key={p.name} className="flex items-center gap-2 rounded-lg bg-red-900/40 px-3 py-1.5">
                <span className="text-sm font-semibold text-white">{p.name}</span>
                {p.team && <span className="text-xs text-gray-400">{p.team}</span>}
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">השעיה</span>
                <span className="text-xs text-red-300">{p.count} טכניות</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
        <h3 className="font-semibold text-orange-400">➕ הוסף רשומת משמעת</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-400">שחקן (מרשימה)</label>
            <select
              value={playerId} onChange={(e) => handlePlayerSelect(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="">— בחר שחקן —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.team_name ? ` (${p.team_name})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">שם שחקן (ידני) *</label>
            <input
              value={playerName} onChange={(e) => setPlayerName(e.target.value)}
              placeholder="או הקלד שם"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">קבוצה</label>
            <input
              value={teamName} onChange={(e) => setTeamName(e.target.value)}
              placeholder="שם הקבוצה"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">סוג עבירה *</label>
            <select
              value={type} onChange={(e) => setType(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="technical">טכנית</option>
              <option value="unsportsmanlike">התנהגות בלתי ספורטיבית</option>
              <option value="ejection">גירוש</option>
              <option value="suspension">הרחקה</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">מחזור (האירוע)</label>
            <input
              type="number" min={1} max={30}
              value={round} onChange={(e) => setRound(e.target.value)}
              placeholder="מס׳ מחזור"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          {/* Conditional "until round" — only for suspension */}
          {type === 'suspension' && (
            <div>
              <label className="mb-1 block text-xs text-red-400 font-bold">הרחקה עד מחזור *</label>
              <input
                type="number" min={1} max={30}
                value={suspensionUntil} onChange={(e) => setSuspensionUntil(e.target.value)}
                placeholder="מס׳ מחזור אחרון של ההרחקה"
                className="w-full rounded-lg border border-red-500/40 bg-red-500/[0.04] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
              />
              <p className="mt-0.5 text-[10px] text-gray-500">השחקן מורחק עד וכולל מחזור זה</p>
            </div>
          )}
          <div className={type === 'suspension' ? '' : 'sm:col-span-1'}>
            <label className="mb-1 block text-xs text-gray-400">הערות (סיבת האירוע)</label>
            <input
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="פרטים נוספים"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {msg && (
          <p className={`rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
            {msg.text}
          </p>
        )}

        <button
          type="submit" disabled={saving}
          className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? 'שומר...' : 'הוסף רשומה'}
        </button>
      </form>

      {/* Records table */}
      {list.length > 0 && (
        <div className="rounded-xl border border-gray-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-right min-w-[600px]">
            <thead className="bg-gray-800/80 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">שחקן</th>
                <th className="px-4 py-3">קבוצה</th>
                <th className="px-4 py-3 text-center">סוג</th>
                <th className="px-4 py-3 text-center">מחזור</th>
                <th className="px-4 py-3">הערות</th>
                <th className="px-4 py-3 text-center">מחיקה</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openModal(r)}
                  className="border-t border-gray-700/50 hover:bg-orange-500/[0.06] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-white">{r.player_name}</td>
                  <td className="px-4 py-3 text-gray-400">{r.team_name ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[r.type] ?? 'bg-gray-700 text-gray-300'}`}>
                      {TYPE_LABELS[r.type] ?? r.type}
                      {r.type === 'suspension' && r.suspension_until_round != null && (
                        <span className="font-normal opacity-80"> · עד מחזור {r.suspension_until_round}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{r.round ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-40"
                    >
                      {deleting === r.id ? '...' : '🗑'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[11px] text-gray-500 bg-gray-900/50 border-t border-gray-800">
            💡 לחץ על שורה כדי לראות פרטים ולערוך
          </p>
        </div>
      )}

      {list.length === 0 && (
        <p className="text-center text-gray-500 py-8">אין רשומות משמעת עדיין</p>
      )}

      {/* ─────────────────────── Detail / Edit modal ─────────────────────── */}
      {modalRec && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c1825] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
              <div className="min-w-0">
                <h3 className="text-base font-black text-white truncate">
                  {editMode ? '✏️ עריכת רשומת משמעת' : '🔎 פרטי רשומת משמעת'}
                </h3>
                <p className="text-xs font-bold text-[#8aaac8]">{modalRec.player_name}</p>
              </div>
              <button
                onClick={closeModal}
                className="shrink-0 rounded-lg p-1.5 text-[#8aaac8] hover:text-white hover:bg-white/[0.05]"
                aria-label="סגור"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {!editMode ? (
                <DetailView rec={modalRec} />
              ) : editDraft ? (
                <EditForm
                  draft={editDraft}
                  setDraft={setEditDraft}
                />
              ) : null}

              {modalMsg && (
                <p className={`rounded-lg px-3 py-2 text-xs font-black ${modalMsg.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {modalMsg.text}
                </p>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-white/[0.06]">
              {!editMode ? (
                <>
                  <button
                    onClick={() => handleDelete(modalRec.id)}
                    className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-1.5 text-xs font-black text-red-400 hover:bg-red-500/15 transition"
                  >
                    🗑 מחק
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={closeModal}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-[#8aaac8] hover:text-white transition"
                    >
                      סגור
                    </button>
                    <button
                      onClick={startEditing}
                      className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-black text-white hover:bg-orange-400 transition"
                    >
                      ✏️ ערוך
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditMode(false); setEditDraft(null); setModalMsg(null); }}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-[#8aaac8] hover:text-white transition"
                    >
                      ביטול
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={editSaving}
                      className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-black text-white hover:bg-orange-400 disabled:opacity-60 transition"
                    >
                      {editSaving ? 'שומר...' : '💾 שמור'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Detail view (read-only) ───────────────────────────

function DetailView({ rec }: { rec: DisciplinaryRecord }) {
  return (
    <dl className="grid grid-cols-3 gap-y-3 text-sm">
      <dt className="text-xs font-bold text-[#8aaac8]">שחקן:</dt>
      <dd className="col-span-2 font-black text-white">{rec.player_name}</dd>

      <dt className="text-xs font-bold text-[#8aaac8]">קבוצה:</dt>
      <dd className="col-span-2 font-bold text-[#c8d8e8]">{rec.team_name ?? '—'}</dd>

      <dt className="text-xs font-bold text-[#8aaac8]">סוג העבירה:</dt>
      <dd className="col-span-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-black ${TYPE_COLORS[rec.type] ?? 'bg-gray-700 text-gray-300'}`}>
          {TYPE_LABELS[rec.type] ?? rec.type}
        </span>
      </dd>

      <dt className="text-xs font-bold text-[#8aaac8]">מתי קרה:</dt>
      <dd className="col-span-2 font-bold text-white">
        {rec.round != null
          ? <>מחזור <span className="font-black">{rec.round}</span> <span className="text-[#8aaac8]">·</span> {fmtRoundDate(rec.round)}</>
          : <span className="text-[#5a7a9a]">לא צוין מחזור</span>}
      </dd>

      {rec.type === 'suspension' && (
        <>
          <dt className="text-xs font-bold text-red-400">הרחקה עד מחזור:</dt>
          <dd className="col-span-2">
            <span className="inline-block rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1 text-sm font-black text-red-300">
              {rec.suspension_until_round ?? '—'}
              {rec.suspension_until_round != null && (
                <span className="font-normal text-red-200/80"> · {fmtRoundDate(rec.suspension_until_round)}</span>
              )}
            </span>
          </dd>
        </>
      )}

      <dt className="text-xs font-bold text-[#8aaac8]">סיבה / הערות:</dt>
      <dd className="col-span-2 font-bold text-white whitespace-pre-wrap">
        {rec.notes && rec.notes.trim() !== '' ? rec.notes : <span className="text-[#5a7a9a] font-bold">לא צוינה סיבה</span>}
      </dd>

      <dt className="text-xs font-bold text-[#8aaac8]">נרשם במערכת:</dt>
      <dd className="col-span-2 text-xs font-bold text-[#8aaac8]" dir="ltr">{fmtDateTime(rec.created_at)}</dd>
    </dl>
  );
}

// ─────────────────────────── Edit form (in-modal) ───────────────────────────

function EditForm({
  draft,
  setDraft,
}: {
  draft: {
    player_name: string; team_name: string; type: string;
    round: string; suspension_until_round: string; notes: string;
  };
  setDraft: React.Dispatch<React.SetStateAction<typeof draft | null>>;
}) {
  function update<K extends keyof typeof draft>(key: K, value: string) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-bold text-[#8aaac8]">שם שחקן *</label>
        <input
          value={draft.player_name}
          onChange={(e) => update('player_name', e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-white focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-[#8aaac8]">קבוצה</label>
        <input
          value={draft.team_name}
          onChange={(e) => update('team_name', e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-white focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-[#8aaac8]">סוג עבירה *</label>
        <select
          value={draft.type}
          onChange={(e) => {
            const v = e.target.value;
            setDraft((p) => p ? ({ ...p, type: v, suspension_until_round: v === 'suspension' ? p.suspension_until_round : '' }) : p);
          }}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-white focus:border-orange-500/50 focus:outline-none"
        >
          <option value="technical">טכנית</option>
          <option value="unsportsmanlike">התנהגות בלתי ספורטיבית</option>
          <option value="ejection">גירוש</option>
          <option value="suspension">הרחקה</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-[#8aaac8]">מחזור</label>
        <input
          type="number" min={1} max={30}
          value={draft.round}
          onChange={(e) => update('round', e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-white text-center focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>
      {draft.type === 'suspension' && (
        <div>
          <label className="mb-1 block text-xs font-bold text-red-400">הרחקה עד מחזור</label>
          <input
            type="number" min={1} max={30}
            value={draft.suspension_until_round}
            onChange={(e) => update('suspension_until_round', e.target.value)}
            className="w-full rounded-lg border border-red-500/30 bg-red-500/[0.04] px-3 py-2 text-sm font-bold text-white text-center focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-bold text-[#8aaac8]">סיבה / הערות</label>
        <textarea
          rows={3}
          value={draft.notes}
          onChange={(e) => update('notes', e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-white focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>
    </div>
  );
}
