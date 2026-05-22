"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "../BrandLogo";

/**
 * Pre-auth simulated conversation. The recipient sees what a real
 * twin-to-twin negotiation between them and the inviter would actually
 * look like — no signup required to read. They can paste more context
 * on the right panel + edit any line, and the whole thing regenerates.
 * Sign-in only kicks in when they want to "open the final deal proposal."
 *
 * State lives in localStorage keyed by slug so a refresh keeps their
 * edits + added context. On signup the auth callback can hand this
 * state off to seed their twin's ai_export_blob.
 */
type Msg = { sender: "inviter" | "recipient"; text: string };

const lsKey = (slug: string) => `syncedin.demo.${slug}`;

type StoredState = {
  messages: Msg[];
  extraContext: string;
  linkedinAbout: string;
  igHandle: string;
  xHandle: string;
  aiResponse: string;
};

function loadState(slug: string): StoredState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(lsKey(slug));
    if (!raw) return null;
    return JSON.parse(raw) as StoredState;
  } catch {
    return null;
  }
}

function saveState(slug: string, s: StoredState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(slug), JSON.stringify(s));
  } catch {
    /* quota — skip */
  }
}

export function DemoConversation({
  slug,
  initialMessages,
  inviterName,
  recipientName,
  inviterAvatarUrl,
  recipientAvatarUrl,
  seedFirstMessage,
  linkedinContext
}: {
  slug: string;
  initialMessages: Msg[];
  inviterName: string;
  recipientName: string;
  inviterAvatarUrl: string | null;
  recipientAvatarUrl: string | null;
  /** The inviter's actual drafted opener — preloaded as message 1
   *  so the demo conversation starts with the real first line, not
   *  a re-generated approximation. */
  seedFirstMessage: string;
  /** Whatever the scrape pipeline pulled from LinkedIn. Shown to the
   *  recipient as editable copy — they can correct it before the
   *  simulation regenerates. */
  linkedinContext: string;
}) {
  // Compute the initial seed message once. If we have a seedFirstMessage,
  // start the conversation with it so the user immediately sees what
  // the inviter's twin actually said — no "loading…" state for the
  // primary CTA surface.
  const seededInitial = useMemo<Msg[]>(() => {
    if (initialMessages && initialMessages.length > 0) return initialMessages;
    if (seedFirstMessage && seedFirstMessage.trim().length > 0) {
      return [{ sender: "inviter", text: seedFirstMessage.trim() }];
    }
    return [];
  }, [initialMessages, seedFirstMessage]);

  const [messages, setMessages] = useState<Msg[]>(seededInitial);
  const [extraContext, setExtraContext] = useState<string>("");
  const [linkedinAbout, setLinkedinAbout] = useState<string>(linkedinContext);
  const [igHandle, setIgHandle] = useState<string>("");
  const [xHandle, setXHandle] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [regenerating, setRegenerating] = useState(false);
  const [err, setErr] = useState<string>("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<"context" | "socials" | "ai">(
    "context"
  );
  const convScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the conversation pane to the bottom whenever a new
  // message arrives. Only fires when streaming so user-initiated
  // scroll-up to re-read earlier messages isn't fought.
  useEffect(() => {
    if (!streaming) return;
    const el = convScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, streaming]);

  // Auto-run the demo on first mount. Jack's call: "On the custom invite
  // page, it doesn't show the other twin typing or thinking. It just has
  // the regenerate button. The live simulation should be basically the
  // same thing as the real feature of messages." Firing regenerate
  // automatically on mount when the user has only the seed message
  // means they land on the page and IMMEDIATELY see the two twins
  // talking — typing dots, message bubbles streaming in — exactly
  // like the real ChatUI does when a conversation opens.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    // Only auto-run if the user is starting fresh (just the seed
    // message, no persisted state from a prior visit). Restored sessions
    // already have the full transcript, so re-running would obliterate it.
    if (messages.length > 1) {
      autoRanRef.current = true;
      return;
    }
    autoRanRef.current = true;
    // Tiny delay so the seed bubble lands first, then the typing
    // indicator fires for the counterpart's reply.
    const t = window.setTimeout(() => {
      void regenerate();
    }, 650);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recipientFirst =
    recipientName.split(/\s+/)[0]?.trim() || recipientName;

  const aiPrompt = useMemo(() => {
    const trimmed = recipientFirst || "the user";
    return `I'm helping a friend prep a digital twin agent of me so it can negotiate intros and opportunities on my behalf. Write 4-6 tight sentences answering ALL of:

1) What I do day-to-day right now (role, company, who I work with).
2) The 2-3 problems I'm trying to solve in the next 90 days.
3) What kinds of intros, deals, or collaborations would actually help me.
4) Communication style + dealbreakers (anything I'd rather NOT be pitched).
5) A couple of recent wins or specifics that prove what I'm credible at.

Be concrete and first-person. No fluff, no marketing language. Aim for ~150 words total. My name is ${trimmed}.`;
  }, [recipientFirst]);

  // Restore prior session state on mount.
  useEffect(() => {
    const stored = loadState(slug);
    if (stored) {
      if (Array.isArray(stored.messages) && stored.messages.length > 0) {
        setMessages(stored.messages);
      }
      if (typeof stored.extraContext === "string") {
        setExtraContext(stored.extraContext);
      }
      if (typeof stored.linkedinAbout === "string" && stored.linkedinAbout) {
        setLinkedinAbout(stored.linkedinAbout);
      }
      if (typeof stored.igHandle === "string") setIgHandle(stored.igHandle);
      if (typeof stored.xHandle === "string") setXHandle(stored.xHandle);
      if (typeof stored.aiResponse === "string")
        setAiResponse(stored.aiResponse);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Persist on every meaningful change.
  useEffect(() => {
    saveState(slug, {
      messages,
      extraContext,
      linkedinAbout,
      igHandle,
      xHandle,
      aiResponse
    });
  }, [
    slug,
    messages,
    extraContext,
    linkedinAbout,
    igHandle,
    xHandle,
    aiResponse
  ]);

  function buildContextBlob(): string {
    // Combine every signal the recipient has provided into one blob
    // for the regenerate API. The server still does its own scrape +
    // assembly, but giving it everything pre-merged keeps the prompt
    // tight and deterministic.
    const parts: string[] = [];
    if (linkedinAbout && linkedinAbout.trim().length > 0) {
      parts.push(`LinkedIn / public bio:\n${linkedinAbout.trim()}`);
    }
    if (igHandle.trim()) parts.push(`Instagram: @${igHandle.trim().replace(/^@/, "")}`);
    if (xHandle.trim()) parts.push(`X / Twitter: @${xHandle.trim().replace(/^@/, "")}`);
    if (aiResponse.trim()) {
      parts.push(
        `From their own AI tool (treat as authoritative — this is the user's own self-description):\n${aiResponse.trim()}`
      );
    }
    if (extraContext.trim()) {
      parts.push(`More from the user:\n${extraContext.trim()}`);
    }
    return parts.join("\n\n");
  }

  /**
   * Streams the simulated conversation from /api/demo-conversation as
   * SSE events. Each completed message arrives as its own data: line so
   * we can render bubbles progressively instead of waiting 8s for the
   * whole 6-turn block. Falls back to the JSON path if the stream
   * fails or is unsupported by the runtime.
   */
  async function regenerate() {
    setRegenerating(true);
    setStreaming(true);
    setErr("");
    // Clear out old messages immediately so the user sees bubbles
    // arriving fresh, not stacked on top of the previous draft.
    setMessages([]);
    try {
      const edits = messages.map((m, i) => ({ index: i, text: m.text }));
      const res = await fetch("/api/demo-conversation?stream=1", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream"
        },
        body: JSON.stringify({
          slug,
          extra_context: buildContextBlob(),
          edits
        })
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const collected: Msg[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE events are separated by double newlines.
        let split: number;
        while ((split = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, split).trim();
          buf = buf.slice(split + 2);
          if (!raw.startsWith("data:")) continue;
          const payload = raw.slice(5).trim();
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "message" && evt.text) {
              const sender: "inviter" | "recipient" =
                evt.sender === "recipient" ? "recipient" : "inviter";
              collected.push({ sender, text: evt.text });
              // Push a new copy of the array so React re-renders.
              setMessages([...collected]);
            } else if (evt.type === "error") {
              throw new Error(evt.detail || "stream-error");
            }
          } catch {
            /* malformed event — ignore */
          }
        }
      }
    } catch (e: any) {
      setErr(e?.message || "Couldn't regenerate. Try again in a moment.");
    } finally {
      setRegenerating(false);
      setStreaming(false);
    }
  }

  function startEdit(i: number) {
    setEditing(i);
    setEditDraft(messages[i].text);
  }

  function saveEdit() {
    if (editing === null) return;
    const next = messages.slice();
    next[editing] = { ...next[editing], text: editDraft.trim() };
    setMessages(next);
    setEditing(null);
    setEditDraft("");
  }

  function cancelEdit() {
    setEditing(null);
    setEditDraft("");
  }

  async function copyAiPrompt() {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      // fallback for older browsers — surface the prompt in an alert
      // so the user can hand-copy. Better than silently swallowing.
      window.prompt("Copy this prompt:", aiPrompt);
    }
  }

  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="demo-shell">
      <style>{`
        .demo-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 18px;
        }
        @media (min-width: 1000px) {
          .demo-shell {
            grid-template-columns: minmax(0, 1.65fr) minmax(360px, 1fr);
            gap: 28px;
            align-items: start;
          }
          /* The right panel sticks to the top of the viewport on
             desktop so the regenerate CTA + tab strip stay visible
             while the conversation grows. Only the second .demo-panel
             gets this — the first one (the conversation) scrolls
             internally via its own .demo-conv max-height. */
          .demo-shell > .demo-panel:nth-child(2) {
            position: sticky;
            top: 16px;
            max-height: calc(100vh - 32px);
            overflow-y: auto;
          }
        }
        .demo-panel {
          position: relative;
          background: var(--panel-solid);
          border: 1px solid var(--border);
          border-radius: 22px;
          padding: 22px;
          box-shadow: 0 16px 56px -28px rgba(15, 23, 42, 0.16);
        }
        .demo-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border);
        }
        .demo-title-block .label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #1f8bff;
        }
        .demo-title-block .title {
          font-size: 16px;
          font-weight: 700;
          margin-top: 4px;
        }
        .demo-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.30);
        }
        .demo-live-pill .pulse {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #4ade80;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
          animation: demo-pulse 1.6s ease-out infinite;
        }
        @keyframes demo-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(34, 197, 94, 0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0   rgba(34, 197, 94, 0); }
        }
        .demo-stream-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #1f8bff;
          animation: demo-stream-pulse 1s ease-in-out infinite;
        }
        @keyframes demo-stream-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.8); }
          50%      { opacity: 1;    transform: scale(1.2); }
        }
        .demo-conv {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 640px;
          overflow-y: auto;
          padding-right: 4px;
          scroll-behavior: smooth;
        }
        .demo-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          /* Pop in when a new bubble arrives — fade + lift + slight
             scale. Triggers per-row on initial mount because each
             message is keyed by its index, so React creates a fresh
             node each time a bubble lands during streaming. */
          animation: demo-bubble-in 320ms cubic-bezier(0.21, 1.02, 0.73, 1);
          will-change: opacity, transform;
        }
        @keyframes demo-bubble-in {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .demo-row { animation: none; }
        }
        .demo-row.recipient { justify-content: flex-end; }
        .demo-avatar {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          flex-shrink: 0;
          background: linear-gradient(135deg, #1f8bff, #6b2dc9);
          color: #fff;
          font-weight: 700;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .demo-avatar.recipient {
          background: linear-gradient(135deg, #3b6dff, #d83bff);
        }
        .demo-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .demo-bubble-wrap {
          max-width: 78%;
          display: flex;
          flex-direction: column;
        }
        .demo-bubble {
          padding: 12px 16px;
          border-radius: 18px;
          font-size: 14.5px;
          line-height: 1.5;
          word-wrap: break-word;
          letter-spacing: -0.005em;
        }
        .demo-bubble-inviter {
          background: var(--panel-2);
          color: var(--text);
          border: 1px solid var(--border);
          border-bottom-left-radius: 6px;
        }
        .demo-bubble-recipient {
          background: linear-gradient(135deg, #1f8bff, #3b6dff);
          color: #ffffff;
          border-bottom-right-radius: 6px;
          box-shadow: 0 8px 24px -10px rgba(31, 139, 255, 0.55);
        }
        .demo-meta {
          font-size: 10px;
          color: var(--text-dim);
          margin-top: 4px;
          padding: 0 4px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .demo-row.recipient .demo-meta { justify-content: flex-end; }
        .demo-edit-btn {
          font-size: 10px;
          color: var(--text-dim);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
          letter-spacing: 0.04em;
        }
        .demo-edit-btn:hover { color: #1f8bff; }
        .demo-empty {
          padding: 60px 20px;
          text-align: center;
          color: var(--text-dim);
          font-size: 14px;
        }
        .demo-regen-bar {
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          color: var(--text-dim);
        }
        /* RIGHT PANEL */
        .ctx-tabs {
          display: flex;
          gap: 6px;
          padding: 4px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .ctx-tab {
          flex: 1;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
          border-radius: 8px;
          color: var(--text-dim);
          background: transparent;
          border: none;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .ctx-tab.active {
          background: var(--panel-solid);
          color: var(--text);
          box-shadow: 0 1px 0 var(--border);
        }
        .ctx-section h4 {
          font-size: 13px;
          font-weight: 700;
          margin: 0 0 6px;
        }
        .ctx-section p.hint {
          font-size: 12px;
          color: var(--text-dim);
          line-height: 1.45;
          margin: 0 0 10px;
        }
        .ctx-input, .ctx-textarea {
          width: 100%;
          background: var(--panel-solid);
          border: 1.5px solid var(--border-bright);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13.5px;
          color: var(--text);
          font-family: inherit;
          line-height: 1.5;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .ctx-input:focus, .ctx-textarea:focus {
          outline: none;
          border-color: #1f8bff;
          box-shadow: 0 0 0 4px rgba(31, 139, 255, 0.12);
        }
        .ctx-textarea { min-height: 110px; resize: vertical; }
        .ctx-row { display: flex; align-items: center; gap: 10px; }
        .ctx-prefix {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-dim);
          padding: 10px 0 10px 12px;
          background: var(--panel-2);
          border: 1.5px solid var(--border-bright);
          border-right: none;
          border-radius: 10px 0 0 10px;
        }
        .ctx-input.with-prefix {
          border-radius: 0 10px 10px 0;
          border-left: none;
          padding-left: 4px;
        }
        .ctx-count {
          font-size: 10px;
          color: var(--text-dim);
          text-align: right;
          margin-top: 4px;
          letter-spacing: 0.04em;
        }
        .ctx-regen-cta {
          display: block;
          width: 100%;
          padding: 12px 14px;
          font-size: 14px;
          font-weight: 700;
          border-radius: 12px;
          margin-top: 14px;
          letter-spacing: -0.005em;
        }
        .ctx-signin {
          display: block;
          width: 100%;
          padding: 14px 16px;
          font-size: 14.5px;
          font-weight: 800;
          border-radius: 12px;
          text-align: center;
          background: linear-gradient(135deg, #1f8bff, #3b6dff);
          color: #ffffff;
          box-shadow: 0 12px 32px -12px rgba(31, 139, 255, 0.55);
        }
        .ai-prompt-card {
          background: var(--panel-2);
          border: 1px dashed var(--border-bright);
          border-radius: 12px;
          padding: 12px;
          font-size: 12px;
          line-height: 1.5;
          color: var(--text);
          max-height: 180px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
        }
        .copy-btn {
          margin-top: 10px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          font-size: 12.5px;
          font-weight: 700;
          border-radius: 10px;
          background: rgba(31, 139, 255, 0.10);
          color: #1f8bff;
          border: 1px solid rgba(31, 139, 255, 0.30);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .copy-btn:hover {
          background: rgba(31, 139, 255, 0.16);
          transform: translateY(-1px);
        }
        .copy-btn.copied {
          background: rgba(34, 197, 94, 0.15);
          color: #15803d;
          border-color: rgba(34, 197, 94, 0.35);
        }
        .ai-prompt-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
        }
        .ai-tools {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .ai-tool-pill {
          font-size: 11.5px;
          padding: 5px 11px 5px 9px;
          border-radius: 999px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          color: var(--text);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
        }
      `}</style>

      {/* LEFT — conversation */}
      <div className="demo-panel">
        <div className="demo-header">
          <div className="demo-title-block">
            <div className="label">live simulation</div>
            <div className="title">
              {inviterName.split(/\s+/)[0]} ↔ {recipientFirst}
            </div>
          </div>
          <span className="demo-live-pill">
            <span className="pulse" />
            twins thinking
          </span>
        </div>

        <div className="demo-conv" ref={convScrollRef}>
          {messages.map((m, i) => {
            const mine = m.sender === "recipient";
            const isEditing = editing === i;
            const avatarSrc = mine ? recipientAvatarUrl : inviterAvatarUrl;
            const initials = initialsOf(mine ? recipientName : inviterName);
            return (
              <div key={i} className={`demo-row ${m.sender}`}>
                {!mine && (
                  <div className="demo-avatar" aria-hidden="true">
                    {avatarSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarSrc} alt="" />
                    ) : (
                      initials
                    )}
                  </div>
                )}
                <div className="demo-bubble-wrap">
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={Math.max(
                          3,
                          Math.min(10, editDraft.split("\n").length + 1)
                        )}
                        className="ctx-textarea"
                        style={{ minWidth: 280, maxWidth: "100%" }}
                      />
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 8,
                          justifyContent: mine ? "flex-end" : "flex-start"
                        }}
                      >
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="retro-btn text-xs"
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="retro-btn retro-btn-primary text-xs"
                        >
                          save edit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`demo-bubble ${
                          mine
                            ? "demo-bubble-recipient"
                            : "demo-bubble-inviter"
                        }`}
                      >
                        {m.text}
                      </div>
                      <div className="demo-meta">
                        <span>
                          {mine ? recipientFirst : inviterName.split(/\s+/)[0]}
                          &apos;s twin
                        </span>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => startEdit(i)}
                          className="demo-edit-btn"
                          title="Edit this line — useful when the simulation isn't quite you"
                        >
                          ✎ edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {mine && (
                  <div className="demo-avatar recipient" aria-hidden="true">
                    {avatarSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarSrc} alt="" />
                    ) : (
                      initials
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {messages.length === 0 && !streaming && (
            <div className="demo-empty">
              <p>
                Add context on the right and tap{" "}
                <strong style={{ color: "var(--text)" }}>
                  regenerate
                </strong>{" "}
                to simulate the conversation.
              </p>
            </div>
          )}
          {streaming && (() => {
            // iMessage-style typing bubble. Side mirrors whose turn it
            // is — last message from inviter → recipient is typing
            // (right side), and vice versa. Empty transcript → inviter
            // is opening (left side).
            const last = messages[messages.length - 1];
            const typingSide: "inviter" | "recipient" =
              !last
                ? "inviter"
                : last.sender === "inviter"
                  ? "recipient"
                  : "inviter";
            const isRight = typingSide === "recipient";
            const whoLabel =
              typingSide === "inviter"
                ? `${inviterName.split(/\s+/)[0] || "Inviter"} is typing…`
                : `${recipientFirst || "Your twin"} is typing…`;
            return (
              <div
                style={{
                  display: "flex",
                  justifyContent: isRight ? "flex-end" : "flex-start",
                  width: "100%"
                }}
              >
                <div
                  aria-label={whoLabel}
                  title={whoLabel}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 14px",
                    borderRadius: 16,
                    background: isRight
                      ? "rgba(31, 139, 255, 0.14)"
                      : "var(--panel-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-dim)",
                    fontSize: 12
                  }}
                >
                  <span className="demo-typing-dot" />
                  <span className="demo-typing-dot" style={{ animationDelay: "150ms" }} />
                  <span className="demo-typing-dot" style={{ animationDelay: "300ms" }} />
                  <span style={{ marginLeft: 6, fontSize: 11 }}>
                    {whoLabel}
                  </span>
                </div>
              </div>
            );
          })()}
          <style>{`
            .demo-typing-dot {
              display: inline-block;
              width: 6px;
              height: 6px;
              border-radius: 999px;
              background: currentColor;
              opacity: 0.45;
              animation: demo-typing-bounce 1s ease-in-out infinite;
            }
            @keyframes demo-typing-bounce {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
              30% { transform: translateY(-3px); opacity: 0.95; }
            }
          `}</style>
        </div>

        <div className="demo-regen-bar">
          <span>
            Every line is editable. Edits feed your real twin once you sign up.
          </span>
          <button
            type="button"
            onClick={() => regenerate()}
            disabled={regenerating}
            className="retro-btn retro-btn-primary"
            style={{
              fontSize: 12.5,
              padding: "8px 14px",
              fontWeight: 700,
              borderRadius: 10
            }}
          >
            {regenerating ? "regenerating…" : "↻ regenerate"}
          </button>
        </div>
        {err && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#ef4444" }}>
            {err}
          </div>
        )}
      </div>

      {/* RIGHT — context refine + CTA */}
      <div className="demo-panel">
        <div className="demo-header">
          <div className="demo-title-block">
            <div className="label">refine your twin</div>
            <div className="title">tell us who you actually are</div>
          </div>
        </div>

        <div className="ctx-tabs" role="tablist">
          <button
            role="tab"
            className={`ctx-tab ${activeTab === "context" ? "active" : ""}`}
            onClick={() => setActiveTab("context")}
            aria-selected={activeTab === "context"}
          >
            <BrandLogo brand="linkedin" size={14} />
            <span>Bio</span>
          </button>
          <button
            role="tab"
            className={`ctx-tab ${activeTab === "socials" ? "active" : ""}`}
            onClick={() => setActiveTab("socials")}
            aria-selected={activeTab === "socials"}
          >
            <span
              style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
            >
              <BrandLogo brand="instagram" size={14} />
              <BrandLogo brand="x" size={13} tone="mono" />
            </span>
            <span>Socials</span>
          </button>
          <button
            role="tab"
            className={`ctx-tab ${activeTab === "ai" ? "active" : ""}`}
            onClick={() => setActiveTab("ai")}
            aria-selected={activeTab === "ai"}
          >
            <span style={{ display: "inline-flex", gap: 3 }}>
              <BrandLogo brand="chatgpt" size={13} />
              <BrandLogo brand="claude" size={13} />
            </span>
            <span>From AI</span>
          </button>
        </div>

        {activeTab === "context" && (
          <div className="ctx-section">
            <h4>What we pulled from your public footprint</h4>
            <p className="hint">
              Edit anything that&apos;s off. The simulation rebuilds against
              your corrections.
            </p>
            <textarea
              value={linkedinAbout}
              onChange={(e) => setLinkedinAbout(e.target.value.slice(0, 3000))}
              placeholder="We didn't find a public LinkedIn — paste a bio paragraph here."
              className="ctx-textarea"
              style={{ minHeight: 160 }}
            />
            <div className="ctx-count">{linkedinAbout.length}/3000</div>

            <h4 style={{ marginTop: 18 }}>One more paragraph</h4>
            <p className="hint">
              What you&apos;re working on, what you&apos;re looking for,
              dealbreakers, recent wins. Optional — the more specific the
              better.
            </p>
            <textarea
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value.slice(0, 2000))}
              rows={5}
              placeholder="Recent wins, what would actually be a great intro, things to avoid pitching me…"
              className="ctx-textarea"
            />
            <div className="ctx-count">{extraContext.length}/2000</div>
          </div>
        )}

        {activeTab === "socials" && (
          <div className="ctx-section">
            <h4>Drop your handles</h4>
            <p className="hint">
              We&apos;ll pull recent posts to sharpen the simulation. Skip
              anything that doesn&apos;t apply.
            </p>

            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                marginBottom: 4
              }}
            >
              <BrandLogo brand="instagram" size={14} />
              <span>Instagram</span>
            </label>
            <div className="ctx-row">
              <span className="ctx-prefix">@</span>
              <input
                value={igHandle}
                onChange={(e) =>
                  setIgHandle(e.target.value.replace(/^@/, "").slice(0, 60))
                }
                placeholder="yourhandle"
                className="ctx-input with-prefix"
              />
            </div>

            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 14,
                marginBottom: 4
              }}
            >
              <BrandLogo brand="x" size={12} tone="mono" />
              <span>X / Twitter</span>
            </label>
            <div className="ctx-row">
              <span className="ctx-prefix">@</span>
              <input
                value={xHandle}
                onChange={(e) =>
                  setXHandle(e.target.value.replace(/^@/, "").slice(0, 60))
                }
                placeholder="yourhandle"
                className="ctx-input with-prefix"
              />
            </div>

            <p
              className="hint"
              style={{ marginTop: 16, fontSize: 11 }}
            >
              We never post. We never DM. We just read what&apos;s already
              public to make your twin sound like you.
            </p>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="ctx-section">
            <h4>Pull richer context from your AI of choice</h4>
            <p className="hint">
              Copy the prompt → paste into ChatGPT / Claude / Gemini /
              Perplexity → paste the response in the box below. Twin sounds
              like you in seconds.
            </p>

            <div className="ai-prompt-card">{aiPrompt}</div>

            <div className="ai-prompt-actions">
              <button
                type="button"
                onClick={copyAiPrompt}
                className={`copy-btn ${promptCopied ? "copied" : ""}`}
              >
                {promptCopied
                  ? "✓ copied — now paste in your AI tool"
                  : "⧉ copy prompt"}
              </button>
            </div>

            <div className="ai-tools">
              <span className="ai-tool-pill">
                <BrandLogo brand="chatgpt" size={14} />
                <span>ChatGPT</span>
              </span>
              <span className="ai-tool-pill">
                <BrandLogo brand="claude" size={14} />
                <span>Claude</span>
              </span>
              <span className="ai-tool-pill">
                <BrandLogo brand="gemini" size={14} />
                <span>Gemini</span>
              </span>
              <span className="ai-tool-pill">
                <BrandLogo brand="perplexity" size={14} />
                <span>Perplexity</span>
              </span>
            </div>

            <h4 style={{ marginTop: 22 }}>Paste the response here</h4>
            <p className="hint">
              Paste whatever your AI tool came back with. We&apos;ll fold
              it into the next regenerate.
            </p>
            <textarea
              value={aiResponse}
              onChange={(e) => setAiResponse(e.target.value.slice(0, 4000))}
              rows={6}
              placeholder="Paste the AI's response here…"
              className="ctx-textarea"
              style={{ minHeight: 140 }}
            />
            <div className="ctx-count">{aiResponse.length}/4000</div>
          </div>
        )}

        <button
          type="button"
          onClick={() => regenerate()}
          disabled={regenerating}
          className="retro-btn retro-btn-primary ctx-regen-cta"
        >
          {regenerating ? "regenerating…" : "↻ regenerate with my context"}
        </button>

        <div
          style={{
            borderTop: "1px solid var(--border)",
            marginTop: 18,
            paddingTop: 16
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#1f8bff",
              marginBottom: 10
            }}
          >
            when you&apos;re ready
          </div>
          <Link href={`/login?invite=${slug}`} className="ctx-signin">
            Spin up my real twin →
          </Link>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              marginTop: 10,
              textAlign: "center",
              lineHeight: 1.5
            }}
          >
            Everything you typed and edited carries straight over. Sign-in
            only required to send anything for real.
          </p>
        </div>
      </div>
    </div>
  );
}
