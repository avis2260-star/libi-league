'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Team } from '@/types';

const PlayerImageModal = dynamic(() => import('./PlayerImageModal'), { ssr: false });

type PlayerRow = {
  id: string;
  name: string;
  jersey_number: number | null;
  position: string | null;
  team_id: string | null;
  photo_url: string | null;
  date_of_birth?: string | null;
  is_active?: boolean;
};

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export default function PlayersTab({ teams, players }: { teams: Team[]; players: PlayerRow[] }) {
  const [list, setList]           = useState<PlayerRow[]>(players);
  const [name, setName]           = useState('');
  const [teamId, setTeamId]       = useState('');
  const [jersey, setJersey]       = useState('');
  const [position, setPosition]   = useState('');
  const [dob, setDob]             = useState('');
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

  // Photo upload (add form)
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collapsible teams
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());

  // Edit image modal
  const [editTarget, setEditTarget] = useState<PlayerRow | null>(null);

  // Inline edit state
  type EditDraft = { name: string; jersey: string; position: string; team_id: string; dob: string };
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editDraft, setEditDraft]   = useState<EditDraft>({ name: '', jersey: '', position: '', team_id: '', dob: '' });
  const [editSaving, setEditSaving] = useState(false);

  function startEdit(p: PlayerRow) {
    setEditingId(p.id);
    setEditDraft({
      name:     p.name,
      jersey:   p.jersey_number != null ? String(p.jersey_number) : '',
      position: p.position ?? '',
      team_id:  p.team_id ?? '',
      dob:      p.date_of_birth ?? '',
    });
  }

  function cancelEdit() { setEditingId(null); }

  async function saveEdit(id: string) {
    setEditSaving(true);
    try {
      const res = await fetch('/api/admin/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name:           editDraft.name.trim() || undefined,
          jersey_number:  editDraft.jersey !== '' ? parseInt(editDraft.jersey) : null,
          position:       editDraft.position || null,
          team_id:        editDraft.team_id || undefined,
          date_of_birth:  editDraft.dob || null,
        }),
      });
      if (!res.ok) throw new Error('עדכון נכשל');
      setList((prev) => prev.map((p) =>
        p.id !== id ? p : {
          ...p,
          name:           editDraft.name.trim() || p.name,
          jersey_number:  editDraft.jersey !== '' ? parseInt(editDraft.jersey) : null,
          position:       editDraft.position || null,
          team_id:        editDraft.team_id || p.team_id,
          date_of_birth:  editDraft.dob || null,
        },
      ));
      setMsg({ ok: true, text: '✅ השחקן עודכן בהצלחה' });
      setEditingId(null);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setEditSaving(false);
    }
  }

  function toggleTeam(id: string) {
    setOpenTeams((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return null;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', photoFile);
      const res = await fetch('/api/admin/players/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      return data.url as string;
    } finally {
      setUploading(false);
    }
  }

  // Max date of birth allowed — must be at least 16 years old
  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 16);
    return d.toISOString().split('T')[0];
  })();

  function isUnder16(dateStr: string): boolean {
    if (!dateStr) return false;
    const birth = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 16);
    return birth > cutoff;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !teamId) return;
    if (dob && isUnder16(dob)) {
      setMsg({ ok: false, text: '⛔ לא ניתן להוסיף שחקן מתחת לגיל 16' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const photo_url = await uploadPhoto();
      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          team_id: teamId,
          jersey_number: jersey ? parseInt(jersey) : null,
          position: position || null,
          date_of_birth: dob || null,
          photo_url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => [...prev, data.player]);
      setOpenTeams((prev) => new Set(prev).add(teamId));
      setName(''); setJersey(''); setPosition(''); setDob('');
      setPhotoFile(null); setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Active / Inactive toggle
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleActive(id: string, currentActive: boolean) {
    setTogglingId(id);
    try {
      const res = await fetch('/api/admin/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      if (!res.ok) throw new Error('עדכון נכשל');
      setList((prev) => prev.map((p) => p.id === id ? { ...p, is_active: !currentActive } : p));
      setMsg({ ok: true, text: !currentActive ? `✅ ${list.find(p=>p.id===id)?.name} סומן כפעיל` : `⚠️ ${list.find(p=>p.id===id)?.name} סומן כלא פעיל` });
    } catch {
      setMsg({ ok: false, text: 'עדכון סטטוס נכשל' });
    } finally {
      setTogglingId(null);
    }
  }

  function handleImageSuccess(playerId: string, newUrl: string) {
    setList((prev) => prev.map((p) => p.id === playerId ? { ...p, photo_url: newUrl } : p));
    setMsg({ ok: true, text: '✅ תמונת השחקן עודכנה!' });
  }

  async function handleDeletePhoto(id: string, playerName: string) {
    if (!confirm(`למחוק את התמונה של ${playerName}?`)) return;
    try {
      const res = await fetch('/api/admin/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, photo_url: null }),
      });
      if (!res.ok) throw new Error('Failed');
      setList((prev) => prev.map((p) => p.id === id ? { ...p, photo_url: null } : p));
      setMsg({ ok: true, text: `🗑 תמונת ${playerName} נמחקה` });
    } catch {
      setMsg({ ok: false, text: 'מחיקת תמונה נכשלה' });
    }
  }

  const teamsWithPlayers = teams.filter((t) => list.some((p) => p.team_id === t.id));

  // Duplicate name detection — match any existing player whose name contains the typed text (case-insensitive, min 2 chars)
  const nameTrimmed = name.trim();
  const duplicateMatches = nameTrimmed.length >= 2
    ? list.filter((p) => p.name.toLowerCase().includes(nameTrimmed.toLowerCase()))
    : [];
  const isExactDuplicate = duplicateMatches.some(
    (p) => p.name.toLowerCase() === nameTrimmed.toLowerCase(),
  );

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">ניהול שחקנים</h2>
        <p className="text-sm text-gray-400">הוסף שחקנים לקבוצות · {list.length} שחקנים רשומים</p>
      </div>

      {/* ── Add player form ─────────────────────────────────────────── */}
      <form onSubmit={handleAdd} className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 space-y-4">
        <h3 className="font-semibold text-orange-400">➕ הוסף שחקן חדש</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-400 flex items-center gap-1">
              שם מלא *
              {isExactDuplicate && (
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs font-bold text-red-400">! שם קיים</span>
              )}
              {!isExactDuplicate && duplicateMatches.length > 0 && (
                <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs font-bold text-yellow-400">⚠ דומה לשחקן קיים</span>
              )}
            </label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ישראל ישראלי"
              className={`w-full rounded-lg border bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none ${
                isExactDuplicate
                  ? 'border-red-500 focus:border-red-400'
                  : duplicateMatches.length > 0
                  ? 'border-yellow-500 focus:border-yellow-400'
                  : 'border-gray-700 focus:border-orange-500'
              }`}
              required
            />
            {duplicateMatches.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {duplicateMatches.slice(0, 3).map((p) => (
                  <li key={p.id} className="text-xs text-yellow-400/80">
                    ↳ {p.name} ({teams.find((t) => t.id === p.team_id)?.name ?? '?'})
                  </li>
                ))}
                {duplicateMatches.length > 3 && (
                  <li className="text-xs text-gray-500">ועוד {duplicateMatches.length - 3}…</li>
                )}
              </ul>
            )}
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
          <div>
            <label className="mb-1 block text-xs text-gray-400 flex items-center gap-1">
              תאריך לידה
              <span className="text-gray-500">(גיל מינימלי: 16)</span>
            </label>
            <input
              type="date"
              value={dob} onChange={(e) => setDob(e.target.value)}
              max={maxDob}
              className={`w-full rounded-lg border bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark] ${
                dob && isUnder16(dob)
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-gray-700 focus:border-orange-500'
              }`}
            />
            {dob && isUnder16(dob) && (
              <p className="mt-1 text-xs text-red-400">⛔ השחקן חייב להיות בן 16 לפחות</p>
            )}
          </div>
        </div>

        {/* Photo upload */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">תמונת שחקן (אופציונלי)</label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-gray-600 bg-gray-800 flex items-center justify-center">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl text-gray-600">👤</span>
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="block w-full text-sm text-gray-400
                  file:mr-3 file:rounded-lg file:border-0
                  file:bg-gray-700 file:px-3 file:py-1.5
                  file:text-xs file:font-medium file:text-gray-300
                  hover:file:bg-gray-600 cursor-pointer"
              />
              {photoFile && (
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="mt-1 text-xs text-red-400 hover:text-red-300"
                >
                  ✕ הסר תמונה
                </button>
              )}
            </div>
          </div>
        </div>

        {msg && (
          <p className={`rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
            {msg.text}
          </p>
        )}

        <button
          type="submit" disabled={saving || uploading}
          className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {uploading ? 'מעלה תמונה...' : saving ? 'שומר...' : 'הוסף שחקן'}
        </button>
      </form>

      {/* ── Players list — grouped by team, collapsible ─────────────── */}
      {list.length > 0 && (
        <div className="space-y-3">
          {teamsWithPlayers.map((team) => {
            const teamPlayers = list.filter((p) => p.team_id === team.id);
            const isOpen = openTeams.has(team.id);

            return (
              <div key={team.id} className="rounded-xl border border-gray-700 overflow-hidden">
                {/* Clickable team header */}
                <button
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className="w-full flex items-center justify-between bg-gray-800 px-4 py-3 border-b border-gray-700/50 hover:bg-gray-750 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}>›</span>
                    <span className="font-bold text-orange-400 group-hover:text-orange-300">{team.name}</span>
                  </div>
                  <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-gray-300">
                    {teamPlayers.length} שחקנים
                  </span>
                </button>

                {/* Collapsible player table */}
                {isOpen && (
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-2 w-10 text-center">מס׳</th>
                        <th className="px-4 py-2 w-14 text-center">תמונה</th>
                        <th className="px-4 py-2">שם</th>
                        <th className="px-4 py-2 text-center">#</th>
                        <th className="px-4 py-2 text-center">פוזיציה</th>
                        <th className="px-4 py-2 text-center">ת. לידה</th>
                        <th className="px-4 py-2 text-center">קבוצה</th>
                        <th className="px-4 py-2 text-center">סטטוס</th>
                        <th className="px-4 py-2 text-center">תמונה / עריכה</th>
                        <th className="px-4 py-2 text-center">מחיקה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPlayers.map((p, idx) => {
                        const isEditing = editingId === p.id;
                        return isEditing ? (
                          /* ── Inline edit row ── */
                          <tr key={p.id} className="border-t border-orange-500/30 bg-orange-500/5">
                            <td className="px-4 py-2 text-center text-gray-500 font-mono text-xs">{idx + 1}</td>
                            <td className="px-4 py-2 text-center">
                              <div className="mx-auto h-9 w-9 overflow-hidden rounded-full border border-gray-700 bg-gray-800 flex items-center justify-center">
                                {p.photo_url
                                  ? <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                                  : <span className="text-base text-gray-600">👤</span>}
                              </div>
                            </td>
                            {/* Name */}
                            <td className="px-2 py-1.5">
                              <input
                                value={editDraft.name}
                                onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                                className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white focus:border-orange-500 focus:outline-none"
                              />
                            </td>
                            {/* Jersey */}
                            <td className="px-2 py-1.5 w-16">
                              <input
                                type="number" min={0} max={99}
                                value={editDraft.jersey}
                                onChange={(e) => setEditDraft((d) => ({ ...d, jersey: e.target.value }))}
                                className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white text-center focus:border-orange-500 focus:outline-none"
                              />
                            </td>
                            {/* Position */}
                            <td className="px-2 py-1.5">
                              <select
                                value={editDraft.position}
                                onChange={(e) => setEditDraft((d) => ({ ...d, position: e.target.value }))}
                                className="w-full rounded border border-gray-600 bg-gray-900 px-1 py-1 text-sm text-white focus:border-orange-500 focus:outline-none"
                              >
                                <option value="">—</option>
                                {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                              </select>
                            </td>
                            {/* Date of Birth */}
                            <td className="px-2 py-1.5 w-36">
                              <input
                                type="date"
                                value={editDraft.dob}
                                onChange={(e) => setEditDraft((d) => ({ ...d, dob: e.target.value }))}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-white focus:border-orange-500 focus:outline-none [color-scheme:dark]"
                              />
                            </td>
                            {/* Team */}
                            <td className="px-2 py-1.5">
                              <select
                                value={editDraft.team_id}
                                onChange={(e) => setEditDraft((d) => ({ ...d, team_id: e.target.value }))}
                                className="w-full rounded border border-gray-600 bg-gray-900 px-1 py-1 text-sm text-white focus:border-orange-500 focus:outline-none"
                              >
                                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            </td>
                            {/* Status in edit row — show current, can toggle */}
                            <td className="px-2 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleActive(p.id, p.is_active !== false)}
                                disabled={togglingId === p.id}
                                title="לחץ לשינוי סטטוס"
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold border transition ${
                                  p.is_active !== false
                                    ? 'bg-green-900/30 border-green-600/40 text-green-400 hover:bg-green-900/50'
                                    : 'bg-red-900/30 border-red-600/40 text-red-400 hover:bg-red-900/50'
                                }`}
                              >
                                <span className={`h-2 w-2 rounded-full ${p.is_active !== false ? 'bg-green-400' : 'bg-red-500'}`} />
                                {togglingId === p.id ? '...' : p.is_active !== false ? 'פעיל' : 'לא פעיל'}
                              </button>
                            </td>
                            {/* Save / Cancel */}
                            <td className="px-2 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => saveEdit(p.id)}
                                  disabled={editSaving}
                                  className="rounded bg-orange-500 px-2 py-0.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                                >
                                  {editSaving ? '...' : '✓ שמור'}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-600"
                                >
                                  ביטול
                                </button>
                              </div>
                            </td>
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
                        ) : (
                          /* ── Normal display row ── */
                          <tr key={p.id} className="border-t border-gray-700/50 hover:bg-gray-800/40">
                          <td className="px-4 py-2 text-center text-gray-500 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-2 text-center">
                            <div className="mx-auto h-9 w-9 overflow-hidden rounded-full border border-gray-700 bg-gray-800 flex items-center justify-center">
                              {p.photo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-base text-gray-600">👤</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 font-medium text-white">{p.name}</td>
                          <td className="px-4 py-2 text-center text-gray-400">{p.jersey_number ?? '—'}</td>
                          <td className="px-4 py-2 text-center text-gray-400">{p.position ?? '—'}</td>
                          <td className="px-4 py-2 text-center text-gray-400 text-xs">
                            {p.date_of_birth
                              ? new Date(p.date_of_birth).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="px-4 py-2 text-center text-gray-400 text-xs truncate max-w-[80px]">
                            {teams.find((t) => t.id === p.team_id)?.name ?? '—'}
                          </td>
                          {/* Status toggle */}
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleActive(p.id, p.is_active !== false)}
                              disabled={togglingId === p.id}
                              title={p.is_active !== false ? 'לחץ לסימון כלא פעיל' : 'לחץ לסימון כפעיל'}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border transition ${
                                p.is_active !== false
                                  ? 'bg-green-900/30 border-green-600/40 text-green-400 hover:bg-green-900/50'
                                  : 'bg-red-900/30 border-red-600/40 text-red-400 hover:bg-red-900/50'
                              }`}
                            >
                              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                                p.is_active !== false ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'bg-red-500'
                              }`} />
                              {togglingId === p.id ? '...' : p.is_active !== false ? 'פעיל' : 'לא פעיל'}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Edit details */}
                              <button
                                onClick={() => startEdit(p)}
                                title="ערוך פרטים"
                                className="rounded px-2 py-0.5 text-xs text-green-400 hover:bg-green-900/30"
                              >
                                ✏️
                              </button>
                              {/* Edit photo */}
                              <button
                                onClick={() => setEditTarget(p)}
                                title="העלה תמונה"
                                className="rounded px-2 py-0.5 text-xs text-blue-400 hover:bg-blue-900/30"
                              >
                                🖼️
                              </button>
                              {p.photo_url && (
                                <button
                                  onClick={() => handleDeletePhoto(p.id, p.name)}
                                  title="מחק תמונה"
                                  className="rounded px-2 py-0.5 text-xs text-orange-400 hover:bg-orange-900/30"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
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
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Image Modal ─────────────────────────────────────────── */}
      {editTarget && (
        <PlayerImageModal
          player={editTarget}
          teamLogoUrl={teams.find((t) => t.id === editTarget.team_id)?.logo_url}
          onClose={() => setEditTarget(null)}
          onSuccess={handleImageSuccess}
        />
      )}
    </div>
  );
}
