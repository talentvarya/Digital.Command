"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { FormError } from "@/components/FormError";
import { sendAssistantMessageAction } from "@/app/app/assistant/actions";
import type { AssistantChatMessage } from "@/lib/ai/assistant-chat";

const SUGGESTIONS = ["Explain my latest report", "What's scheduled tomorrow?", "Change tomorrow's caption", "Skip today's post"];

export function AssistantChat() {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    setError(null);
    setPending(true);
    const history = messages;
    setMessages([...history, { role: "user", content: trimmed }]);
    setInput("");

    const result = await sendAssistantMessageAction(history, trimmed);
    setPending(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="min-h-[200px] max-h-[50vh] space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-sm text-ink-400">
              <Sparkles className="h-4 w-4" /> Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn-secondary px-3 py-1.5 text-xs" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-brand-50 text-ink-900" : "mr-8 bg-ink-50 text-ink-800"}`}>
            {m.content}
          </div>
        ))}
        {pending && <div className="mr-8 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-400">Thinking…</div>}
      </div>

      <FormError message={error} />

      <div className="flex items-end gap-2">
        <textarea
          className="field-input flex-1"
          rows={2}
          placeholder="Ask about your report, edit a post, skip a day…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="btn-primary px-4 py-2" disabled={pending || !input.trim()} onClick={() => send(input)}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
