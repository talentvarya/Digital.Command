import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, HAIKU_MODEL, AiGenerationError } from "@/lib/ai/client";
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
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiGenerationError("AI generation is not configured — ANTHROPIC_API_KEY is missing.");
  }

  try {
    const response = await getAnthropicClient().messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: describeMetrics(input) }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) throw new AiGenerationError("The AI response did not contain any text.");

    const usage: AiUsage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
      return {
        summary: typeof parsed.summary === "string" ? parsed.summary : textBlock.text,
        nextPlan: typeof parsed.nextPlan === "string" ? parsed.nextPlan : "",
        usage,
      };
    } catch {
      return { summary: textBlock.text.trim(), nextPlan: "", usage };
    }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiGenerationError("AI generation failed: invalid ANTHROPIC_API_KEY.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiGenerationError("AI generation is rate-limited right now — please try again shortly.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiGenerationError(`AI generation failed: ${error.message}`);
    }
    throw error;
  }
}
