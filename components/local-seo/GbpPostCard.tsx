"use client";

import { useState } from "react";
import { Copy, Check, Tag } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { markGbpPostPostedAction } from "@/app/app/local-seo/actions";
import type { LocalSeoPost } from "@/types/database";

export function GbpPostCard({ post }: { post: LocalSeoPost }) {
  const [copied, setCopied] = useState(false);

  async function copyPost() {
    try {
      await navigator.clipboard.writeText(post.post_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API can be unavailable — copy button just won't confirm, not fatal
    }
  }

  return (
    <div className="rounded-lg border border-ink-100 p-4">
      <div className="mb-2 flex items-center justify-between">
        <StatusBadge status={post.status} />
        <span className="text-xs text-ink-400">{new Date(post.created_at).toLocaleString()}</span>
      </div>
      <p className="text-sm text-ink-700">{post.post_text}</p>
      {post.keyword_suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.keyword_suggestions.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
              <Tag className="h-2.5 w-2.5" /> {kw}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 border-t border-ink-50 pt-3">
        <button type="button" onClick={copyPost} className="btn-secondary px-3 py-1.5 text-xs">
          {copied ? <Check className="mr-1 inline h-3 w-3" /> : <Copy className="mr-1 inline h-3 w-3" />}
          {copied ? "Copied" : "Copy post"}
        </button>
        {post.status === "drafted" && (
          <ActionForm action={markGbpPostPostedAction}>
            {() => (
              <>
                <input type="hidden" name="postId" value={post.id} />
                <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
                  Mark posted
                </button>
              </>
            )}
          </ActionForm>
        )}
        {post.status === "posted" && post.posted_at && (
          <span className="text-xs text-ink-400">Posted {new Date(post.posted_at).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
