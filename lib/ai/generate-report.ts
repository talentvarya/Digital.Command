import { generateText } from "@/lib/ai/provider";
import type { AiUsage } from "@/lib/ai/log-usage";

export interface ReportMetricsInput {
  periodStart: string;
  periodEnd: string;
  seoAudit: { score: number; issueCount: number; previousScore: number | null } | null;
  searchConsole: {
    clicks: number;
    impressions: number;
    avgPosition: number;
    avgCtr: number;
    previousClicks: number | null;
    previousAvgPosition: number | null;
  } | null;
  analytics: {
    sessions: number;
    users: number;
    conversions: number;
    previousSessions: number | null;
  } | null;
  content: { scheduledCount: number; publishedCount: number; totalCount: number };
}

export interface GeneratedReportNarrative {
  summary: string;
  nextPlan: string;
  usage: AiUsage;
}

const SYSTEM_PROMPT = `You write short, plain-English client marketing reports for Digital Command, a digital marketing platform.
Rules:
- Use ONLY the numbers given to you below. Never invent a metric, a percentage, or a result that isn't in the data.
- Never claim guaranteed rankings, guaranteed leads, or guaranteed revenue.
- If a data source is missing (null), say it isn't connected yet rather than guessing.
- Write two sections: "summary" (what was done, what changed, what improved or declined, and a brief honest reason if one is obvious from the numbers) and "nextPlan" (what's planned for the next period).
- Keep each section under 150 words, plain text, no markdown headers.
Respond with ONLY a JSON object: {"summary": string, "nextPlan": string}`;

function describeMetrics(input: ReportMetricsInput): string {
  const lines = [`Report period: ${input.periodStart} to ${input.periodEnd}.`];

  if (input.seoAudit) {
    lines.push(
      `SEO health score: ${input.seoAudit.score}/100 (${input.seoAudit.issueCount} issues found)` +
        (input.seoAudit.previousScore !== null ? `, previous score was ${input.seoAudit.previousScore}/100.` : ".")
    );
  } else {
    lines.push("SEO audit: not run yet this period.");
  }

  if (input.searchConsole) {
    lines.push(
      `Search Console: ${input.searchConsole.clicks} clicks, ${input.searchConsole.impressions} impressions, average position ${input.searchConsole.avgPosition.toFixed(1)}, CTR ${(input.searchConsole.avgCtr * 100).toFixed(2)}%.` +
        (input.searchConsole.previousClicks !== null
          ? ` Previous period: ${input.searchConsole.previousClicks} clicks, average position ${input.searchConsole.previousAvgPosition?.toFixed(1)}.`
          : "")
    );
  } else {
    lines.push("Search Console: not connected.");
  }

  if (input.analytics) {
    lines.push(
      `Analytics: ${input.analytics.sessions} sessions, ${input.analytics.users} users, ${input.analytics.conversions} conversions.` +
        (input.analytics.previousSessions !== null ? ` Previous period: ${input.analytics.previousSessions} sessions.` : "")
    );
  } else {
    lines.push("Analytics: not connected.");
  }

  lines.push(
    `Content planner: ${input.content.totalCount} items planned, ${input.content.scheduledCount} scheduled, ${input.content.publishedCount} published this period.`
  );

  return lines.join("\n");
}

export async function generateReportNarrative(input: ReportMetricsInput): Promise<GeneratedReportNarrative> {
  const result = await generateText({ system: SYSTEM_PROMPT, user: describeMetrics(input), maxTokens: 1024 });

  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : result.text,
      nextPlan: typeof parsed.nextPlan === "string" ? parsed.nextPlan : "",
      usage: result.usage,
    };
  } catch {
    return { summary: result.text.trim(), nextPlan: "", usage: result.usage };
  }
}
