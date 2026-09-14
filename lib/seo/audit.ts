import * as cheerio from "cheerio";
import type { SeoIssue } from "@/types/database";

async function fetchWithTimeout(url: string, method: "GET" | "HEAD" = "GET", timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method, redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface SeoAuditResult {
  score: number;
  issues: SeoIssue[];
}

// A real crawl-based technical SEO check — no third-party API needed. Every
// finding below is derived from an actual fetch of the client's own site.
export async function runSeoAudit(baseUrl: string): Promise<SeoAuditResult> {
  const issues: SeoIssue[] = [];
  let score = 100;
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  let robotsText = "";
  try {
    const res = await fetchWithTimeout(`${normalizedBase}/robots.txt`);
    if (res.ok) {
      robotsText = await res.text();
      if (/^\s*Disallow:\s*\/\s*$/im.test(robotsText) && !/^\s*Allow:/im.test(robotsText)) {
        issues.push({ severity: "critical", type: "robots_txt", message: "robots.txt blocks all crawling (Disallow: /)" });
        score -= 25;
      }
    } else {
      issues.push({ severity: "warning", type: "robots_txt", message: "robots.txt not found" });
      score -= 5;
    }
  } catch {
    issues.push({ severity: "warning", type: "robots_txt", message: "robots.txt not reachable" });
    score -= 5;
  }

  let sitemapUrl = `${normalizedBase}/sitemap.xml`;
  const sitemapDirective = robotsText.match(/Sitemap:\s*(\S+)/i);
  if (sitemapDirective) sitemapUrl = sitemapDirective[1];

  try {
    const res = await fetchWithTimeout(sitemapUrl);
    if (res.ok) {
      const text = await res.text();
      const urlCount = (text.match(/<loc>/gi) ?? []).length;
      if (urlCount === 0) {
        issues.push({ severity: "warning", type: "sitemap", message: "Sitemap found but contains no URLs" });
        score -= 5;
      }
    } else {
      issues.push({ severity: "warning", type: "sitemap", message: "sitemap.xml not found" });
      score -= 10;
    }
  } catch {
    issues.push({ severity: "warning", type: "sitemap", message: "sitemap.xml not reachable" });
    score -= 10;
  }

  let html = "";
  try {
    const res = await fetchWithTimeout(normalizedBase);
    if (!res.ok) {
      issues.push({ severity: "critical", type: "homepage", message: `Homepage returned HTTP ${res.status}` });
      score -= 30;
    } else {
      html = await res.text();
    }
  } catch {
    issues.push({ severity: "critical", type: "homepage", message: "Homepage not reachable" });
    score -= 30;
  }

  let internalLinks: string[] = [];
  if (html) {
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim();
    if (!title) {
      issues.push({ severity: "critical", type: "title", message: "Missing <title> tag" });
      score -= 15;
    } else if (title.length > 60) {
      issues.push({ severity: "info", type: "title", message: `Title is ${title.length} characters (recommended under ~60)` });
      score -= 2;
    }

    const metaDescription = $('meta[name="description"]').attr("content")?.trim();
    if (!metaDescription) {
      issues.push({ severity: "warning", type: "meta_description", message: "Missing meta description" });
      score -= 10;
    } else if (metaDescription.length > 160) {
      issues.push({
        severity: "info",
        type: "meta_description",
        message: `Meta description is ${metaDescription.length} characters (recommended under ~160)`,
      });
      score -= 2;
    }

    if (!$('link[rel="canonical"]').attr("href")) {
      issues.push({ severity: "warning", type: "canonical", message: "Missing canonical link tag" });
      score -= 5;
    }

    if (!$('meta[name="viewport"]').attr("content")) {
      issues.push({ severity: "warning", type: "viewport", message: "Missing responsive viewport meta tag" });
      score -= 5;
    }

    const h1Count = $("h1").length;
    if (h1Count === 0) {
      issues.push({ severity: "warning", type: "h1", message: "No <h1> heading found" });
      score -= 8;
    } else if (h1Count > 1) {
      issues.push({ severity: "info", type: "h1", message: `${h1Count} <h1> tags found (recommended: exactly one)` });
      score -= 2;
    }

    if ($('script[type="application/ld+json"]').length === 0) {
      issues.push({ severity: "info", type: "schema", message: "No JSON-LD structured data detected" });
      score -= 3;
    }

    const images = $("img");
    const missingAlt = images.filter((_, el) => !$(el).attr("alt")?.trim()).length;
    if (images.length > 0 && missingAlt > 0) {
      issues.push({
        severity: "info",
        type: "image_alt",
        message: `${missingAlt} of ${images.length} images missing alt text`,
      });
      score -= Math.min(8, missingAlt);
    }

    const base = new URL(normalizedBase);
    const seen = new Set<string>();
    $("a[href]").each((_, el) => {
      if (seen.size >= 10) return;
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const resolved = new URL(href, normalizedBase);
        if (resolved.origin === base.origin) seen.add(resolved.href);
      } catch {
        // ignore unparseable hrefs (mailto:, javascript:, etc.)
      }
    });
    internalLinks = Array.from(seen);
  }

  const brokenLinks: string[] = [];
  await Promise.all(
    internalLinks.map(async (link) => {
      try {
        const res = await fetchWithTimeout(link, "HEAD");
        if (!res.ok) brokenLinks.push(`${link} (HTTP ${res.status})`);
      } catch {
        brokenLinks.push(`${link} (unreachable)`);
      }
    })
  );
  if (brokenLinks.length > 0) {
    issues.push({
      severity: "warning",
      type: "broken_links",
      message: `${brokenLinks.length} broken internal link(s): ${brokenLinks.slice(0, 5).join(", ")}${brokenLinks.length > 5 ? "…" : ""}`,
    });
    score -= Math.min(20, brokenLinks.length * 4);
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), issues };
}
