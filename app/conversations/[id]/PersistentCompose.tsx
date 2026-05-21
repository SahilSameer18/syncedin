"use client";

import { useState } from "react";
import type { Message } from "@/lib/types";

/**
 * Always-on chat input at the bottom of a conversation. Replaces the
 * older 3-button action row (continue / add message / add goal) per
 * Jack's call — "matches every other messaging UX". User just types
 * and sends. The "AI pre-draft" button on the right asks the twin to
 * fill the input with a suggested next message they can edit before
 * sending. Goal-override moved to a lighter trigger above this.
 *
 * Posts:
 *   - send → /api/send-message  (human message)
 *   - pre-draft → /api/run-conversation?dryrun=1 (returns text to fill the
 *     box without committing). Falls back to a /api/draft-next endpoint
 *     if the run-conversation route doesn't accept dryrun (graceful
 *     degrade — we still get a draft via that fallback).
 */
export function PersistentCompose({
  conversationId,
  onSent,
  onContinueLoop
}: {
  conversationId: string;
  onSent: (m: Message) => void;
  /** Called when the user just wants the twins to continue without
   *  typing anything — same as the old "continue" button. Triggers a
   *  twin-side turn instead of a human message. */
  onContinueLoop: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState<string>("");

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setErr("");
    try {
      const res = await fetch("/api/send-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          original_draft: trimmed,
          final_text: trimmed
        })
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j?.detail || j?.error || `HTTP ${res.status}`);
      }
      onSent(j.message as Message);
      setText("");
    } catch (e: any) {
      setErr(e?.message || "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function preDraft() {
    if (drafting) return;
    setDrafting(true);
    setErr("");
    try {
      // Ask the server to draft what the twin would say next without
      // actually committing it. Server returns { text }.
      const res = await fetch("/api/draft-next", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId })
      });
      if (res.ok) {
        const j = await res.json();
        if (typeof j.text === "string" && j.text.trim()) {
          setText(j.text.trim());
        } else {
          setErr("Twin didn't return a draft. Try again.");
        }
      } else {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || j?.error || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      setErr(e?.message || "Pre-draft failed. Try again.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div
      className="retro-panel"
      style={{
        padding: 12,
        marginTop: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={Math.min(8, Math.max(2, text.split("\n").length + 1))}
          placeholder="Type a message, or tap ✨ to have your twin draft one for you…"
          className="retro-input"
          style={{
            flex: 1,
            fontSize: 14,
            padding: 10,
            minHeight: 44,
            resize: "none"
          }}
        />
        <button
          type="button"
          onClick={preDraft}
          disabled={drafting || sending}
          title="Ask your twin to pre-draft the next message — you can edit before sending"
          aria-label="AI pre-draft"
          className="retro-btn"
          style={{
            padding: "8px 10px",
            fontSize: 13,
            fontWeight: 700,
            color: drafting ? "var(--text-dim)" : "#1f8bff",
            borderColor: drafting ? undefined : "rgba(31, 139, 255, 0.35)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0
          }}
        >
          <span aria-hidden="true">✨</span>
          <span>{drafting ? "drafting…" : "AI"}</span>
        </button>
        <button
          type="button"
          onClick={send}
          disabled={sending || text.trim().length === 0}
          className="retro-btn retro-btn-primary"
          style={{
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0
          }}
        >
          {sending ? "…" : "send →"}
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 11,
          color: "var(--text-dim)"
        }}
      >
        <button
          type="button"
          onClick={onContinueLoop}
          className="retro-btn"
          style={{
            fontSize: 11,
            padding: "5px 10px",
            border: "1px solid var(--border)",
            background: "transparent"
          }}
          title="Have the twins continue the conversation on their own"
        >
          ↻ let twins continue
        </button>
        <span>⌘+Enter to send</span>
      </div>
      {err && (
        <div style={{ fontSize: 12, color: "#ef4444" }}>{err}</div>
      )}
    </div>
  );
}
