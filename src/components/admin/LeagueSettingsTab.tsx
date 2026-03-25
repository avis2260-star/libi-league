'use client';

import { useState } from 'react';

type Setting = { key: string; value: string };

const SETTING_LABELS: Record<string, string> = {
  points_per_win: 'נקודות לניצחון',
  points_per_loss: 'נקודות להפסד',
  max_fouls_per_player: 'עבירות מקסימום לשחקן',
  period_length_minutes: 'אורך רבע (דקות)',
  periods_per_game: 'מספר רבעים',
  tiebreaker: 'שיטת שוויון',
  technical_suspension_threshold: 'ספף טכניות להשעיה',
};

const CATEGORIES = [
  { label: 'ניקוד', keys: ['points_per_win', 'points_per_loss'] },
  { label: 'חוקים', keys: ['max_fouls_per_player', 'period_length_minutes', 'periods_per_game'] },
  { label: 'מיון', keys: ['tiebreaker'] },
  { label: 'משמעת', keys: ['technical_suspension_threshold'] },
];

export default function LeagueSettingsTab({ settings: initial }: { settings: Setting[] }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(initial.map((s) => [s.key, s.value]))
  );
  const [status, setStatus] = useState<Record<string, { ok: boolean; text: string } | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function handleSave(key: string) {
    setSaving((prev) => ({ ...prev, [key]: true }));
    setStatus((prev) => ({ ...prev, [key]: null }));
    try {
      const res = await fetch('/api/admin/league-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: values[key] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setStatus((prev) => ({ ...prev, [key]: { ok: true, text: '✅ נשמר' } }));
      setTimeout(() => setStatus((prev) => ({ ...prev, [key]: null })), 2000);
    } catch (err: unknown) {
      setStatus((prev) => ({ ...prev, [key]: { ok: false, text: err instanceof Error ? err.message : 'שגיאה' } }));
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">הגדרות ליגה</h2>
        <p className="text-sm text-gray-400">ניהול פרמטרים של הליגה</p>
      </div>

      {CATEGORIES.map((cat) => (
        <div key={cat.label} className="rounded-xl border border-gray-700 bg-gray-900/60 overflow-hidden">
          <div className="bg-gray-800/70 px-5 py-3 border-b border-gray-700">
            <h3 className="font-semibold text-orange-400">{cat.label}</h3>
          </div>
          <div className="p-5 space-y-4">
            {cat.keys.map((key) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-48 shrink-0 text-sm text-gray-300">
                  {SETTING_LABELS[key] ?? key}
                </label>
                {key === 'tiebreaker' ? (
                  <select
                    value={values[key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                  >
                    <option value="head_to_head">יתרון ישיר (head_to_head)</option>
                    <option value="point_differential">הפרש נקודות (point_differential)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={values[key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                )}
                <button
                  onClick={() => handleSave(key)}
                  disabled={saving[key]}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap"
                >
                  {saving[key] ? '...' : 'שמור'}
                </button>
                {status[key] && (
                  <span className={`text-xs font-medium whitespace-nowrap ${status[key]!.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {status[key]!.text}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
