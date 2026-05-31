"use client";

import { useRef, useState } from "react";
import type { Message } from "@/lib/types";
import { MicButton } from "../../MicButton";

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
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * File/video upload — Jack: "add the ability in the chat for someone
   * to send a video or a file when they have the custom bar there to
   * do so." Uploads via /api/chat-attach, appends inline markdown to
   * the textarea so user can still add a caption before sending.
   * Images/gifs render inline via linkify's MD_IMG_RE; non-images
   * render as a clickable link.
   */
  async function uploadFile(file: File) {
    if (!file || uploading) return;
    setUploading(true);
    setErr("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("conversation_id", conversationId);
      const res = await fetch("/api/chat-attach", {
        method: "POST",
        body: form
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j?.detail || j?.error || `HTTP ${res.status}`);
      }
      const url = j.url as string;
      const name = (j.name as string) || file.name || "file";
      const mime = (j.mime_type as string) || file.type || "";
      const inline = mime.startsWith("image/")
        ? `![${name}](${url})`
        : mime.startsWith("video/")
          ? `<video src="${url}" controls></video>`
          : `📎 [${name}](${url})`;
      setText((t) => (t.trim() ? `${t}\n\n${inline}` : inline));
    } catch (e: any) {
      setErr(e?.message || "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
          // Long placeholder for desktop, short for mobile (set via the
          // .compose-textarea CSS class + a media-query swap below).
          placeholder="Message…"
          data-desktop-placeholder="Type a message, or tap ✨ to have your twin draft one for you…"
          className="retro-input"
          style={{
            flex: 1,
            fontSize: 14,
            padding: 10,
            minHeight: 44,
            resize: "none"
          }}
        />
        {/* Voice dictation — Jack: "most people don't realize they can
            voice type. I'd like across the platform for there to be a
            little mic button." Uses Web Speech API (free, browser
            native, instant). Appends transcribed text to the existing
            input value so users can speak after typing. */}
        <MicButton
          onText={(chunk) =>
            setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${chunk}`)
          }
          ariaLabel="Dictate message"
          size={34}
          style={{ marginRight: 2 }}
        />
        {/* Attach a file/video. Hidden native input + paperclip button. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending}
          title="Attach a file or video"
          aria-label="Attach file"
          className="retro-btn"
          style={{
            padding: "8px 10px",
            fontSize: 15,
            color: uploading ? "var(--text-dim)" : "var(--text)",
            flexShrink: 0
          }}
        >
          {uploading ? "↑" : "📎"}
        </button>
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
      {/* Keyboard-shortcut hint. Hidden on mobile (no ⌘ key on a phone
          — Jack: "the command enter plus send part doesn't even need
          to be shown on mobile"). The class is targeted via the
          @media block at the bottom of this file. */}
      <div
        className="compose-keyhint"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          fontSize: 11,
          color: "var(--text-dim)"
        }}
      >
        <span>⌘+Enter to send</span>
      </div>
      <style>{`
        @media (max-width: 767px) {
          .compose-keyhint { display: none !important; }
        }
      `}</style>
      {err && (
        <div style={{ fontSize: 12, color: "#ef4444" }}>{err}</div>
      )}
    </div>
  );
}
