import { NextResponse } from 'next/server';

// Pull the libi-league Web Analytics summary from Vercel's API. Cached
// for 10 minutes via Next's fetch revalidate so we don't hammer the
// API on every admin page-load.

const TEAM_SLUG    = 'avis2260-6714s-projects';
const PROJECT_NAME = 'libi-league';

// 7-day rolling window — matches the default range shown in vercel.com.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type EndpointResult = { ok: boolean; status: number; data?: unknown; raw?: string };

async function fetchVercel<T = unknown>(
  path: string,
  token: string,
  revalidateSec: number,
): Promise<EndpointResult & { json?: T }> {
  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: revalidateSec },
  });
  const ok = res.ok;
  const status = res.status;
  if (!ok) {
    const raw = await res.text().catch(() => '');
    return { ok, status, raw };
  }
  const json = (await res.json()) as T;
  return { ok, status, data: json, json };
}

export async function GET() {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'TOKEN_MISSING', hint: 'הוסף VERCEL_API_TOKEN בהגדרות Vercel.' },
      { status: 503 },
    );
  }

  const fromMs = Date.now() - WINDOW_MS;
  const toMs   = Date.now();

  try {
    // Step 1 — resolve the team id from the slug (cached 1 day, never changes).
    const teamRes = await fetchVercel<{ id: string; name: string }>(
      `/v2/teams/${TEAM_SLUG}`,
      token,
      24 * 3600,
    );
    if (!teamRes.ok || !teamRes.json) {
      return NextResponse.json(
        { ok: false, stage: 'team', status: teamRes.status, raw: teamRes.raw },
        { status: 502 },
      );
    }
    const teamId = teamRes.json.id;

    // Step 2 — resolve the project id from its name (also cached 1 day).
    const projRes = await fetchVercel<{ id: string; name: string }>(
      `/v9/projects/${PROJECT_NAME}?teamId=${teamId}`,
      token,
      24 * 3600,
    );
    if (!projRes.ok || !projRes.json) {
      return NextResponse.json(
        { ok: false, stage: 'project', status: projRes.status, raw: projRes.raw },
        { status: 502 },
      );
    }
    const projectId = projRes.json.id;

    // Step 3 — fetch the insights. Vercel's Web Analytics REST surface
    // isn't fully stable for external callers, so we probe a few endpoint
    // shapes in parallel and pass back whatever returns 200. The card
    // adapts to whichever fields exist.
    const baseQ = `?projectId=${projectId}&teamId=${teamId}&from=${fromMs}&to=${toMs}`;
    const [stats, paths, referrers] = await Promise.all([
      fetchVercel(`/web-analytics/insights/stats${baseQ}`, token, 600),
      fetchVercel(`/web-analytics/insights/paths${baseQ}&limit=10`, token, 600),
      fetchVercel(`/web-analytics/insights/referrers${baseQ}&limit=5`, token, 600),
    ]);

    return NextResponse.json({
      ok: true,
      teamId,
      projectId,
      from: fromMs,
      to: toMs,
      stats,
      paths,
      referrers,
      dashboardUrl: `https://vercel.com/${TEAM_SLUG}/${PROJECT_NAME}/analytics`,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
