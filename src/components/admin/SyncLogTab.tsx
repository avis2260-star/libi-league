'use client';

import { useState } from 'react';

type SyncLog = {
  id: string;
  uploaded_at: string;
  filename: string | null;
  north_count: number;
  south_count: number;
  results_count: number;
  is_rolled_back: boolean;
};

export default function SyncLogTab({ logs: initial }: { logs: SyncLog[] }) {
  const [list, setList]       = useState<SyncLog[]>(initial);
  const [rolling, setRolling] = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  // Most recent non-rolled-back log
  const rollbackTarget = list.find((l) => !l.is_rolled_back) ?? null;

  async function handleRollback() {
    if (!rollbackTarget) return;
    if (!confirm(`האם לבצע rollback לגרסה מ-${new Date(rollbackTarget.uploaded_at).toLocaleString('he-IL')}?\n\nפעולה זו תחזיר את הטבלאות למצב הקודם.`)) return;
    setRolling(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/sync-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', id: rollbackTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => prev.map((l) => l.id === rollbackTarget.id ? { ...l, is_rolled_back: true } : l));
      setMsg({ ok: true, text: '✅ Rollback בוצע בהצלחה! הנתונים הוחזרו לגרסה הקודמת.' });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setRolling(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">יומן סנכרון</h2>
        <p className="text-sm text-gray-400">היסטוריית העלאות קובץ Excel · {list.length} רשומות אחרונות</p>
      </div>

      {/* Rollback section */}
      {rollbackTarget && (
        <div className="rounded-xl border border-yellow-800/50 bg-yellow-900/10 p-4">
          <h3 className="mb-2 font-semibold text-yellow-400">⏪ החזר גרסה קודמת</h3>
          <p className="mb-3 text-sm text-gray-400">
            הגרסה הנוכחית הועלתה ב-{new Date(rollbackTarget.uploaded_at).toLocaleString('he-IL')}
            {rollbackTarget.filename ? ` — ${rollbackTarget.filename}` : ''}.
            ביצוע rollback יחזיר את הטבלאות לגרסה שלפניה.
          </p>
          <button
            onClick={handleRollback}
            disabled={rolling}
            className="rounded-lg border border-yellow-600 px-4 py-2 text-sm font-bold text-yellow-400 transition hover:bg-yellow-900/30 disabled:opacity-50"
          >
            {rolling ? 'מבצע rollback...' : '⏪ בצע Rollback'}
          </button>
        </div>
      )}

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
          {msg.text}
        </p>
      )}

      {/* Logs table */}
      {list.length > 0 ? (
        <div className="rounded-xl border border-gray-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-right min-w-[600px]">
            <thead className="bg-gray-800/80 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">תאריך ושעה</th>
                <th className="px-4 py-3">קובץ</th>
                <th className="px-4 py-3 text-center">צפון</th>
                <th className="px-4 py-3 text-center">דרום</th>
                <th className="px-4 py-3 text-center">תוצאות</th>
                <th className="px-4 py-3 text-center">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {list.map((log) => (
                <tr key={log.id} className="border-t border-gray-700/50 hover:bg-gray-800/40">
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {new Date(log.uploaded_at).toLocaleString('he-IL')}
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-[180px] truncate">
                    {log.filename ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{log.north_count}</td>
                  <td className="px-4 py-3 text-center text-gray-300">{log.south_count}</td>
                  <td className="px-4 py-3 text-center text-gray-300">{log.results_count}</td>
                  <td className="px-4 py-3 text-center">
                    {log.is_rolled_back ? (
                      <span className="inline-block rounded-full bg-yellow-900/50 px-2.5 py-0.5 text-xs font-semibold text-yellow-300">
                        בוצע rollback
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-green-900/50 px-2.5 py-0.5 text-xs font-semibold text-green-300">
                        פעיל
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">אין רשומות סנכרון עדיין</p>
      )}
    </div>
  );
}
