'use client';

import { useState, useRef } from 'react';

type StandingRow = {
  rank: number;
  name: string;
  games: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
  techni: number;
  penalty: number;
  pts: number;
};

type Preview = { north: StandingRow[]; south: StandingRow[] };

// Known team names for auto-detection
const NORTH_NAMES = new Set([
  'ידרסל חדרה', 'חולון', 'בני נתניה', 'גוטלמן השרון',
  'בני מוצקין', 'כ.ע. בת-ים', 'גלי בת-ים',
]);
const SOUTH_NAMES = new Set([
  'ראשון "גפן" לציון', 'אחים קריית משה', 'קריית מלאכי',
  'אוריה ירושלים', 'אופק רחובות', 'אריות קריית גת',
  'אדיס אשדוד', "החבר'ה הטובים גדרה",
]);

function parseStandings(rows: unknown[][]): Preview {
  const north: StandingRow[] = [];
  const south: StandingRow[] = [];

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cell = String(row[i] ?? '').trim();

      const inNorth = NORTH_NAMES.has(cell);
      const inSouth = SOUTH_NAMES.has(cell);

      if (!inNorth && !inSouth) continue;

      // Numbers after the name cell
      const nums = (row.slice(i + 1) as unknown[])
        .map((v) => (typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0));

      // Rank is the number before the name (or use count)
      const rankCell = row[i - 1];
      const rank = typeof rankCell === 'number' ? rankCell : (inNorth ? north.length : south.length) + 1;

      const standing: StandingRow = {
        rank,
        name: cell,
        games:   nums[0] ?? 0,
        wins:    nums[1] ?? 0,
        losses:  nums[2] ?? 0,
        pf:      nums[3] ?? 0,
        pa:      nums[4] ?? 0,
        diff:    nums[5] ?? 0,
        techni:  nums[6] ?? 0,
        penalty: nums[7] ?? 0,
        pts:     nums[8] ?? 0,
      };

      if (inNorth) north.push(standing);
      else south.push(standing);
    }
  }

  // Sort by rank
  north.sort((a, b) => a.rank - b.rank);
  south.sort((a, b) => a.rank - b.rank);

  return { north, south };
}

function PreviewTable({ rows, title }: { rows: StandingRow[]; title: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="mb-2 font-semibold text-orange-400">{title} ({rows.length} קבוצות)</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              {['#', 'קבוצה', "מ'", "נ'", "ה'", 'זכות', 'חובה', '+/-', "טכ'", '*', "נק'"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-gray-700/50 hover:bg-gray-800/40">
                <td className="px-3 py-1.5 text-gray-400">{r.rank}</td>
                <td className="px-3 py-1.5 font-medium text-white">{r.name}</td>
                <td className="px-3 py-1.5 text-gray-300">{r.games}</td>
                <td className="px-3 py-1.5 text-green-400">{r.wins}</td>
                <td className="px-3 py-1.5 text-red-400">{r.losses}</td>
                <td className="px-3 py-1.5">{r.pf}</td>
                <td className="px-3 py-1.5">{r.pa}</td>
                <td dir="ltr" className="px-3 py-1.5">
                  {r.diff > 0 ? `+${r.diff}` : r.diff}
                </td>
                <td className="px-3 py-1.5">{r.techni || ''}</td>
                <td dir="ltr" className="px-3 py-1.5 text-red-400">
                  {r.penalty < 0 ? r.penalty : ''}
                </td>
                <td className="px-3 py-1.5 font-bold text-orange-400">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExcelSyncTab() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setPreview(null);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // Prefer the standings sheet
      const sheetName =
        wb.SheetNames.find((n) => n.includes('טבלאות')) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

      const parsed = parseStandings(rows);

      if (parsed.north.length === 0 && parsed.south.length === 0) {
        setResult({ ok: false, msg: 'לא נמצאו קבוצות מוכרות בקובץ. בדוק ששמות הקבוצות תואמים.' });
        return;
      }

      setPreview(parsed);
    } catch {
      setResult({ ok: false, msg: 'שגיאה בקריאת הקובץ. ודא שזה קובץ Excel תקין.' });
    }
  }

  async function handleSync() {
    if (!preview) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/sync-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setResult({ ok: true, msg: data.message ?? `עדכון הושלם: ${data.updated} רשומות` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה';
      setResult({ ok: false, msg });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPreview(null);
    setResult(null);
    setFileName('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="mb-1 text-xl font-bold text-white">סנכרון טבלאות מ-Excel</h2>
        <p className="text-sm text-gray-400">
          העלה את קובץ Excel עם הטבלאות — המערכת תזהה אוטומטית את הנתונים ותעדכן את מסד הנתונים.
        </p>
      </div>

      {/* File input */}
      <div className="rounded-xl border-2 border-dashed border-gray-700 bg-gray-900/50 p-8 text-center">
        <div className="mb-3 text-4xl">📊</div>
        <p className="mb-4 text-gray-400">גרור קובץ Excel לכאן או לחץ לבחירה</p>
        <label className="cursor-pointer rounded-lg bg-orange-500 px-5 py-2.5 font-medium text-white transition hover:bg-orange-600">
          בחר קובץ Excel
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            className="hidden"
          />
        </label>
        {fileName && (
          <p className="mt-3 text-sm text-green-400">✅ {fileName}</p>
        )}
      </div>

      {/* Result message */}
      {result && (
        <div
          className={`rounded-lg p-4 text-sm font-medium ${
            result.ok
              ? 'bg-green-900/40 text-green-300 border border-green-700'
              : 'bg-red-900/40 text-red-300 border border-red-700'
          }`}
        >
          {result.ok ? '✅ ' : '❌ '}{result.msg}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">תצוגה מקדימה</h2>
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              ביטול
            </button>
          </div>

          <PreviewTable rows={preview.south} title="מחוז דרום" />
          <PreviewTable rows={preview.north} title="מחוז צפון" />

          <button
            onClick={handleSync}
            disabled={loading}
            className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? 'מסנכרן...' : '⬆️ סנכרן לבסיס הנתונים'}
          </button>
        </div>
      )}
    </div>
  );
}
