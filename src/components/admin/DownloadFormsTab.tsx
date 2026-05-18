'use client';

import { useEffect, useRef, useState } from 'react';

type DownloadForm = {
  id: string;
  label: string;
  filename: string;
  file_url: string;
  file_type: string | null;
  size_bytes: number | null;
  sort_order: number;
  created_at: string;
};

function fileIcon(type: string | null | undefined): string {
  switch ((type ?? '').toLowerCase()) {
    case 'pdf':           return '📄';
    case 'docx': case 'doc':  return '📝';
    case 'xlsx': case 'xls':  return '📊';
    case 'txt':           return '📃';
    case 'jpg': case 'jpeg': case 'png': return '🖼️';
    default:              return '📎';
  }
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DownloadFormsTab() {
  const [forms, setForms]     = useState<DownloadForm[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [label, setLabel]         = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [file, setFile]           = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Delete confirmation per row
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    fetch('/api/admin/download-forms')
      .then((r) => r.json())
      .then((d) => setForms(d.forms ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!label.trim()) {
      setMsg({ ok: false, text: '⛔ חובה להזין שם תצוגה לקובץ' });
      return;
    }
    if (!file) {
      setMsg({ ok: false, text: '⛔ חובה לבחור קובץ' });
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', label.trim());
      fd.append('sort_order', sortOrder || '0');

      const res = await fetch('/api/admin/download-forms', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');

      setForms((prev) => [data.form, ...prev]);
      setLabel(''); setSortOrder('0'); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setMsg({ ok: true, text: `✅ הקובץ "${data.form.label}" הועלה בהצלחה` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/download-forms?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'מחיקה נכשלה');
      setForms((prev) => prev.filter((f) => f.id !== id));
      setMsg({ ok: true, text: '🗑 הקובץ נמחק' });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-white">טפסים להורדה</h2>
        <p className="mt-1 text-sm font-bold text-[#8aaac8]">
          העלה טפסים שיהיו זמינים להורדה למשתמשי האתר בעמוד /forms.
        </p>
      </div>

      {/* Upload form */}
      <form onSubmit={handleUpload} className="rounded-2xl border border-white/[0.07] bg-[#0c1825] p-5 space-y-4">
        <h3 className="text-base font-black text-white">הוסף טופס חדש</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Label */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-[#8aaac8]">שם תצוגה *</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="לדוגמה: טופס רישום לעונה 2025-2026"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-white placeholder:text-[#3a5a7a] focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Sort order */}
          <div>
            <label className="mb-1 block text-xs font-bold text-[#8aaac8]">סדר תצוגה</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-white text-center focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <p className="mt-0.5 text-[10px] font-bold text-[#5a7a9a]">נמוך = למעלה ברשימה</p>
          </div>
        </div>

        {/* File picker */}
        <div>
          <label className="mb-1 block text-xs font-bold text-[#8aaac8]">קובץ *</label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-[#8aaac8] file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500/15 file:px-4 file:py-2 file:text-sm file:font-black file:text-orange-400 hover:file:bg-orange-500/25 file:cursor-pointer"
          />
          <p className="mt-0.5 text-[10px] font-bold text-[#5a7a9a]">
            PDF · DOCX · XLSX · TXT · JPG / PNG · עד 25MB
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-black text-white transition hover:bg-orange-400 active:scale-95 disabled:opacity-60"
          >
            {uploading ? 'מעלה...' : '⬆️ העלה'}
          </button>
        </div>

        {msg && (
          <p className={`text-sm font-black ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>
            {msg.text}
          </p>
        )}
      </form>

      {/* Existing files list */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0c1825] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-base font-black text-white">קבצים קיימים</h3>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-black text-[#c8d8e8]">
            {forms.length}
          </span>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm font-bold text-[#8aaac8]">טוען...</p>
        ) : forms.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm font-bold text-[#8aaac8]">עדיין לא הועלו טפסים.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {forms.map((form) => {
              const size = formatSize(form.size_bytes);
              const isConfirming = confirmDelete === form.id;
              const isDeleting   = deleting === form.id;
              return (
                <div key={form.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="shrink-0 text-2xl">{fileIcon(form.file_type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">{form.label}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-[#8aaac8]">
                      <span dir="ltr" className="font-mono">{form.filename}</span>
                      {size && <> · {size}</>}
                      {form.file_type && <> · {form.file_type.toUpperCase()}</>}
                      <> · #{form.sort_order}</>
                    </p>
                  </div>
                  <a
                    href={form.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-[#c8d8e8] hover:bg-white/[0.08] transition"
                  >
                    פתח ↗
                  </a>
                  {!isConfirming ? (
                    <button
                      onClick={() => setConfirmDelete(form.id)}
                      className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-1.5 text-xs font-black text-red-400 hover:bg-red-500/15 transition"
                    >
                      🗑
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleDelete(form.id)}
                        disabled={isDeleting}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-black text-white hover:bg-red-400 disabled:opacity-60 transition"
                      >
                        {isDeleting ? 'מוחק...' : 'כן, מחק'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-[#8aaac8] hover:text-white transition"
                      >
                        ביטול
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
