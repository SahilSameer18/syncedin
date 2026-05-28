"use client";

import { useEffect, useRef, useState } from "react";

type ChatRow = {
  id: string;
  role: "user" | "assistant";
  body: string;
  created_at?: string | null;
};

/**
 * Client-side chat surface for /twin (#159). Loads history once, then
 * appends locally on send. Optimistic user message render + spinner
 * while we wait on Claude.
 */
export function TwinChatUI({ selfName }: { selfName: string }) {
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Load history once on mount.
  useEffect(() => {
    let alive = true;
    fetch("/api/twin/chat", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setMessages((j?.messages ?? []) as ChatRow[]);
        setLoaded(true);
        if (j?._err === "schema_missing") {
          setErr(
            "Run the latest schema.sql in Supabase — twin_chat_messages table missing."
          );
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Scroll to bottom whenever a new message arrives.
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages.length, sending]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setErr(null);
    // Optimistic user bubble.
    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        role: "user",
        body: t,
        created_at: new Date().toISOString()
      }
    ]);
    setText("");
    try {
      const res = await fetch("/api/twin/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: t })
      });
      const j = await res.json();
      if (!res.ok || j?.error) {
        setErr(j?.detail || j?.error || "Couldn't reach your twin.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: j.assistant?.id ?? `a-${Date.now()}`,
          role: "assistant",
          body: j.assistant?.body ?? "(no reply)",
          created_at:
            j.assistant?.created_at ?? new Date().toISOString()
        }
      ]);
    } catch (e: any) {
      setErr(e?.message ?? "Network error.");
    } finally {
      setSending(false);
    }
  }

  // Enter to send, Shift+Enter for newline.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const empty = loaded && messages.length === 0;

  return (
    <div
      className="retro-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 160px)",
        minHeight: 420,
        padding: 0,
        overflow: "hidden"
      }}
    >
      {/* Scrolling thread */}
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}
      >
        {!loaded && (
          <div className="retro-dim text-sm">Loading your thread…</div>
        )}
        {empty && (
          <div className="retro-dim text-sm" style={{ maxWidth: 520 }}>
            This is your private thread with your twin. Ask it for triage on
            pending proposals, talk through what you actually want, or correct
            its voice. Try:
            <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>
                &quot;Which of my pending proposals is the highest-leverage move
                this week?&quot;
              </li>
              <li>
                &quot;Rewrite my goals — be sharper, less hedged.&quot;
              </li>
              <li>
                &quot;Stop sounding so formal in my conversations.&quot;
              </li>
            </ul>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} selfName={selfName} />
        ))}
        {sending && (
          <div
            className="retro-dim text-xs"
            style={{ alignSelf: "flex-start" }}
          >
            your twin is thinking…
          </div>
        )}
        {err && (
          <div className="text-xs" style={{ color: "var(--red, #d44)" }}>
            {err}
          </div>
        )}
      </div>

      {/* Input row — same retro-input pattern as the main convo composer */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: 10,
          display: "flex",
          gap: 8,
          alignItems: "flex-end"
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Talk to your twin…"
          rows={2}
          className="retro-input"
          style={{ flex: 1, fontSize: 14, padding: 10, resize: "none" }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !text.trim()}
          className="retro-btn retro-btn-primary"
          style={{ padding: "10px 18px", fontWeight: 700 }}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

function Bubble({ m, selfName }: { m: ChatRow; selfName: string }) {
  const mine = m.role === "user";
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "min(92%, 620px)"
      }}
    >
      <div
        className="retro-dim text-[11px]"
        style={{ marginBottom: 2, textAlign: mine ? "right" : "left" }}
      >
        {mine ? selfName : "your twin"}
      </div>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 14,
          background: mine ? "var(--blue, #2358ff)" : "var(--panel-solid)",
          color: mine ? "#fff" : "var(--text)",
          border: mine ? "none" : "1px solid var(--border)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 14,
          lineHeight: 1.5
        }}
      >
        {m.body}
      </div>
    </div>
  );
}
