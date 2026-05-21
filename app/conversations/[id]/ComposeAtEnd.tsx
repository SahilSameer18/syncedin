"use client";

import { useState } from "react";
import type { Message } from "@/lib/types";

/**
 * Compose-at-end affordance — visible only when the auto-loop has
 * completed (done=true). Lets the user add a real message AFTER the
 * twins have stopped rather than only being able to edit prior turns.
 *
 * Posts to /api/send-message as the signed-in user (their identity, not
 * their twin) so the counterpart sees it as the human stepping in.
 */
export function ComposeAtEnd({
  conversationId,
  onSent
}: {
  conversationId: string;
  onSent: (m: Message) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
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
          text: trimmed
        })
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j?.detail || j?.error || `HTTP ${res.status}`);
      }
      const msg = j.message as Message;
      onSent(msg);
      setText("");
    } catch (e: any) {
      setErr(e?.message || "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="retro-panel"
      style={{
        padding: 12,
        marginTop: 8,
        marginBottom: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <div
        className="retro-label"
        style={{ color: "var(--text-dim)", fontSize: 11 }}
      >
        add another message
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={Math.min(8, Math.max(3, text.split("\n").length + 1))}
        placeholder="One more thing, in your voice — your twin will pick the conversation back up from here."
        className="retro-input"
        style={{
          fontSize: 14,
          padding: 10,
          width: "100%",
          minHeight: 80,
          resize: "vertical"
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8
        }}
      >
        <span
          className="text-xs"
          style={{ color: "var(--text-dim)" }}
        >
          ⌘+Enter to send
        </span>
        <button
          type="button"
          onClick={send}
          disabled={sending || text.trim().length === 0}
          className="retro-btn retro-btn-primary text-sm"
        >
          {sending ? "sending…" : "send →"}
        </button>
      </div>
      {err && (
        <div className="text-xs" style={{ color: "#ef4444" }}>
          {err}
        </div>
      )}
    </div>
  );
}
