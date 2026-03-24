'use client';

import { useState, useTransition } from 'react';
import { bulkImportGames, type ImportResult } from '@/app/admin/actions';

type State = 'idle' | 'importing' | 'success' | 'error' | 'missing';

export default function BulkImportButton() {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleImport() {
    setState('importing');
    setResult(null);

    startTransition(async () => {
      const res = await bulkImportGames();
      setResult(res);

      if (res.missingTeams?.length) {
        setState('missing');
      } else if (res.error) {
        setState('error');
      } else {
        setState('success');
      }
    });
  }

  function handleReset() {
    setState('idle');
    setResult(null);
  }

  return (
    <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 p-5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-2xl">📥</span>
        <div>
          <h3 className="font-bold text-white">Bulk Import Schedule</h3>
          <p className="text-xs text-gray-400">
            Imports all 98 LIBI League 2025-2026 games in one click
          </p>
        </div>
      </div>

      {/* Idle state */}
      {state === 'idle' && (
        <button
          onClick={handleImport}
          disabled={isPending}
          className="mt-1 h-12 w-full rounded-xl bg-orange-500 text-base font-bold text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
        >
          🏀 Import All 98 Games
        </button>
      )}

      {/* Importing */}
      {state === 'importing' && (
        <div className="flex h-12 items-center justify-center gap-3 rounded-xl bg-gray-800 text-gray-300">
          <svg className="h-5 w-5 animate-spin text-orange-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-sm font-medium">Importing games…</span>
        </div>
      )}

      {/* Success */}
      {state === 'success' && result && (
        <div className="space-y-3">
          <div className="rounded-xl bg-green-900/40 px-4 py-3 text-sm text-green-400">
            <p className="font-bold text-green-300">✅ Import complete!</p>
            <p className="mt-1">
              <span className="font-semibold text-white">{result.inserted}</span> games added
              {result.skipped > 0 && (
                <span className="text-gray-400"> · {result.skipped} already existed (skipped)</span>
              )}
            </p>
            <p className="mt-1 text-xs text-green-500">
              📍 All games set to 19:00 · Location "TBD" — update them in the Games tab below.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="h-10 w-full rounded-xl border border-gray-700 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-300"
          >
            Done
          </button>
        </div>
      )}

      {/* Missing teams error */}
      {state === 'missing' && result?.missingTeams && (
        <div className="space-y-3">
          <div className="rounded-xl bg-yellow-900/40 px-4 py-3 text-sm text-yellow-400">
            <p className="font-bold text-yellow-300">⚠️ Some teams are missing from the database</p>
            <p className="mt-1 text-xs text-yellow-500">
              Run the Teams SQL insert first, then try again. Missing:
            </p>
            <ul className="mt-2 space-y-0.5 text-xs">
              {result.missingTeams.map((name) => (
                <li key={name} className="font-mono text-yellow-300">• {name}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={handleReset}
            className="h-10 w-full rounded-xl border border-gray-700 text-sm text-gray-400 hover:border-gray-500"
          >
            Try Again
          </button>
        </div>
      )}

      {/* General error */}
      {state === 'error' && result?.error && (
        <div className="space-y-3">
          <div className="rounded-xl bg-red-900/40 px-4 py-3 text-sm text-red-400">
            <p className="font-bold text-red-300">❌ Import failed</p>
            <p className="mt-1 text-xs font-mono">{result.error}</p>
          </div>
          <button
            onClick={handleReset}
            className="h-10 w-full rounded-xl border border-gray-700 text-sm text-gray-400 hover:border-gray-500"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
