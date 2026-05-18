export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLang, st } from '@/lib/get-lang';

type DownloadForm = {
  id: string;
  label: string;
  filename: string;
  file_url: string;
  file_type: string | null;
  size_bytes: number | null;
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

export default async function FormsPage() {
  const [{ data }, lang] = await Promise.all([
    supabaseAdmin
      .from('download_forms')
      .select('id, label, filename, file_url, file_type, size_bytes, created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    getLang(),
  ]);
  const T = (he: string) => st(he, lang);
  const forms = (data ?? []) as DownloadForm[];
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  return (
    <div dir={dir} className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white font-heading">{T('טפסים להורדה')}</h1>
        <p className="mt-1 text-sm font-bold text-[#8aaac8]">
          {forms.length > 0
            ? `${forms.length} ${T('טפסים זמינים')}`
            : T('אין טפסים זמינים כרגע')}
        </p>
      </div>

      {/* Empty state */}
      {forms.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-16 text-center">
          <p className="text-5xl mb-3">📂</p>
          <p className="text-sm font-bold text-[#8aaac8]">{T('עדיין לא הועלו טפסים.')}</p>
          <p className="mt-1 text-xs font-bold text-[#5a7a9a]">{T('בקרוב יתווספו טפסים ניתנים להורדה.')}</p>
        </div>
      ) : (
        /* File list */
        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1825] overflow-hidden divide-y divide-white/[0.06]">
          {forms.map((form) => {
            const size = formatSize(form.size_bytes);
            return (
              <a
                key={form.id}
                href={form.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={form.filename}
                className="group flex items-center gap-4 px-5 py-4 transition hover:bg-orange-500/[0.04]"
              >
                <span className="shrink-0 text-3xl">{fileIcon(form.file_type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-white group-hover:text-orange-400 transition-colors">
                    {form.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-bold text-[#8aaac8]">
                    <span dir="ltr" className="font-mono">{form.filename}</span>
                    {size && <> · {size}</>}
                    {form.file_type && <> · {form.file_type.toUpperCase()}</>}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-black text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <span>{T('הורדה')}</span>
                  <span className="text-sm">↓</span>
                </span>
              </a>
            );
          })}
        </div>
      )}

      {/* Note */}
      <p className="text-xs font-bold text-[#5a7a9a] text-center">
        {T('הקבצים נפתחים בלשונית חדשה. אם הדפדפן לא הוריד אוטומטית, שמור עם קליק ימני → שמירה בשם.')}
      </p>
    </div>
  );
}
