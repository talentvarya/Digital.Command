// Which planner posts Creative Studio may make a graphic for, and which ones the
// "create images for the next posts" button covers. Pure, so it is unit-tested.

export const BATCH_LIMIT = 20;

export interface GraphicItem {
  id: string;
  platform: string;
  status: string;
  locked: boolean;
  publish_status: string;
  scheduled_date: string;
  scheduled_time: string | null;
}

// Why a graphic can't be made for this post; null means it can.
export function graphicBlockedReason(item: GraphicItem): string | null {
  if (item.platform === "youtube") return "Graphics are for Facebook and Instagram posts.";
  if (item.locked) return "This post is locked — unlock it first.";
  if (item.status === "published" || item.status === "skipped") return "This post is already finished.";
  if (item.publish_status === "sent") return "This post has already been sent, so its image can't change.";
  return null;
}

// Soonest posts first, nothing blocked, and only posts with no picture of the
// client's own — either no media at all, or just the stock photo that was
// auto-attached with the caption (which a graphic replaces).
export function pickBatchItems(
  items: GraphicItem[],
  mediaByItem: Map<string, { storage_path: string }[]>,
  limit: number = BATCH_LIMIT
): string[] {
  const when = (i: GraphicItem) => `${i.scheduled_date} ${i.scheduled_time ?? ""}`;
  return items
    .filter((i) => graphicBlockedReason(i) === null)
    .filter((i) => (mediaByItem.get(i.id) ?? []).every((m) => /-unsplash\.[a-z0-9]+$/i.test(m.storage_path)))
    .sort((a, b) => when(a).localeCompare(when(b)))
    .slice(0, limit)
    .map((i) => i.id);
}
