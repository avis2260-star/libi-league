'use client';

import { useState, useRef } from 'react';
import type { Team } from '@/types';

type PlayerRow = {
  id: string;
  name: string;
  jersey_number: number | null;
  position: string | null;
  team_id: string | null;
  photo_url: string | null;
};

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export default function PlayersTab({ teams, players }: { teams: Team[]; players: PlayerRow[] }) {
  const [list, setList]           = useState<PlayerRow[]>(players);
  const [name, setName]           = useState('');
  const [teamId, setTeamId]       = useState('');
  const [jersey, setJersey]       = useState('');
  const [position, setPosition]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

  // Photo upload
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collapsible teams — store which team IDs are open
  const [openTeams, setOpenTeams] = useState<Set<string>>(new Set());

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !teamId) return;
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
          photo_url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setList((prev) => [...prev, data.player]);
      // Auto-open the team the player was added to
      setOpenTeams((prev) => new Set(prev).add(teamId));
      setName(''); setJersey(''); setPosition('');
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

  const teamsWithPlayers = teams.filter((t) => list.some((p) => p.team_id === t.id));

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
            <label className="mb-1 block text-xs text-gray-400">שם מלא *</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ישראל ישראלי"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              required
            />
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
        </div>

        {/* Photo upload */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">תמונת שחקן (אופציונלי)</label>
          <div className="flex items-center gap-4">
            {/* Preview */}
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
                    <span className={`text-lg transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}>
                      ›
                    </span>
                    <span className="font-bold text-orange-400 group-hover:text-orange-300">
                      {team.name}
                    </span>
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
                        <th className="px-4 py-2 text-center">מחיקה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPlayers.map((p, idx) => (
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
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
