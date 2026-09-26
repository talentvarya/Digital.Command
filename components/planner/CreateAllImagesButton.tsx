"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { FormError } from "@/components/FormError";
import { createCreativeAction } from "@/app/app/planner/creative-actions";

// Makes graphics for the next batch of posts that have no picture of their own,
// one after another (each is its own request, so none can hit a time limit).
// The list of posts shrinks as graphics get made, so the batch is snapshotted
// when the button is pressed.
export function CreateAllImagesButton({ itemIds, aiAvailable }: { itemIds: string[]; aiAvailable: boolean }) {
  const router = useRouter();
  const stopRequested = useRef(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const batch = [...itemIds];
    stopRequested.current = false;
    setError(null);
    setRunning(true);
    setProgress({ done: 0, failed: 0, total: batch.length });

    let failed = 0;
    let firstError: string | null = null;
    for (let i = 0; i < batch.length; i++) {
      const form = new FormData();
      form.set("contentItemId", batch[i]);
      form.set("style", "auto");
      form.set("background", "auto");
      form.set("size", "auto");
      form.set("batch", "1"); // the page is refreshed once at the end, not after every image
      const result = await createCreativeAction({}, form);
      if (result.error) {
        failed++;
        firstError ??= result.error;
      }
      setProgress({ done: i + 1, failed, total: batch.length });
      if (stopRequested.current) break;
    }

    setRunning(false);
    if (firstError) setError(firstError);
    router.refresh();
  }

  if (itemIds.length === 0 && !running && progress.done === 0) return null;

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="card space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Wand2 className="h-4 w-4 text-ink-400" /> Post graphics
          </h2>
          <p className="text-xs text-ink-500">
            {itemIds.length > 0
              ? `${itemIds.length} upcoming post${itemIds.length === 1 ? " has" : "s have"} no picture of their own. `
              : ""}
            Make a branded graphic for each — {aiAvailable ? "a free AI photo where possible, otherwise a stock photo, otherwise your brand colours" : "a stock photo, or your brand colours"}
            , with the post&apos;s words on it. You still approve every post.
          </p>
        </div>
        {running ? (
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => (stopRequested.current = true)}>
            Stop after this one
          </button>
        ) : (
          itemIds.length > 0 && (
            <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={run}>
              Create images for {itemIds.length} post{itemIds.length === 1 ? "" : "s"}
            </button>
          )
        )}
      </div>

      {(running || progress.done > 0) && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
            <div className="h-1.5 rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-ink-600">
            {progress.done} of {progress.total} done
            {progress.failed > 0 ? ` · ${progress.failed} couldn't be made` : ""}
            {running ? " — please keep this page open" : ""}
          </p>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}
