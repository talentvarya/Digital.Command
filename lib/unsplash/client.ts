// Unsplash Search Photos — free, no billing, used to auto-attach a relevant
// stock photo to an AI-generated caption (spec doesn't call for AI-designed
// graphics, and that needs a paid image model — this is the free, always-on
// alternative). App-wide credential (UNSPLASH_ACCESS_KEY), not per-org.

export class UnsplashError extends Error {}

interface UnsplashPhoto {
  urls: { regular: string; small: string };
  links: { download_location: string };
}

export interface UnsplashResult {
  imageUrl: string;
  downloadLocation: string;
}

export async function searchUnsplashPhoto(query: string): Promise<UnsplashResult | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) throw new UnsplashError("Photo search is not configured — UNSPLASH_ACCESS_KEY is missing.");

  const params = new URLSearchParams({ query, per_page: "1", orientation: "squarish", content_filter: "high" });
  const res = await fetch(`https://api.unsplash.com/search/photos?${params.toString()}`, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  if (!res.ok) throw new UnsplashError(`Unsplash search failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as { results?: UnsplashPhoto[] };
  const photo = data.results?.[0];
  if (!photo) return null;

  return { imageUrl: photo.urls.regular, downloadLocation: photo.links.download_location };
}

// Unsplash's API Guidelines require pinging this endpoint whenever a photo is
// actually used (not just displayed in search results) — best-effort, never
// blocks the caller.
export async function trackUnsplashDownload(downloadLocation: string): Promise<void> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return;
  try {
    await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${accessKey}` } });
  } catch {
    // best-effort tracking ping — never fails the caller over this
  }
}
