'use client';

import { useState, useRef } from 'react';

type TeamRow = {
  id: string;
  name: string;
  logo_url: string | null;
  captain_name: string | null;
  contact_info: string | null;
};

export default function TeamsTab({ teams: initial }: { teams: TeamRow[] }) {
  const [teams, setTeams] = useState<TeamRow[]>(initial);
  const [uploading, setUploading] = useState<string | null>(null); // team id being uploaded
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Inline name editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);

  function startEditName(team: TeamRow) {
    setEditingId(team.id);
    setDraftName(team.name);
    setMsg(null);
  }

  function cancelEditName() {
    setEditingId(null);
    setDraftName('');
  }

  async function saveName(team: TeamRow) {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setMsg({ ok: false, text: 'שם הקבוצה לא יכול להיות ריק' });
      return;
    }
    if (trimmed === team.name) {
      cancelEditName();
      return;
    }
    setSavingName(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: team.id, name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בעדכון השם');

      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, name: trimmed } : t)),
      );
      setMsg({ ok: true, text: `✅ שם הקבוצה עודכן ל-"${trimmed}"` });
      cancelEditName();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setSavingName(false);
    }
  }

  async function handleLogoUpload(team: TeamRow, file: File) {
    setUploading(team.id);
    setMsg(null);
    try {
      // 1 — upload file to storage
      const fd = new FormData();
      fd.append('file', file);
      const upRes = await fetch('/api/admin/teams/upload', { method: 'POST', body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error ?? 'Upload failed');

      // 2 — update logo_url in teams table
      const patchRes = await fetch('/api/admin/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: team.id, logo_url: upData.url }),
      });
      if (!patchRes.ok) throw new Error('DB update failed');

      // 3 — update local state
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, logo_url: upData.url } : t))
      );
      setMsg({ ok: true, text: `✅ לוגו של ${team.name} עודכן!` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setUploading(null);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ליגת ליבי" className="h-10 w-10 object-contain rounded-full border border-orange-500/30" />
          <h2 className="text-xl font-bold text-white">לוגואים של קבוצות · ליגת ליבי</h2>
        </div>
        <p className="text-sm text-gray-400">העלה לוגו לכל קבוצה · {teams.length} קבוצות</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-2 text-sm font-medium ${msg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => (
          <div
            key={team.id}
            className="flex items-center gap-4 rounded-xl border border-gray-700 bg-gray-900 p-4"
          >
            {/* Logo preview */}
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-gray-600 bg-gray-800 flex items-center justify-center">
              {team.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.logo_url} alt={team.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-gray-500">
                  {team.name.charAt(0)}
                </span>
              )}
              {uploading === team.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                  <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Info + upload */}
            <div className="flex-1 min-w-0">
              {editingId === team.id ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')  { e.preventDefault(); saveName(team); }
                      if (e.key === 'Escape') { e.preventDefault(); cancelEditName(); }
                    }}
                    autoFocus
                    disabled={savingName}
                    maxLength={80}
                    className="flex-1 min-w-0 rounded-md border border-orange-500/40 bg-gray-800 px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-orange-400"
                  />
                  <button
                    onClick={() => saveName(team)}
                    disabled={savingName || !draftName.trim()}
                    className="rounded-md bg-green-600 px-2 py-1 text-xs font-bold text-white hover:bg-green-500 disabled:opacity-40 transition"
                    title="שמור (Enter)"
                  >
                    {savingName ? '…' : '✓'}
                  </button>
                  <button
                    onClick={cancelEditName}
                    disabled={savingName}
                    className="rounded-md border border-gray-600 px-2 py-1 text-xs font-bold text-gray-300 hover:bg-gray-700 transition"
                    title="ביטול (Esc)"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1 min-w-0">
                  <p className="font-bold text-white truncate">{team.name}</p>
                  <button
                    onClick={() => startEditName(team)}
                    className="shrink-0 rounded-md border border-gray-600 px-1.5 py-0.5 text-[11px] text-gray-400 hover:text-white hover:border-orange-500/60 hover:bg-orange-500/10 transition"
                    title="ערוך שם"
                  >
                    ✏️
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 mb-2">
                {team.logo_url ? '✅ יש לוגו' : '❌ אין לוגו'}
              </p>

              {/* Hidden file input */}
              <input
                ref={(el) => { inputRefs.current[team.id] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(team, file);
                  e.target.value = '';
                }}
              />

              <button
                onClick={() => inputRefs.current[team.id]?.click()}
                disabled={uploading === team.id}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition"
              >
                {uploading === team.id ? 'מעלה...' : team.logo_url ? '🔄 החלף לוגו' : '⬆️ העלה לוגו'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
