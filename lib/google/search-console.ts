import type { SearchConsolePageRow, SearchConsoleQueryRow } from "@/types/database";

async function googleFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Search Console API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listSearchConsoleSites(
  accessToken: string
): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const data = await googleFetch("https://www.googleapis.com/webmasters/v3/sites", accessToken);
  return (data.siteEntry ?? []).map((s: { siteUrl: string; permissionLevel: string }) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));
}

interface SearchConsoleSnapshotResult {
  siteUrl: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: SearchConsoleQueryRow[];
  topPages: SearchConsolePageRow[];
}

async function query(accessToken: string, siteUrl: string, body: Record<string, unknown>) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  return googleFetch(endpoint, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchSearchConsoleSnapshot(
  accessToken: string,
  siteUrl: string,
  days = 28
): Promise<SearchConsoleSnapshotResult> {
  const end = new Date();
  end.setDate(end.getDate() - 3); // Search Console data has a ~2-3 day lag
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const [totals, byQuery, byPage] = await Promise.all([
    query(accessToken, siteUrl, { startDate, endDate }),
    query(accessToken, siteUrl, { startDate, endDate, dimensions: ["query"], rowLimit: 25 }),
    query(accessToken, siteUrl, { startDate, endDate, dimensions: ["page"], rowLimit: 25 }),
  ]);

  const totalsRow = totals.rows?.[0];

  return {
    siteUrl,
    dateRangeStart: startDate,
    dateRangeEnd: endDate,
    totalClicks: totalsRow?.clicks ?? 0,
    totalImpressions: totalsRow?.impressions ?? 0,
    avgCtr: totalsRow?.ctr ?? 0,
    avgPosition: totalsRow?.position ?? 0,
    topQueries: (byQuery.rows ?? []).map(
      (r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })
    ),
    topPages: (byPage.rows ?? []).map((r: { keys: string[]; clicks: number; impressions: number }) => ({
      page: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
    })),
  };
}
