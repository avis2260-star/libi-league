'use client';

import { useState } from 'react';
import type { Team } from '@/types';

type PlayerRow = { id: string; name: string; jersey_number: number | null; position: string | null; team_id: string | null };

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export default function PlayersTab({ teams, players }: { teams: Team[]; players: PlayerRow[] }) {
  const [list, setList]       = useState<PlayerRow[]>(players);
  const [name, setName]       = useState('');
  const [teamId, setTeamId]   = useState('');
  const [jersey, setJersey]   = useState('');
  const [position, setPosition] = useState('');
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !teamId) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          team_id: teamId,
          jersey_number: jersey ? parseInt(jersey) : null,
          position: position || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => [...prev, data.player]);
      setName(''); setJersey(''); setPosition('');
      setMsg({ ok: true, text: `✅ השחקן ${data.player.name} נוסף בהצלחה` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, playerName: string) {
    if (!confirm(`למחוק את ${playerName}?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/players?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('מחיקה נכשלה');
      setList((prev) => prev.filter((p) => p.id !== id));
      setMsg({ ok: true, text: `🗑 ${playerName} נמחק` });
    } catch {
      setMsg({ ok: false, text: 'מחיקה נכשלה' });
    } finally {
      setDeleting(null);
    }
  }

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">ניהול שחקנים</h2>
        <p className="text-sm text-gray-400">הוסף שחקנים לקבוצות · {list.length} שחקנים רשומים</p>
      </div>

      {/* Add player form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
        <h3 className="font-semibold text-orange-400">➕ הוסף שחקן חדש</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-400">שם מלא *</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ישראל ישראלי"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">קבוצה *</label>
            <select
              value={teamId} onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
              required
            >
              <option value="">— בחר קבוצה —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">מספר גב</label>
            <input
              type="number" min={0} max={99}
              value={jersey} onChange={(e) => setJersey(e.target.value)}
              placeholder="7"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">פוזיציה</label>
            <select
              value={position} onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="">— בחר פוזיציה —</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
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
          {saving ? 'שומר...' : 'הוסף שחקן'}
        </button>
      </form>

      {/* Players list */}
      {list.length > 0 && (
        <div className="rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="px-4 py-2">שם</th>
                <th className="px-4 py-2">קבוצה</th>
                <th className="px-4 py-2 text-center">#</th>
                <th className="px-4 py-2 text-center">פוזיציה</th>
                <th className="px-4 py-2 text-center">מחיקה</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-gray-700/50 hover:bg-gray-800/40">
                  <td className="px-4 py-2 font-medium text-white">{p.name}</td>
                  <td className="px-4 py-2 text-gray-300">{teamMap[p.team_id ?? ''] ?? '—'}</td>
                  <td className="px-4 py-2 text-center text-gray-400">{p.jersey_number ?? '—'}</td>
                  <td className="px-4 py-2 text-center text-gray-400">{p.position ?? '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      disabled={deleting === p.id}
                      className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-40"
                    >
                      {deleting === p.id ? '...' : '🗑'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
