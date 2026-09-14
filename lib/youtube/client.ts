import { randomBytes } from "crypto";

// YouTube Data API v3 — stable, long-established API (unlike Buffer's new
// beta), so this is built from well-established knowledge rather than fresh
// research. Direct API per spec §13 ("Use direct platform APIs... especially
// Full YouTube management"), reusing the same Google OAuth app as Phase 3's
// Search Console/Analytics (lib/google/oauth.ts), extended with the
// youtube.upload scope.

export class YoutubeApiError extends Error {}

async function googleFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new YoutubeApiError(`YouTube API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listYoutubeChannels(accessToken: string): Promise<{ id: string; title: string }[]> {
  const data = await googleFetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    accessToken
  );
  return (data.items ?? []).map((item: { id: string; snippet: { title: string } }) => ({
    id: item.id,
    title: item.snippet.title,
  }));
}

export interface UploadYoutubeVideoParams {
  accessToken: string;
  videoBytes: ArrayBuffer;
  mimeType: string;
  title: string;
  description: string;
  tags?: string[];
  /** ISO 8601. If set, the video uploads as private and YouTube auto-publishes it at this time. */
  publishAt?: string;
}

// Multipart upload (single request: JSON metadata + video bytes) rather than
// the full resumable-session protocol — simpler and correct for a reliable
// server-to-server relay. Large videos may hit serverless payload/execution
// limits depending on the eventual hosting choice (spec §37.3 still open) —
// resumable upload is the documented upgrade path if that becomes a problem.
export async function uploadYoutubeVideo(params: UploadYoutubeVideoParams): Promise<{ videoId: string }> {
  const boundary = `dc_${randomBytes(12).toString("hex")}`;

  const snippet = {
    title: params.title,
    description: params.description,
    tags: params.tags ?? [],
  };
  const status = params.publishAt
    ? { privacyStatus: "private", publishAt: params.publishAt, selfDeclaredMadeForKids: false }
    : { privacyStatus: "public", selfDeclaredMadeForKids: false };

  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ snippet, status })}\r\n`;
  const videoPartHeader = `--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(metadataPart, "utf-8"),
    Buffer.from(videoPartHeader, "utf-8"),
    Buffer.from(params.videoBytes),
    Buffer.from(closing, "utf-8"),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    throw new YoutubeApiError(`YouTube upload failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return { videoId: data.id };
}

export async function getYoutubeVideoStatus(
  accessToken: string,
  videoId: string
): Promise<{ uploadStatus: string; privacyStatus: string }> {
  const data = await googleFetch(
    `https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(videoId)}`,
    accessToken
  );
  const item = data.items?.[0];
  if (!item) throw new YoutubeApiError("Video not found.");
  return { uploadStatus: item.status.uploadStatus, privacyStatus: item.status.privacyStatus };
}
