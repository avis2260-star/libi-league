'use client';

import { useState } from 'react';
import { resetSeason } from '@/app/admin/actions';

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
        <div className="rounded-xl border border-gray-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-right min-w-[640px]">
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

      {/* ── Reset Season ── */}
      <ResetSeasonPanel />
    </div>
  );
}

/* ── Reset Season Panel ─────────────────────────────────────────────────────── */
function ResetSeasonPanel() {
  const [step, setStep]       = useState<0 | 1 | 2>(0);
  const [confirm, setConfirm] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<{ ok: boolean; lines: string[] } | null>(null);

  const [opts, setOpts] = useState({
    resetGames:       true,
    resetPlayerStats: true,
    resetStandings:   false,
    resetPlayoff:     true,
  });

  const CONFIRM_WORD = 'אני מאשר';

  function toggle(key: keyof typeof opts) {
    setOpts(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleReset() {
    if (confirm.trim() !== CONFIRM_WORD) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await resetSeason(opts);
      if (res.error) {
        setResult({ ok: false, lines: [res.error] });
      } else {
        setResult({ ok: true, lines: res.done });
        setStep(0);
        setConfirm('');
      }
    } catch (e: unknown) {
      setResult({ ok: false, lines: [e instanceof Error ? e.message : 'שגיאה לא ידועה'] });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-red-400 text-base">🔄 איפוס לעונה חדשה</h3>
          <p className="text-xs text-gray-500 mt-0.5">מאפס ציונים, סטטיסטיקות ופלייאוף — הקבוצות והשחקנים נשמרים</p>
        </div>
        {step === 0 && (
          <button
            onClick={() => { setStep(1); setResult(null); }}
            className="rounded-lg border border-red-700/60 bg-red-900/30 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-900/50 transition"
          >
            התחל איפוס
          </button>
        )}
      </div>

      {/* Step 1 — choose what to reset */}
      {step >= 1 && (
        <div className="rounded-lg border border-red-800/40 bg-black/30 p-4 space-y-3">
          <p className="text-sm font-semibold text-red-300">שלב 1 — בחר מה לאפס:</p>
          {([
            { key: 'resetGames',       label: '🎮 ניקוי תוצאות משחקים',           desc: 'מוחק ציונים, שעות ומיקומים' },
            { key: 'resetPlayerStats', label: '👤 איפוס סטטיסטיקת שחקנים',        desc: 'נקודות, 3-נקודות, עבירות → 0' },
            { key: 'resetStandings',   label: '📊 איפוס טבלת הליגה',              desc: 'ניצחונות, הפסדים, נקודות → 0' },
            { key: 'resetPlayoff',     label: '🏆 מחיקת נתוני פלייאוף',           desc: 'מוחק סדרות ומשחקי פלייאוף' },
          ] as { key: keyof typeof opts; label: string; desc: string }[]).map(({ key, label, desc }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={opts[key]}
                onChange={() => toggle(key)}
                className="mt-0.5 h-4 w-4 accent-red-500 cursor-pointer"
              />
              <span>
                <span className="text-sm font-medium text-white group-hover:text-red-300 transition">{label}</span>
                <span className="block text-xs text-gray-500">{desc}</span>
              </span>
            </label>
          ))}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setStep(2)}
              disabled={!Object.values(opts).some(Boolean)}
              className="rounded-lg bg-red-700/40 border border-red-600/50 px-4 py-1.5 text-sm font-bold text-red-300 hover:bg-red-700/60 transition disabled:opacity-40"
            >
              המשך →
            </button>
            <button
              onClick={() => { setStep(0); setConfirm(''); }}
              className="rounded-lg px-4 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — type confirmation */}
      {step === 2 && (
        <div className="rounded-lg border border-red-700/50 bg-black/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-red-300">שלב 2 — אישור סופי</p>
          <p className="text-xs text-gray-400">
            פעולה זו <span className="text-red-400 font-bold">בלתי הפיכה</span>.
            הקלד <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-yellow-300">{CONFIRM_WORD}</span> כדי להמשיך:
          </p>
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={CONFIRM_WORD}
            dir="rtl"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none"
          />

          {/* Summary of what will be reset */}
          <ul className="text-xs text-gray-500 space-y-0.5 pr-2">
            {opts.resetGames       && <li>• תוצאות כל המשחקים יאופסו</li>}
            {opts.resetPlayerStats && <li>• סטטיסטיקת כל השחקנים תאופס ל-0</li>}
            {opts.resetStandings   && <li>• טבלת הליגה תאופס ל-0</li>}
            {opts.resetPlayoff     && <li>• כל נתוני הפלייאוף יימחקו</li>}
          </ul>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={confirm.trim() !== CONFIRM_WORD || running}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-black text-white hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? '⏳ מאפס...' : '🔄 אפס עונה'}
            </button>
            <button
              onClick={() => { setStep(1); setConfirm(''); }}
              className="rounded-lg px-4 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition"
            >
              ← חזור
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm space-y-1 ${result.ok ? 'bg-green-900/30 border border-green-700/40' : 'bg-red-900/30 border border-red-700/40'}`}>
          {result.ok
            ? result.lines.map((l, i) => <p key={i} className="text-green-300">✅ {l}</p>)
            : result.lines.map((l, i) => <p key={i} className="text-red-300">❌ {l}</p>)
          }
        </div>
      )}
    </div>
  );
}
