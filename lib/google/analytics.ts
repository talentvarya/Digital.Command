async function googleFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Analytics API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listAnalyticsProperties(
  accessToken: string
): Promise<{ propertyId: string; displayName: string }[]> {
  const data = await googleFetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", accessToken);
  const properties: { propertyId: string; displayName: string }[] = [];
  for (const account of data.accountSummaries ?? []) {
    for (const prop of account.propertySummaries ?? []) {
      properties.push({ propertyId: prop.property, displayName: prop.displayName });
    }
  }
  return properties;
}

interface AnalyticsSnapshotResult {
  propertyId: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  sessions: number;
  users: number;
  conversions: number;
  topPages: { page: string; sessions: number }[];
}

export async function fetchAnalyticsSnapshot(
  accessToken: string,
  propertyId: string,
  days = 28
): Promise<AnalyticsSnapshotResult> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const endpoint = `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`;

  const [totals, byPage] = await Promise.all([
    googleFetch(endpoint, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "conversions" }],
      }),
    }),
    googleFetch(endpoint, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 25,
      }),
    }),
  ]);

  const totalsRow = totals.rows?.[0]?.metricValues;

  return {
    propertyId,
    dateRangeStart: startDate,
    dateRangeEnd: endDate,
    sessions: Number(totalsRow?.[0]?.value ?? 0),
    users: Number(totalsRow?.[1]?.value ?? 0),
    conversions: Number(totalsRow?.[2]?.value ?? 0),
    topPages: (byPage.rows ?? []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      page: r.dimensionValues[0].value,
      sessions: Number(r.metricValues[0].value),
    })),
  };
}
