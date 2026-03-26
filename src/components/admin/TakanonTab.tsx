'use client';

import { useEffect, useRef, useState } from 'react';

interface TakanonInfo {
  url: string | null;
  filename: string | null;
  type: string | null;
  updated: string | null;
}

export default function TakanonTab() {
  const [info, setInfo] = useState<TakanonInfo>({ url: null, filename: null, type: null, updated: null });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/takanon')
      .then(r => r.json())
      .then(setInfo)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/takanon', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה במחיקה');
      setInfo({ url: null, filename: null, type: null, updated: null });
      setMsg({ ok: true, text: '🗑 הקובץ נמחק בהצלחה' });
      setConfirmDelete(false);
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/takanon', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה בהעלאה');
      setInfo({ url: data.url, filename: data.filename, type: data.filename?.split('.').pop() ?? null, updated: new Date().toISOString() });
      setMsg({ ok: true, text: `✅ הקובץ "${data.filename}" הועלה בהצלחה` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'שגיאה' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  }

  function fileIcon(type: string | null) {
    if (type === 'pdf')  return '📄';
    if (type === 'docx') return '📝';
    if (type === 'txt')  return '📃';
    return '📎';
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-right">
        <h2 className="text-2xl font-bold text-white">תקנון הליגה</h2>
        <p className="mt-1 text-sm text-gray-400">העלה קובץ תקנון — PDF, Word (.docx) או טקסט (.txt)</p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
          dragOver
            ? 'border-orange-400 bg-orange-500/10'
            : 'border-gray-600 bg-gray-800/50 hover:border-orange-500/60 hover:bg-gray-800'
        }`}
      >
        <div className="text-5xl mb-3">📂</div>
        <p className="text-white font-semibold">גרור קובץ לכאן או לחץ לבחירה</p>
        <p className="mt-1 text-sm text-gray-400">PDF · DOCX · TXT</p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={onFileChange}
          className="hidden"
        />
        {uploading && (
          <p className="mt-3 text-orange-400 animate-pulse font-medium">מעלה קובץ...</p>
        )}
      </div>

      {/* Message */}
      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium text-right ${
          msg.ok ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Current file */}
      {loading ? (
        <p className="text-center text-gray-500">טוען...</p>
      ) : info.url ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 text-right space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <a
                href={info.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 transition"
              >
                פתח קובץ ↗
              </a>

              {/* Delete button / confirm */}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg border border-red-700 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/15 transition"
                >
                  🗑 מחק
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-400 font-medium">בטוח?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50"
                  >
                    {deleting ? 'מוחק...' : 'כן, מחק'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-400 hover:text-white transition"
                  >
                    ביטול
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="font-semibold text-white">
                {fileIcon(info.type)} {info.filename}
              </p>
              {info.updated && (
                <p className="text-xs text-gray-400 mt-0.5">עודכן: {formatDate(info.updated)}</p>
              )}
            </div>
          </div>

          {/* Preview for PDF */}
          {info.type === 'pdf' && (
            <div className="mt-4 rounded-lg overflow-hidden border border-gray-700">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(info.url)}&embedded=true`}
                className="w-full h-[600px] bg-white"
                title="תקנון"
              />
            </div>
          )}

          {/* Preview for DOCX via Google Viewer */}
          {info.type === 'docx' && (
            <div className="mt-4 rounded-lg overflow-hidden border border-gray-700">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(info.url)}&embedded=true`}
                className="w-full h-[600px] bg-white"
                title="תקנון"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-8 text-center text-gray-500">
          לא הועלה תקנון עדיין
        </div>
      )}
    </div>
  );
}
