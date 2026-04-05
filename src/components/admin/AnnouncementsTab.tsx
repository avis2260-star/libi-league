'use client';

import { useState, useTransition } from 'react';
import { saveTickerSpeed } from '@/app/admin/actions';

type Announcement = {
  id: string;
  message: string;
  type: string;
  active: boolean;
  bg_color: string;
  created_at: string;
  expires_at: string | null;
};

const COLOR_LABELS: Record<string, string> = {
  orange: 'כתום',
  red: 'אדום',
  blue: 'כחול',
  green: 'ירוק',
};

const COLOR_CLASSES: Record<string, string> = {
  orange: 'bg-orange-500',
  red: 'bg-red-600',
  blue: 'bg-blue-600',
  green: 'bg-green-600',
};

const SPEED_LABELS: Record<number, string> = {
  5: 'מהיר מאוד',
  15: 'מהיר',
  25: 'רגיל',
  45: 'איטי',
  80: 'איטי מאוד',
};

function speedLabel(val: number): string {
  const steps = Object.keys(SPEED_LABELS).map(Number).sort((a, b) => a - b);
  const closest = steps.reduce((prev, cur) =>
    Math.abs(cur - val) < Math.abs(prev - val) ? cur : prev
  );
  return SPEED_LABELS[closest] ?? '';
}

function TickerSpeedControl({ initial }: { initial: number }) {
  const [speed, setSpeed]       = useState(initial);
  const [saved, setSaved]       = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = speed !== initial;

  function handleSave() {
    setErr(null); setSaved(false);
    startTransition(async () => {
      const res = await saveTickerSpeed(speed);
      if (res.error) { setErr(res.error); }
      else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    });
  }

  const demoText = 'לאור נחיות פקע״ד, אנו יוצאים לפנגה מאולצת · שמרו על ערנות ועל המשפחות';

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-white text-sm">🎚️ מהירות טיקר</h3>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-400">✓ נשמר</span>}
          {err   && <span className="text-xs text-red-400">{err}</span>}
          <button
            onClick={handleSave}
            disabled={pending || !changed}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#5a7a9a]">
          <span>מהיר 🚀</span>
          <span className="font-bold text-orange-400">{speedLabel(speed)} · {speed} שניות</span>
          <span>🐢 איטי</span>
        </div>
        <input
          type="range"
          min={5}
          max={120}
          step={1}
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to left, #f97316 ${((speed - 5) / 115) * 100}%, #1e3a5a ${((speed - 5) / 115) * 100}%)`,
          }}
        />
        <div className="flex justify-between text-[10px] text-[#3a5a7a]">
          {[5, 25, 45, 80, 120].map(v => (
            <button
              key={v}
              onClick={() => setSpeed(v)}
              className={`transition hover:text-orange-400 ${speed === v ? 'text-orange-400 font-bold' : ''}`}
            >
              {v}s
            </button>
          ))}
        </div>
      </div>

      {/* Live preview */}
      <div className="overflow-hidden rounded-lg bg-[#0d1a28] border border-white/[0.06] py-2">
        <div
          className="flex whitespace-nowrap gap-16"
          style={{ animation: `marquee ${speed}s linear infinite` }}
        >
          {[demoText, demoText].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-sm font-medium text-[#e8edf5]">
              <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
              {t}
            </span>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-[#3a5a7a]">תצוגה מקדימה חיה — גרור את הסרגל לשינוי המהירות</p>
    </div>
  );
}

export default function AnnouncementsTab({
  announcements: initial,
  tickerSpeed,
}: {
  announcements: Announcement[];
  tickerSpeed: number;
}) {
  const [list, setList]           = useState<Announcement[]>(initial);
  const [message, setMessage]     = useState('');
  const [type, setType]           = useState('ticker');
  const [bgColor, setBgColor]     = useState('orange');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [toggling, setToggling]   = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), type, bg_color: bgColor, expires_at: expiresAt || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList(prev => [data.announcement, ...prev]);
      setMessage(''); setType('ticker'); setBgColor('orange'); setExpiresAt('');
      setMsg({ ok: true, text: '✅ הודעה נוספה' });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally { setSaving(false); }
  }

  async function handleToggle(ann: Announcement) {
    setToggling(ann.id);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ann.id, active: !ann.active }),
      });
      if (!res.ok) throw new Error('עדכון נכשל');
      setList(prev => prev.map(a => a.id === ann.id ? { ...a, active: !a.active } : a));
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally { setToggling(null); }
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק הודעה זו?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/announcements?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('מחיקה נכשלה');
      setList(prev => prev.filter(a => a.id !== id));
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally { setDeleting(null); }
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">הודעות</h2>
        <p className="text-sm text-gray-400">ניהול הודעות לאתר · {list.length} הודעות</p>
      </div>

      {/* ── Speed slider ── */}
      <TickerSpeedControl initial={tickerSpeed} />

      {/* ── Add form ── */}
      <form onSubmit={handleAdd} className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
        <h3 className="font-semibold text-orange-400">➕ הוסף הודעה</h3>
        <div>
          <label className="mb-1 block text-xs text-gray-400">הודעה *</label>
          <input
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="טקסט ההודעה..."
            required
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">סוג</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none">
              <option value="ticker">טיקר (גולל)</option>
              <option value="banner">באנר (פס)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">צבע רקע</label>
            <select value={bgColor} onChange={e => setBgColor(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none">
              {Object.entries(COLOR_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">פג תוקף (אופציונלי)</label>
            <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {msg && (
          <p className={`rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
            {msg.text}
          </p>
        )}

        <button type="submit" disabled={saving}
          className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50">
          {saving ? 'שומר...' : 'הוסף הודעה'}
        </button>
      </form>

      {/* ── List ── */}
      {list.length > 0 ? (
        <div className="space-y-3">
          {list.map(a => (
            <div key={a.id}
              className={`rounded-xl border p-4 ${a.active ? 'border-gray-600 bg-gray-900/60' : 'border-gray-800 bg-gray-900/30 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block rounded-full w-3 h-3 shrink-0 ${COLOR_CLASSES[a.bg_color] ?? 'bg-gray-500'}`} />
                    <span className="text-sm font-medium text-white break-words">{a.message}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-gray-500">
                      {a.type === 'ticker' ? 'טיקר' : 'באנר'} · {new Date(a.created_at).toLocaleDateString('he-IL')}
                    </span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${a.active ? 'bg-green-900/50 text-green-300' : 'bg-gray-700/70 text-gray-400'}`}>
                      {a.active ? 'פעיל' : 'כבוי'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleToggle(a)} disabled={toggling === a.id}
                    title={a.active ? 'כבה הודעה' : 'הפעל הודעה'}
                    className={`rounded px-2 py-1 text-xs transition disabled:opacity-40 ${a.active ? 'text-yellow-400 hover:bg-yellow-900/30' : 'text-green-400 hover:bg-green-900/30'}`}>
                    {toggling === a.id ? '...' : a.active ? '👁 כבה' : '👁 הפעל'}
                  </button>
                  <button onClick={() => handleDelete(a.id)} disabled={deleting === a.id}
                    className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-40">
                    {deleting === a.id ? '...' : '🗑'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">אין הודעות עדיין</p>
      )}
    </div>
  );
}
