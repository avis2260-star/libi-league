'use client';

import { useEffect, useState } from 'react';

// Shape of what /api/admin/analytics-summary returns. Endpoints are
// probed — fields are best-effort; renderer handles missing pieces.
type ApiResponse = {
  ok: boolean;
  teamId?: string;
  projectId?: string;
  from?: number;
  to?: number;
  stats?:     { ok: boolean; status: number; data?: unknown };
  paths?:     { ok: boolean; status: number; data?: unknown };
  referrers?: { ok: boolean; status: number; data?: unknown };
  dashboardUrl?: string;
  generatedAt?: string;
  error?: string;
  hint?: string;
  stage?: string;
  status?: number;
  raw?: string;
};

// Best-effort field extraction. Vercel's analytics API isn't fully
// public so the field shape isn't guaranteed; these helpers walk a
// few likely paths and pick the first that yields a number.
type Bag = Record<string, unknown>;
function asBag(v: unknown): Bag | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Bag) : null;
}
function getNum(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (typeof c === 'string' && c.trim() !== '' && !Number.isNaN(Number(c))) return Number(c);
  }
  return null;
}
function pickTotalVisitors(stats: unknown): number | null {
  const bag = asBag(stats);
  if (!bag) return null;
  return getNum(bag.visitors, (asBag(bag.totals) ?? {}).visitors, bag.uniqueVisitors);
}
function pickTotalViews(stats: unknown): number | null {
  const bag = asBag(stats);
  if (!bag) return null;
  return getNum(bag.pageViews, bag.views, (asBag(bag.totals) ?? {}).pageViews, (asBag(bag.totals) ?? {}).views);
}
function pickBounceRate(stats: unknown): number | null {
  const bag = asBag(stats);
  if (!bag) return null;
  const v = getNum(bag.bounceRate, (asBag(bag.totals) ?? {}).bounceRate);
  return v == null ? null : v;
}

// Top-N list extractor: many shapes possible — { data: [...] } or just an array.
function pickList(v: unknown): { label: string; value: number }[] {
  const arr = Array.isArray(v) ? v : asBag(v)?.data;
  if (!Array.isArray(arr)) return [];
  return (arr as unknown[]).map((row) => {
    const r = asBag(row) ?? {};
    const label = String(r.path ?? r.referrer ?? r.host ?? r.name ?? r.key ?? '—');
    const value = getNum(r.visitors, r.views, r.count, r.pageViews) ?? 0;
    return { label, value };
  }).filter((r) => r.label && r.label !== '—');
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('he-IL');
}

export default function AnalyticsTab() {
  const [data, setData]       = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetch('/api/admin/analytics-summary')
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch((err) => setData({ ok: false, error: String(err) }))
      .finally(() => setLoading(false));
  }, []);

  const dashboardUrl = data?.dashboardUrl ?? 'https://vercel.com/avis2260-6714s-projects/libi-league/analytics';

  if (loading) {
    return (
      <div dir="rtl" className="space-y-4">
        <h2 className="text-xl font-black text-white">📊 אנליטיקה</h2>
        <p className="text-sm font-bold text-[#8aaac8]">טוען נתונים...</p>
      </div>
    );
  }

  // ── Error states ────────────────────────────────────────────────────────
  if (!data?.ok) {
    return (
      <div dir="rtl" className="space-y-4">
        <h2 className="text-xl font-black text-white">📊 אנליטיקה</h2>

        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/[0.06] p-5 space-y-3">
          <p className="text-base font-black text-yellow-300">⚠️ לא הצלחנו לטעון נתוני אנליטיקה</p>
          {data?.error === 'TOKEN_MISSING' && (
            <p className="text-sm font-bold text-yellow-200">
              {data.hint ?? 'חסר VERCEL_API_TOKEN בהגדרות הסביבה ב-Vercel.'}
            </p>
          )}
          {data?.stage && (
            <p className="text-xs font-bold text-yellow-200/80">
              שלב שנכשל: <code className="font-mono">{data.stage}</code>
              {data.status && <> · status <code className="font-mono">{data.status}</code></>}
            </p>
          )}
          {data?.raw && (
            <details className="text-xs text-yellow-200/70">
              <summary className="cursor-pointer font-bold">תגובה גולמית מ-Vercel ▶</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/40 p-2 font-mono">{data.raw}</pre>
            </details>
          )}
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-black text-white hover:bg-orange-400 transition"
          >
            לוח Vercel המלא ↗
          </a>
        </div>
      </div>
    );
  }

  // ── Normalize ──────────────────────────────────────────────────────────
  const visitors    = pickTotalVisitors(data.stats?.data);
  const pageViews   = pickTotalViews(data.stats?.data);
  const bounceRate  = pickBounceRate(data.stats?.data);
  const topPages    = pickList(data.paths?.data).slice(0, 8);
  const topReferrers = pickList(data.referrers?.data).slice(0, 5);

  // Were ANY of the analytics endpoints successful?
  const anyEndpointOk = !!(data.stats?.ok || data.paths?.ok || data.referrers?.ok);
  const allEndpointsFailed = !!(data.stats && data.paths && data.referrers &&
    !data.stats.ok && !data.paths.ok && !data.referrers.ok);

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-white">📊 אנליטיקה</h2>
          <p className="text-sm font-bold text-[#8aaac8]">7 הימים האחרונים · נתונים מ-Vercel Web Analytics</p>
        </div>
        <a
          href={dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-orange-500/30 bg-orange-500/[0.06] px-3 py-1.5 text-xs font-black text-orange-400 hover:bg-orange-500/15 transition"
        >
          לוח Vercel המלא ↗
        </a>
      </div>

      {/* ── If Vercel's endpoints didn't return useful data, explain that. ── */}
      {allEndpointsFailed && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/[0.06] p-5 space-y-2">
          <p className="text-sm font-black text-yellow-300">
            ⚠️ נקודות הקצה של Vercel Web Analytics לא החזירו נתונים
          </p>
          <p className="text-xs font-bold text-yellow-200">
            שייתכן ש: (א) ה-Analytics רק עכשיו הופעל ועדיין אין מספיק תנועה, (ב) ה-API השתנה,
            או (ג) Vercel דורש סוג טוקן אחר. הלוח המלא ב-Vercel עובד מיידית — לחץ על הקישור למעלה.
          </p>
        </div>
      )}

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="מבקרים ייחודיים" value={fmt(visitors)} />
        <KpiCard label="צפיות עמוד"       value={fmt(pageViews)} />
        <KpiCard label="שיעור נטישה"     value={bounceRate != null ? `${bounceRate.toFixed(0)}%` : '—'} />
      </div>

      {/* ── Top pages / referrers ────────────────────────────────────────── */}
      {(topPages.length > 0 || topReferrers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ListCard title="העמודים הפופולריים" rows={topPages} mono />
          <ListCard title="מקורות תנועה"      rows={topReferrers} />
        </div>
      )}

      {/* ── Debug toggle (collapsed by default) ──────────────────────────── */}
      <div>
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs font-bold text-[#5a7a9a] hover:text-orange-400"
        >
          {showRaw ? '▼ הסתר תגובה גולמית' : '▶ הצג תגובה גולמית (debug)'}
        </button>
        {showRaw && (
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-white/[0.06] bg-black/40 p-3 text-[10px] font-mono text-[#8aaac8]" dir="ltr">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>

      <p className="text-[10px] font-bold text-[#5a7a9a]" dir="ltr">
        {data.generatedAt && `Fetched ${new Date(data.generatedAt).toLocaleString('he-IL')} · cached 10 min`}
        {anyEndpointOk ? '' : ' · raw endpoints returned no data yet'}
      </p>
    </div>
  );
}

// ─────────────────────────── helpers ───────────────────────────

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c1825] p-4 text-center">
      <p className="text-[10px] font-black tracking-wider text-[#8aaac8] uppercase">{label}</p>
      <p className="font-stats text-3xl font-black text-orange-400 tabular-nums mt-1">{value}</p>
    </div>
  );
}

function ListCard({ title, rows, mono }: { title: string; rows: { label: string; value: number }[]; mono?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c1825] p-4">
      <p className="text-sm font-black text-white mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs font-bold text-[#5a7a9a] py-4 text-center">אין נתונים זמינים</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`} className="flex items-center justify-between gap-3 text-sm">
              <span className={`${mono ? 'font-mono text-xs' : ''} truncate font-bold text-white`} dir={mono ? 'ltr' : undefined}>
                <span className="text-[#5a7a9a]">{i + 1}.</span> {r.label}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
                <span className="font-stats font-black text-orange-400 tabular-nums w-12 text-center">{r.value}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
