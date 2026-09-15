import { ContentItemCard } from "./ContentItemCard";
import { NewContentForm } from "./NewContentForm";
import type { ContentItem, ContentVersion } from "@/types/database";
import type { ContentMediaWithUrl } from "@/app/app/planner/page";

export function DayCard({
  date,
  items,
  mediaByItem,
  versionsByItem,
}: {
  date: string;
  items: ContentItem[];
  mediaByItem: Map<string, ContentMediaWithUrl[]>;
  versionsByItem: Map<string, ContentVersion[]>;
}) {
  const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-ink-900">{label}</h3>
      {items.length === 0 && <p className="text-sm text-ink-400">Nothing planned yet.</p>}
      {items.map((item) => (
        <ContentItemCard key={item.id} item={item} media={mediaByItem.get(item.id) ?? []} versions={versionsByItem.get(item.id) ?? []} />
      ))}
      <NewContentForm date={date} />
    </div>
  );
}
