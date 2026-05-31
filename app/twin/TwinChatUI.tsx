"use client";

import { useEffect, useRef, useState } from "react";

type ChatRow = {
  id: string;
  role: "user" | "assistant";
  body: string;
  created_at?: string | null;
};

/**
 * Talk-to-your-twin chat (#159). The "dojo" — Jack: "you can edit both
 * sides of the conversation and basically fix either response, and
 * that's data."
 *
 * Layout: composer is FIXED to the bottom of the viewport (offset for
 * AppShell sidebar on desktop) so it's always reachable without
 * scrolling. The scroller has bottom padding equal to composer height
 * so messages aren't hidden behind it.
 *
 * Bubbles: iMessage-style. Click any bubble (user OR twin) to inline-
 * edit. Save patches /api/twin/chat/edit — assistant edits also log to
 * edit_deltas so future twin replies learn from the correction.
 */
const COMPOSER_HEIGHT = 96; // approximate height of the bottom composer

export function TwinChatUI({ selfName }: { selfName: string }) {
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
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

  // Auto-scroll on new message / typing indicator.
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

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function beginEdit(m: ChatRow) {
    setEditingId(m.id);
    setEditText(m.body);
  }

  async function saveEdit() {
    if (!editingId || savingEdit) return;
    const newBody = editText.trim();
    if (!newBody) return;
    setSavingEdit(true);
    // Optimistic local update.
    setMessages((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, body: newBody } : m))
    );
    const id = editingId;
    setEditingId(null);
    try {
      await fetch("/api/twin/chat/edit", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message_id: id, body: newBody })
      });
    } catch {
      /* swallow — local update already applied; if server rejects, it's
         only on next page load the original returns */
    } finally {
      setSavingEdit(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  const empty = loaded && messages.length === 0;

  return (
    <>
      {/* SCROLLER — fills the viewport from below the page intro to
          just above the fixed composer. Padding-bottom equal to the
          composer height keeps the last message visible.*/}
      <div
        ref={scrollerRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingBottom: COMPOSER_HEIGHT + 24,
          minHeight: `calc(100dvh - 320px)`
        }}
      >
        {!loaded && (
          <div className="retro-dim text-sm">Loading your thread…</div>
        )}
        {empty && (
          <div
            className="retro-panel"
            style={{ padding: 16, maxWidth: 560 }}
          >
            <div
              className="text-sm"
              style={{ color: "var(--text-dim)", lineHeight: 1.55 }}
            >
              This is your private dojo with your twin. Every reply is
              editable — click any bubble to refine it. Your edits train
              future twin replies. Try:
            </div>
            <ul
              style={{
                marginTop: 10,
                paddingLeft: 18,
                lineHeight: 1.7,
                fontSize: 13
              }}
            >
              <li>
                &quot;Which of my pending proposals is the highest-leverage
                move this week?&quot;
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
          <Bubble
            key={m.id}
            m={m}
            selfName={selfName}
            editing={editingId === m.id}
            editText={editText}
            onBeginEdit={() => beginEdit(m)}
            onChangeEditText={setEditText}
            onSave={saveEdit}
            onCancel={cancelEdit}
            saving={savingEdit}
          />
        ))}
        {sending && (
          <div
            className="retro-dim text-xs"
            style={{ alignSelf: "flex-start", paddingLeft: 4 }}
          >
            your twin is thinking…
          </div>
        )}
        {err && (
          <div
            className="text-xs"
            style={{
              color: "var(--red, #d44)",
              padding: "8px 12px",
              background: "rgba(220, 68, 68, 0.08)",
              borderRadius: 8
            }}
          >
            {err}
          </div>
        )}
      </div>

      {/* FIXED COMPOSER — sticks to viewport bottom regardless of scroll
          position. Offset for AppShell sidebar on desktop via media
          query in <style>. */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--panel-solid)",
          borderTop: "1px solid var(--border)",
          padding: "12px 16px",
          paddingBottom:
            "calc(12px + env(safe-area-inset-bottom, 0px))",
          zIndex: 30
        }}
        className="twin-composer"
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            gap: 8,
            alignItems: "flex-end"
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Talk to your twin… (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="retro-input"
            style={{
              flex: 1,
              fontSize: 14,
              padding: "10px 14px",
              resize: "none",
              minHeight: 44,
              maxHeight: 160,
              borderRadius: 14
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !text.trim()}
            className="retro-btn retro-btn-primary"
            style={{
              padding: "0 18px",
              minHeight: 44,
              fontWeight: 700,
              borderRadius: 14,
              flexShrink: 0
            }}
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>

      {/* Desktop offset: leave space for the 220px AppShell sidebar +
          16px gap. Mobile keeps full width. */}
      <style>{`
        @media (min-width: 768px) {
          .twin-composer { left: 252px; }
        }
      `}</style>
    </>
  );
}

function Bubble({
  m,
  selfName,
  editing,
  editText,
  onBeginEdit,
  onChangeEditText,
  onSave,
  onCancel,
  saving
}: {
  m: ChatRow;
  selfName: string;
  editing: boolean;
  editText: string;
  onBeginEdit: () => void;
  onChangeEditText: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const mine = m.role === "user";
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "min(86%, 580px)",
        position: "relative"
      }}
    >
      <div
        className="retro-dim text-[10px]"
        style={{
          marginBottom: 3,
          textAlign: mine ? "right" : "left",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: mine ? "var(--text-dim)" : "var(--blue, #2358ff)"
        }}
      >
        {mine ? selfName : "your twin"}
      </div>
      {editing ? (
        <div
          style={{
            background: "var(--panel-solid)",
            border: "2px solid var(--blue, #2358ff)",
            borderRadius: 16,
            padding: 8,
            minWidth: 280
          }}
        >
          <textarea
            value={editText}
            onChange={(e) => onChangeEditText(e.target.value)}
            rows={Math.max(3, Math.ceil(editText.length / 64))}
            autoFocus
            className="retro-input"
            style={{
              width: "100%",
              fontSize: 14,
              lineHeight: 1.5,
              padding: 8,
              border: "none",
              background: "transparent",
              resize: "vertical",
              minHeight: 64
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 6,
              justifyContent: "flex-end",
              marginTop: 4
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="retro-btn text-xs"
              style={{ padding: "4px 10px" }}
            >
              cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !editText.trim()}
              className="retro-btn retro-btn-primary text-xs"
              style={{ padding: "4px 12px", fontWeight: 700 }}
            >
              {saving ? "…" : mine ? "save" : "save · trains twin"}
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={onBeginEdit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onBeginEdit();
            }
          }}
          title="Click to edit · refining this is training data"
          style={{
            padding: "10px 14px",
            borderRadius: 18,
            background: mine
              ? "linear-gradient(135deg, #2358ff 0%, #4a3dff 100%)"
              : "var(--panel-solid)",
            color: mine ? "#fff" : "var(--text)",
            border: mine
              ? "none"
              : "1px solid var(--border)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 14,
            lineHeight: 1.5,
            cursor: "pointer",
            transition: "transform 80ms ease, box-shadow 80ms ease",
            position: "relative"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 4px 14px -4px rgba(0,0,0,0.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {m.body}
          {/* tiny edit hint, fades in on hover via CSS-in-JS sibling */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -6,
              [mine ? "left" : "right"]: -6,
              fontSize: 10,
              color: mine ? "var(--text-dim)" : "var(--text-dim)",
              opacity: 0.5,
              pointerEvents: "none",
              background: "var(--panel-solid)",
              padding: "1px 5px",
              borderRadius: 8,
              border: "1px solid var(--border)"
            } as React.CSSProperties}
          >
            ✎
          </span>
        </div>
      )}
    </div>
  );
}
