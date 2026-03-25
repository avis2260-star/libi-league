'use client';

import { useState } from 'react';

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
  notes: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  technical: 'טכנית',
  unsportsmanlike: 'התנהגות בלתי ספורטיבית',
  ejection: 'גירוש',
};

const TYPE_COLORS: Record<string, string> = {
  technical: 'bg-yellow-900/50 text-yellow-300',
  unsportsmanlike: 'bg-orange-900/50 text-orange-300',
  ejection: 'bg-red-900/50 text-red-300',
};

const SUSPENSION_THRESHOLD = 5;

export default function DisciplinaryTab({
  records: initial,
  players,
}: {
  records: DisciplinaryRecord[];
  players: PlayerOption[];
}) {
  const [list, setList]           = useState<DisciplinaryRecord[]>(initial);
  const [playerId, setPlayerId]   = useState('');
  const [playerName, setPlayerName] = useState('');
  const [teamName, setTeamName]   = useState('');
  const [type, setType]           = useState('technical');
  const [round, setRound]         = useState('');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

  function handlePlayerSelect(id: string) {
    setPlayerId(id);
    if (id) {
      const p = players.find((pl) => pl.id === id);
      if (p) {
        setPlayerName(p.name);
        setTeamName(p.team_name ?? '');
      }
    } else {
      setPlayerName('');
      setTeamName('');
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => [data.record, ...prev]);
      setPlayerId(''); setPlayerName(''); setTeamName('');
      setType('technical'); setRound(''); setNotes('');
      setMsg({ ok: true, text: `✅ רשומת משמעת נוספה` });
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
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setDeleting(null);
    }
  }

  // Count technicals per player
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
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                  השעיה
                </span>
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
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">מחזור</label>
            <input
              type="number" min={1} max={30}
              value={round} onChange={(e) => setRound(e.target.value)}
              placeholder="מס׳ מחזור"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">הערות</label>
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
                <tr key={r.id} className="border-t border-gray-700/50 hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-white">{r.player_name}</td>
                  <td className="px-4 py-3 text-gray-400">{r.team_name ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[r.type] ?? 'bg-gray-700 text-gray-300'}`}>
                      {TYPE_LABELS[r.type] ?? r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{r.round ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
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
        </div>
      )}

      {list.length === 0 && (
        <p className="text-center text-gray-500 py-8">אין רשומות משמעת עדיין</p>
      )}
    </div>
  );
}
