'use client';

import { useState, useRef } from 'react';

type TeamRow = {
  id: string;
  name: string;
  logo_url: string | null;
  captain_name: string | null;
  contact_info: string | null;
  division: string | null;
  // false = withdrawn from the league (hidden from the live season, kept in DB).
  // Undefined on rows fetched before the column existed → treated as active.
  active?: boolean;
};

// UI labels for the two standings divisions. The stored value is the English
// 'North'/'South' that the standings rows and Excel sync use.
const DIVISION_LABELS: Record<string, string> = { North: 'צפון', South: 'דרום' };

export default function TeamsTab({ teams: initial }: { teams: TeamRow[] }) {
  const [teams, setTeams] = useState<TeamRow[]>(initial);
  const [uploading, setUploading] = useState<string | null>(null); // team id being uploaded
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Inline name editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Per-team division save state (id currently being saved)
  const [savingDivision, setSavingDivision] = useState<string | null>(null);

  // Per-team head-of-team / coach (captain_name) editing. Drafts are keyed by
  // team id so each card edits independently; only diverging drafts are saved.
  const [captainDrafts, setCaptainDrafts] = useState<Record<string, string>>({});
  const [savingCaptain, setSavingCaptain] = useState<string | null>(null);

  // Per-team delete state (id currently being deleted)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Per-team withdraw/reinstate state (id currently being toggled)
  const [savingActive, setSavingActive] = useState<string | null>(null);

  // Add-team form state
  const [newName, setNewName] = useState('');
  const [newDivision, setNewDivision] = useState('');
  const [newCaptain, setNewCaptain] = useState('');
  const [adding, setAdding] = useState(false);

  // The current value shown in a team's captain field: its live draft if the
  // admin has started typing, otherwise the stored captain_name.
  function captainValue(team: TeamRow): string {
    return captainDrafts[team.id] ?? team.captain_name ?? '';
  }

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

  async function saveDivision(team: TeamRow, division: string) {
    const value = division || null;
    setSavingDivision(team.id);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: team.id, division: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בעדכון המחוז');
      setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, division: value } : t)));
      setMsg({
        ok: true,
        text: value
          ? `✅ ${team.name} שויכה למחוז ${DIVISION_LABELS[value]}`
          : `✅ הוסר שיוך המחוז של ${team.name}`,
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setSavingDivision(null);
    }
  }

  async function saveCaptain(team: TeamRow) {
    const value = captainValue(team).trim();
    if (value === (team.captain_name ?? '').trim()) {
      // Nothing changed — drop the draft so the field falls back to stored.
      setCaptainDrafts((prev) => {
        const next = { ...prev };
        delete next[team.id];
        return next;
      });
      return;
    }
    setSavingCaptain(team.id);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: team.id, captain_name: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בעדכון ראש הקבוצה');
      setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, captain_name: value } : t)));
      setCaptainDrafts((prev) => {
        const next = { ...prev };
        delete next[team.id];
        return next;
      });
      setMsg({
        ok: true,
        text: value
          ? `✅ ראש הקבוצה / מאמן של ${team.name} עודכן ל-"${value}"`
          : `✅ הוסר ראש הקבוצה / מאמן של ${team.name}`,
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setSavingCaptain(null);
    }
  }

  async function handleDelete(team: TeamRow) {
    if (!window.confirm(`למחוק את הקבוצה "${team.name}"? פעולה זו אינה הפיכה.`)) return;
    setDeletingId(team.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/teams?id=${encodeURIComponent(team.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה במחיקת הקבוצה');
      setTeams((prev) => prev.filter((t) => t.id !== team.id));
      setMsg({ ok: true, text: `🗑️ הקבוצה "${team.name}" נמחקה` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(team: TeamRow) {
    const isActive = team.active !== false;
    const next = !isActive;
    if (isActive && !window.confirm(
      `לסמן את "${team.name}" כפרשה מהליגה? הקבוצה תוסתר מהטבלה, מרשימת הקבוצות ומלוח המשחקים של העונה הנוכחית, אך כל ההיסטוריה שלה תישמר וניתן יהיה להחזירה בכל עת.`,
    )) return;
    setSavingActive(team.id);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: team.id, active: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בעדכון סטטוס הקבוצה');
      setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, active: next } : t)));
      setMsg({
        ok: true,
        text: next
          ? `✅ ${team.name} הוחזרה לליגה`
          : `📤 ${team.name} סומנה כפרשה מהליגה (ההיסטוריה נשמרה)`,
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setSavingActive(null);
    }
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setMsg({ ok: false, text: 'שם הקבוצה חובה' });
      return;
    }
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          division: newDivision || null,
          captain_name: newCaptain.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בהוספת הקבוצה');

      setTeams((prev) => [...prev, data.team as TeamRow].sort((a, b) => a.name.localeCompare(b.name, 'he')));
      setNewName('');
      setNewDivision('');
      setNewCaptain('');
      setMsg({ ok: true, text: `✅ הקבוצה "${data.team.name}" נוספה. אפשר כעת להעלות לוגו ולהוסיף שחקנים.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setAdding(false);
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
          <h2 className="text-xl font-bold text-white">קבוצות · ליגת ליבי</h2>
        </div>
        <p className="text-sm text-gray-400">הוסף קבוצות, שייך אותן למחוז והעלה לוגו · {teams.length} קבוצות</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-2 text-sm font-medium ${msg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Add-team form */}
      <form onSubmit={handleAddTeam} className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
        <h3 className="font-semibold text-orange-400">➕ קבוצה חדשה</h3>
        <p className="text-xs text-gray-500">
          שם הקבוצה צריך להתאים לשם שמופיע בקובץ ה-Excel (הבדלי מרכאות/מקפים/רווחים מקובלים).
          בחירת מחוז דרושה כדי שהטבלה של הקבוצה תסונכרן מה-Excel.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs text-gray-400">שם הקבוצה *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="שם הקבוצה"
              maxLength={80}
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">מחוז</label>
            <select
              value={newDivision}
              onChange={(e) => setNewDivision(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="">— ללא —</option>
              <option value="North">צפון</option>
              <option value="South">דרום</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">קפטן (לא חובה)</label>
            <input
              value={newCaptain}
              onChange={(e) => setNewCaptain(e.target.value)}
              placeholder="שם הקפטן"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {adding ? 'מוסיף...' : 'הוסף קבוצה'}
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => {
          const isActive = team.active !== false;
          return (
          <div
            key={team.id}
            className={`flex items-center gap-4 rounded-xl border p-4 ${
              isActive ? 'border-gray-700 bg-gray-900' : 'border-yellow-600/40 bg-yellow-900/10 opacity-80'
            }`}
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
                  {!isActive && (
                    <span className="shrink-0 rounded-md bg-yellow-500/15 px-1.5 py-0.5 text-[11px] font-bold text-yellow-300" title="הקבוצה מוסתרת מהעונה הנוכחית">
                      פרשה מהליגה
                    </span>
                  )}
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

              {/* Division selector */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">מחוז:</span>
                <select
                  value={team.division ?? ''}
                  onChange={(e) => saveDivision(team, e.target.value)}
                  disabled={savingDivision === team.id}
                  className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-orange-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">— ללא —</option>
                  <option value="North">צפון</option>
                  <option value="South">דרום</option>
                </select>
                {savingDivision === team.id && <span className="text-xs text-gray-500">שומר…</span>}
              </div>

              {/* Head of team / coach (captain_name) */}
              <div className="mb-2 flex items-center gap-2">
                <span className="shrink-0 text-xs text-gray-500">ראש קבוצה / מאמן:</span>
                <input
                  type="text"
                  value={captainValue(team)}
                  onChange={(e) => setCaptainDrafts((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  onBlur={() => saveCaptain(team)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                  }}
                  disabled={savingCaptain === team.id}
                  maxLength={80}
                  placeholder="שם ראש הקבוצה / המאמן"
                  className="min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none disabled:opacity-50"
                />
                {savingCaptain === team.id && <span className="shrink-0 text-xs text-gray-500">שומר…</span>}
              </div>

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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => inputRefs.current[team.id]?.click()}
                  disabled={uploading === team.id}
                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {uploading === team.id ? 'מעלה...' : team.logo_url ? '🔄 החלף לוגו' : '⬆️ העלה לוגו'}
                </button>
                <button
                  onClick={() => toggleActive(team)}
                  disabled={savingActive === team.id}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                    isActive
                      ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 hover:text-yellow-200'
                      : 'border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 hover:text-green-200'
                  }`}
                  title={isActive ? 'סמן כפרשה מהליגה (מסתיר מהעונה, שומר היסטוריה)' : 'החזר את הקבוצה לליגה'}
                >
                  {savingActive === team.id
                    ? 'שומר...'
                    : isActive
                      ? '📤 פרשה מהליגה'
                      : '↩️ החזר לליגה'}
                </button>
                <button
                  onClick={() => handleDelete(team)}
                  disabled={deletingId === team.id}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/20 hover:text-red-200 disabled:opacity-50 transition"
                  title="מחק קבוצה לצמיתות (כולל המשחקים שלה)"
                >
                  {deletingId === team.id ? 'מוחק...' : '🗑️ מחק'}
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
