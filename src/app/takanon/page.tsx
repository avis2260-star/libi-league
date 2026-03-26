export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';

async function getTakanon() {
  const { data } = await supabaseAdmin
    .from('league_settings')
    .select('key,value')
    .in('key', ['takanon_url', 'takanon_filename', 'takanon_type', 'takanon_updated']);

  const map: Record<string, string> = {};
  for (const row of (data ?? [])) map[row.key] = row.value;

  return {
    url:      map['takanon_url']      ?? null,
    filename: map['takanon_filename'] ?? null,
    type:     map['takanon_type']     ?? null,
    updated:  map['takanon_updated']  ?? null,
  };
}

export default async function TakanonPage() {
  const takanon = await getTakanon();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="text-right">
        <h1 className="text-3xl font-black text-white">תקנון הליגה</h1>
        <p className="mt-1 text-sm text-gray-400">כללים ותקנות ליגת ליבי לכדורסל</p>
        {takanon.updated && (
          <p className="mt-0.5 text-xs text-gray-500">
            עודכן לאחרונה:{' '}
            {new Date(takanon.updated).toLocaleDateString('he-IL', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })}
          </p>
        )}
      </div>

      {takanon.url ? (
        <div className="space-y-4">
          {/* Download button */}
          <div className="flex justify-end">
            <a
              href={takanon.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 transition"
            >
              ⬇ הורד תקנון
            </a>
          </div>

          {/* Inline viewer for PDF and DOCX */}
          {(takanon.type === 'pdf' || takanon.type === 'docx') && (
            <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl">
              <iframe
                src={
                  takanon.type === 'pdf'
                    ? takanon.url
                    : `https://docs.google.com/viewer?url=${encodeURIComponent(takanon.url)}&embedded=true`
                }
                className="w-full h-[80vh] bg-white"
                title="תקנון הליגה"
              />
            </div>
          )}

          {/* TXT fallback */}
          {takanon.type === 'txt' && (
            <div className="rounded-xl border border-white/10 bg-gray-800/60 p-6 text-right text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
              לחץ על &quot;הורד תקנון&quot; לצפייה בתוכן המלא
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-gray-800/40 p-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-400 text-lg">התקנון טרם הועלה</p>
          <p className="text-gray-600 text-sm mt-1">חזור מאוחר יותר</p>
        </div>
      )}
    </div>
  );
}
