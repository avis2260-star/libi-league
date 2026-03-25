'use client';

import { useState } from 'react';

type Official = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
};

export default function OfficialsTab({ officials: initial }: { officials: Official[] }) {
  const [list, setList]         = useState<Official[]>(initial);
  const [name, setName]         = useState('');
  const [role, setRole]         = useState('referee');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/officials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), role, phone: phone || null, email: email || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => [...prev, data.official].sort((a, b) => a.name.localeCompare(b.name)));
      setName(''); setPhone(''); setEmail(''); setRole('referee');
      setMsg({ ok: true, text: `✅ ${data.official.name} נוסף` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, officialName: string) {
    if (!confirm(`למחוק את ${officialName}?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/officials?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('מחיקה נכשלה');
      setList((prev) => prev.filter((o) => o.id !== id));
      setMsg({ ok: true, text: `🗑 ${officialName} נמחק` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setDeleting(null);
    }
  }

  const roleLabel = (r: string) => r === 'referee' ? 'שופט' : 'מנהל ניקוד';
  const roleBadge = (r: string) =>
    r === 'referee'
      ? 'bg-blue-900/50 text-blue-300'
      : 'bg-purple-900/50 text-purple-300';

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">שופטים ומנהלי ניקוד</h2>
        <p className="text-sm text-gray-400">ניהול סגל הגברייה · {list.length} אנשים רשומים</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
        <h3 className="font-semibold text-orange-400">➕ הוסף איש סגל</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-400">שם *</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ישראל ישראלי"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">תפקיד *</label>
            <select
              value={role} onChange={(e) => setRole(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="referee">שופט</option>
              <option value="scorekeeper">מנהל ניקוד</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">טלפון</label>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">אימייל</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
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
          {saving ? 'שומר...' : 'הוסף'}
        </button>
      </form>

      {/* Officials table */}
      {list.length > 0 && (
        <div className="rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-800/80 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">שם</th>
                <th className="px-4 py-3 text-center">תפקיד</th>
                <th className="px-4 py-3">טלפון</th>
                <th className="px-4 py-3">אימייל</th>
                <th className="px-4 py-3 text-center">מחיקה</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="border-t border-gray-700/50 hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-white">{o.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge(o.role)}`}>
                      {roleLabel(o.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{o.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{o.email ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(o.id, o.name)}
                      disabled={deleting === o.id}
                      className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-40"
                    >
                      {deleting === o.id ? '...' : '🗑'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.length === 0 && (
        <p className="text-center text-gray-500 py-8">אין אנשי סגל עדיין</p>
      )}
    </div>
  );
}
