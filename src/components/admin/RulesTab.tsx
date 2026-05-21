'use client';

import { useState } from 'react';

export type Rule = {
  id: string;
  title: string;
  body: string;
  sort_order: number;
};

export default function RulesTab({ rules: initial }: { rules: Rule[] }) {
  const [list, setList] = useState<Rule[]>(initial);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sortOrder, setSortOrder] = useState<number>(initial.length);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; body: string; sort_order: number }>({ title: '', body: '', sort_order: 0 });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), sort_order: sortOrder }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => [...prev, data.rule].sort(byOrder));
      setTitle(''); setBody('');
      setSortOrder((n) => n + 1);
      setMsg({ ok: true, text: `✅ "${data.rule.title}" נוסף` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setEditDraft({ title: rule.title, body: rule.body, sort_order: rule.sort_order });
  }

  async function handleSaveEdit(id: string) {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editDraft, title: editDraft.title.trim(), body: editDraft.body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => prev.map((r) => r.id === id ? { ...r, ...editDraft } : r).sort(byOrder));
      setEditingId(null);
      setMsg({ ok: true, text: '✅ עודכן' });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, ruleTitle: string) {
    if (!confirm(`למחוק את הכלל "${ruleTitle}"?`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/rules?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('מחיקה נכשלה');
      setList((prev) => prev.filter((r) => r.id !== id));
      setMsg({ ok: true, text: `🗑 "${ruleTitle}" נמחק` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div dir="rtl" className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-black text-white">📋 כללי הליגה</h2>
        <p className="text-sm text-[#5a7a9a] mt-1">
          ניהול הכרטיסים שמופיעים בסקשן &quot;פורמט הליגה&quot; בדף{' '}
          <a href="/about" target="_blank" className="text-orange-400 hover:underline">/about ↗</a>
          . אם הטבלה ריקה — מוצגים ערכי ברירת המחדל.
        </p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-2 text-sm font-bold ${msg.ok ? 'bg-green-900/30 text-green-300 border border-green-600/30' : 'bg-red-900/30 text-red-300 border border-red-600/30'}`}>
          {msg.text}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-3">
        <h3 className="text-sm font-black text-orange-400">➕ הוסף כלל חדש</h3>
        <div className="grid gap-3 sm:grid-cols-[2fr,1fr]">
          <div>
            <label className="mb-1 block text-xs text-gray-400">כותרת *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: שלב הבית"
              className="w-full rounded-lg border border-white/[0.08] bg-[#0a1525] px-3 py-2 text-sm text-white placeholder:text-[#3a5a7a] focus:border-orange-500/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">סדר תצוגה</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border border-white/[0.08] bg-[#0a1525] px-3 py-2 text-sm text-white focus:border-orange-500/40 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">תיאור *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="לדוגמה: 14 מחזורים — כל קבוצה משחקת נגד כל קבוצה אחרת במחוזה פעמיים (בית וחוץ)."
            className="w-full rounded-lg border border-white/[0.08] bg-[#0a1525] px-3 py-2 text-sm text-[#c0d4e8] placeholder:text-[#3a5a7a] focus:border-orange-500/40 focus:outline-none resize-y leading-relaxed"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !title.trim() || !body.trim()}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {saving ? 'שומר...' : 'הוסף כלל'}
        </button>
      </form>

      {/* List */}
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-12 text-center text-sm text-[#5a7a9a]">
          אין כללים עדיין. הוסף את הראשון למעלה. בינתיים בדף /about מוצגים ערכי ברירת מחדל.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((rule) => (
            <div key={rule.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 space-y-3">
              {editingId === rule.id ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-[2fr,1fr]">
                    <input
                      type="text"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      className="w-full rounded-lg border border-white/[0.08] bg-[#0a1525] px-3 py-2 text-sm font-bold text-white focus:border-orange-500/40 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={editDraft.sort_order}
                      onChange={(e) => setEditDraft((d) => ({ ...d, sort_order: parseInt(e.target.value, 10) || 0 }))}
                      className="w-full rounded-lg border border-white/[0.08] bg-[#0a1525] px-3 py-2 text-sm text-white focus:border-orange-500/40 focus:outline-none"
                    />
                  </div>
                  <textarea
                    value={editDraft.body}
                    onChange={(e) => setEditDraft((d) => ({ ...d, body: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#0a1525] px-3 py-2 text-sm text-[#c0d4e8] focus:border-orange-500/40 focus:outline-none resize-y leading-relaxed"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(rule.id)}
                      disabled={busyId === rule.id || !editDraft.title.trim() || !editDraft.body.trim()}
                      className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 transition"
                    >
                      {busyId === rule.id ? 'שומר...' : 'שמור'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-white/[0.12] px-4 py-1.5 text-sm text-[#8aaac8] hover:text-white hover:border-white/20 transition"
                    >
                      ביטול
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white">{rule.title}</p>
                      <p className="text-sm text-[#c0d4e8] mt-1 leading-relaxed whitespace-pre-wrap">{rule.body}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-[#8aaac8]">
                        סדר: {rule.sort_order}
                      </span>
                      <button
                        onClick={() => startEdit(rule)}
                        disabled={busyId === rule.id}
                        title="ערוך"
                        className="rounded px-2 py-1 text-sm text-green-400 hover:bg-green-900/30 disabled:opacity-40"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id, rule.title)}
                        disabled={busyId === rule.id}
                        title="מחק"
                        className="rounded px-2 py-1 text-sm text-red-400 hover:bg-red-900/30 disabled:opacity-40"
                      >
                        {busyId === rule.id ? '...' : '🗑'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function byOrder(a: Rule, b: Rule): number {
  return a.sort_order - b.sort_order;
}
