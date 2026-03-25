'use client';

import { useState } from 'react';

type Season = {
  id: string;
  name: string;
  year: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export default function SeasonsTab({ seasons: initial }: { seasons: Season[] }) {
  const [list, setList]         = useState<Season[]>(initial);
  const [name, setName]         = useState('');
  const [year, setYear]         = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), year: year || null, start_date: startDate || null, end_date: endDate || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => [data.season, ...prev]);
      setName(''); setYear(''); setStartDate(''); setEndDate('');
      setMsg({ ok: true, text: `✅ העונה "${data.season.name}" נוספה` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(season: Season) {
    const newStatus = season.status === 'active' ? 'archived' : 'active';
    setToggling(season.id);
    try {
      const res = await fetch('/api/admin/seasons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: season.id, status: newStatus }),
      });
      if (!res.ok) throw new Error('עדכון נכשל');
      setList((prev) => prev.map((s) => s.id === season.id ? { ...s, status: newStatus } : s));
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string, seasonName: string) {
    if (!confirm(`למחוק את העונה "${seasonName}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/seasons?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('מחיקה נכשלה');
      setList((prev) => prev.filter((s) => s.id !== id));
      setMsg({ ok: true, text: `🗑 העונה "${seasonName}" נמחקה` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">עונות</h2>
        <p className="text-sm text-gray-400">ניהול עונות הליגה · {list.length} עונות</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
        <h3 className="font-semibold text-orange-400">➕ עונה חדשה</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-400">שם העונה *</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="עונת 2025-2026"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">שנה</label>
            <input
              value={year} onChange={(e) => setYear(e.target.value)}
              placeholder="2025-2026"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">תאריך התחלה</label>
            <input
              type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">תאריך סיום</label>
            <input
              type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
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
          {saving ? 'שומר...' : 'הוסף עונה'}
        </button>
      </form>

      {/* Seasons list */}
      {list.length > 0 && (
        <div className="rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-800/80 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">שם</th>
                <th className="px-4 py-3">שנה</th>
                <th className="px-4 py-3">תחילה</th>
                <th className="px-4 py-3">סיום</th>
                <th className="px-4 py-3 text-center">סטטוס</th>
                <th className="px-4 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t border-gray-700/50 hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                  <td className="px-4 py-3 text-gray-400">{s.year ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{s.start_date ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{s.end_date ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.status === 'active' ? 'bg-green-900/50 text-green-300' : 'bg-gray-700/70 text-gray-400'}`}>
                      {s.status === 'active' ? 'פעיל' : 'ארכיון'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleToggle(s)}
                        disabled={toggling === s.id}
                        className={`rounded px-2 py-0.5 text-xs transition disabled:opacity-40 ${s.status === 'active' ? 'text-yellow-400 hover:bg-yellow-900/30' : 'text-green-400 hover:bg-green-900/30'}`}
                      >
                        {toggling === s.id ? '...' : s.status === 'active' ? 'ארכיון' : 'פעיל'}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        disabled={deleting === s.id}
                        className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-40"
                      >
                        {deleting === s.id ? '...' : '🗑'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.length === 0 && (
        <p className="text-center text-gray-500 py-8">אין עונות עדיין</p>
      )}
    </div>
  );
}
