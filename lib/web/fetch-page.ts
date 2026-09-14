import * as cheerio from "cheerio";

// Shared crawl helper — used by the Phase 3 SEO audit and Phase 5 off-page
// opportunity assessment. No third-party API, just a direct fetch + parse.
export async function fetchWithTimeout(
  url: string,
  method: "GET" | "HEAD" = "GET",
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method, redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface PageContent {
  url: string;
  title: string;
  textContent: string;
  mailtoEmails: string[];
  contactPageUrl: string | null;
  html: string;
}

export async function fetchPageContent(url: string): Promise<PageContent | null> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim();
    const textContent = $("body").text().replace(/\s+/g, " ").trim().slice(0, 4000);

    const mailtoEmails = Array.from(
      new Set(
        $('a[href^="mailto:"]')
          .map((_, el) => $(el).attr("href")?.replace(/^mailto:/i, "").split("?")[0].trim())
          .get()
          .filter((email): email is string => Boolean(email))
      )
    );

    let contactPageUrl: string | null = null;
    $("a[href]").each((_, el) => {
      if (contactPageUrl) return;
      const href = $(el).attr("href");
      const text = $(el).text().toLowerCase();
      if (href && (/contact/i.test(href) || text.includes("contact"))) {
        try {
          contactPageUrl = new URL(href, url).href;
        } catch {
          // ignore unparseable hrefs
        }
      }
    });

    return { url, title, textContent, mailtoEmails, contactPageUrl, html };
  } catch {
    return null;
  }
}

// Does this already-fetched page contain a link to targetDomain? Used for
// backlink verification (spec §9.2) — resolves relative hrefs against the
// page's own URL so only genuinely absolute links to the target count.
export function pageLinksToDomain(html: string, pageUrl: string, targetDomain: string): boolean {
  const $ = cheerio.load(html);
  const normalizedTarget = targetDomain.replace(/^www\./, "").toLowerCase();
  let found = false;
  $("a[href]").each((_, el) => {
    if (found) return;
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const host = new URL(href, pageUrl).hostname.replace(/^www\./, "").toLowerCase();
      if (host === normalizedTarget) found = true;
    } catch {
      // ignore unparseable hrefs
    }
  });
  return found;
}
