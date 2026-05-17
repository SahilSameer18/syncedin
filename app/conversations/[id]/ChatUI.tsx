"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Message } from "@/lib/types";

const AGREEMENT_MARKER = ">>> AGREEMENT:";
const CLIENT_TURN_CAP = 16; // safety net; server enforces the real cap

// Strip markdown so raw ** / # / ` never show in a chat bubble.
function clean(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*>\s+/gm, "")
    .trim();
}

// Split a message into its conversational body + optional agreement line.
function splitAgreement(text: string): { body: string; agreement: string | null } {
  const idx = text.indexOf(AGREEMENT_MARKER);
  if (idx === -1) return { body: clean(text), agreement: null };
  return {
    body: clean(text.slice(0, idx)),
    agreement: clean(text.slice(idx + AGREEMENT_MARKER.length))
  };
}

const MSG_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

type ResponseState = { response: "accepted" | "rejected"; reason?: string | null };

export function ChatUI({
  conversationId,
  selfUserId,
  selfName,
  selfAvatarUrl,
  other,
  initialMessages,
  initialDone,
  initialMyResponse,
  initialOtherResponse
}: {
  conversationId: string;
  selfUserId: string;
  selfName: string;
  selfAvatarUrl?: string | null;
  other: {
    id: string;
    name: string;
    isTestPersona: boolean;
    avatarUrl?: string | null;
  };
  initialMessages: Message[];
  initialDone: boolean;
  initialMyResponse: ResponseState | null;
  initialOtherResponse: ResponseState | null;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [done, setDone] = useState(initialDone);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menu, setMenu] = useState<
    { id: string; x: number; y: number; canEdit: boolean } | null
  >(null);
  const [myResponse, setMyResponse] = useState<ResponseState | null>(
    initialMyResponse
  );
  const [otherResponse, setOtherResponse] = useState<ResponseState | null>(
    initialOtherResponse
  );
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const scrollerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages.length, running, editingId]);

  // Dismiss the context menu on any outside click / escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  async function readError(res: Response): Promise<string> {
    const j = await res.json().catch(() => ({}) as any);
    return j.detail || j.hint || j.error || `Request failed (HTTP ${res.status})`;
  }

  // Auto-run the conversation: keep generating turns until the server says done.
  const runLoop = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      for (let i = 0; i < CLIENT_TURN_CAP; i++) {
        const res = await fetch("/api/run-conversation", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversation_id: conversationId })
        });
        if (!res.ok) throw new Error(await readError(res));
        const json = await res.json();
        if (json.message) {
          setMessages((m) => [...m, json.message]);
        }
        if (json.done) {
          setDone(true);
          // Fire-and-forget: generate the outcome summary + excitement score.
          fetch("/api/summarize-conversation", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ conversation_id: conversationId })
          }).catch(() => {});
          break;
        }
      }
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setRunning(false);
    }
  }, [conversationId]);

  // On mount:
  //  - if the conversation isn't finished, auto-run it
  //  - if it IS finished, make sure a summary + excitement score exist
  //    (covers conversations that completed before this feature shipped)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!done) {
      runLoop();
    } else {
      fetch("/api/summarize-conversation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId })
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openMenu(e: React.MouseEvent, id: string, canEdit: boolean) {
    e.preventDefault();
    setMenu({ id, x: e.clientX, y: e.clientY, canEdit });
  }

  async function copyMessage(id: string) {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    try {
      await navigator.clipboard.writeText(splitAgreement(m.final_text).body);
    } catch {
      /* clipboard blocked */
    }
    setMenu(null);
  }

  function startEdit(id: string) {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    setEditingId(id);
    setEditText(m.final_text);
    setMenu(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const id = editingId;
    const newText = editText;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/edit-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message_id: id, new_text: newText })
      });
      if (!res.ok) throw new Error(await readError(res));
      // Locally: keep messages up to & including the edited one, drop the rest.
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === id);
        if (idx === -1) return prev;
        const kept = prev.slice(0, idx + 1);
        kept[idx] = { ...kept[idx], final_text: newText, edited: true };
        return kept;
      });
      setEditingId(null);
      setEditText("");
      setDone(false);
    } catch (e: any) {
      setError(e.message || String(e));
      setRunning(false);
      return;
    }
    // Regenerate the rest of the conversation from the edit point.
    setRunning(false);
    runLoop();
  }

  async function acceptAgreement() {
    setError(null);
    try {
      const res = await fetch("/api/respond-agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          response: "accepted"
        })
      });
      if (!res.ok) throw new Error(await readError(res));
      setMyResponse({ response: "accepted" });
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function submitRejection() {
    if (!rejectReason.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/respond-agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          response: "rejected",
          reason: rejectReason
        })
      });
      if (!res.ok) throw new Error(await readError(res));
      // Server dropped the agreement message and injected the reason as a
      // real message. Reflect that locally, then regenerate.
      const reasonText = `I can't agree to that as proposed. ${rejectReason.trim()}`;
      setMessages((prev) => {
        const kept = prev.slice(0, Math.max(0, prev.length - 1));
        return [
          ...kept,
          {
            id: `local-${Date.now()}`,
            conversation_id: conversationId,
            sender_user_id: selfUserId,
            original_draft: reasonText,
            final_text: reasonText,
            edited: false,
            sent_at: new Date().toISOString()
          }
        ];
      });
      setMyResponse(null);
      setOtherResponse(null);
      setRejecting(false);
      setRejectReason("");
      setDone(false);
    } catch (e: any) {
      setError(e.message || String(e));
      setRunning(false);
      return;
    }
    setRunning(false);
    runLoop();
  }

  // Pull the agreement (if any) from the last message for the summary card.
  const lastAgreement = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const { agreement } = splitAgreement(messages[i].final_text);
      if (agreement) return agreement;
    }
    return null;
  })();

  const bothAccepted =
    myResponse?.response === "accepted" &&
    otherResponse?.response === "accepted";

  // Lightweight "link your calendar" — opens a pre-filled Google Calendar event.
  const calendarUrl = lastAgreement
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        `SyncedIn: ${selfName} × ${other.name}`
      )}&details=${encodeURIComponent(
        `Agreed via SyncedIn:\n\n${lastAgreement}`
      )}`
    : "";

  return (
    <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col h-screen">
      <header className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <div>
          <Link href="/dashboard" className="retro-dim text-xs">
            &lt; back
          </Link>
          <div className="text-lg font-bold mt-1 flex items-center gap-2">
            {other.name}
            {other.isTestPersona && (
              <span className="retro-label retro-panel px-1.5 py-0.5">
                sample
              </span>
            )}
          </div>
          <div className="retro-dim text-xs">
            {running
              ? "twins are talking…"
              : done
              ? "conversation complete"
              : "agent-to-agent conversation"}
          </div>
        </div>
        {!running && (
          <button
            onClick={runLoop}
            className="retro-btn text-xs"
            title="Continue / re-run"
          >
            {messages.length === 0 ? "start" : done ? "re-run" : "continue"}
          </button>
        )}
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto py-4 space-y-2">
        {messages.length === 0 && !running && (
          <p className="retro-dim text-sm text-center py-8">
            Press “start” — your twins will run the conversation.
          </p>
        )}

        {messages.map((m) => {
          const mine = m.sender_user_id === selfUserId;
          const { body } = splitAgreement(m.final_text);
          const isEditing = editingId === m.id;

          return (
            <div key={m.id} className={mine ? "text-right" : "text-left"}>
              {isEditing ? (
                <div className={mine ? "text-right" : "text-left"}>
                  {/* Edit happens IN the bubble — same shape, color, side. */}
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={Math.min(
                      12,
                      Math.max(2, editText.split("\n").length)
                    )}
                    autoFocus
                    className="inline-block w-[80%] max-w-md px-3.5 py-2 text-[15px] leading-snug outline-none resize-none align-bottom"
                    style={{
                      fontFamily: MSG_FONT,
                      borderRadius: 18,
                      background: mine ? "#2f6bff" : "#26262b",
                      color: mine ? "#fff" : "#e8e8ea",
                      borderBottomRightRadius: mine ? 5 : 18,
                      borderBottomLeftRadius: mine ? 18 : 5,
                      boxShadow: "0 0 0 2px var(--amber)"
                    }}
                  />
                  <div
                    className={`flex gap-2 mt-1.5 ${
                      mine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                      className="retro-btn text-xs"
                    >
                      cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={running || !editText.trim()}
                      className="retro-btn retro-btn-primary text-xs"
                    >
                      save
                    </button>
                  </div>
                  <div className="retro-dim text-[10px] mt-1">
                    everything after this message regenerates
                  </div>
                </div>
              ) : (
                <>
                  <div
                    onContextMenu={(e) => openMenu(e, m.id, mine)}
                    onDoubleClick={
                      mine ? () => startEdit(m.id) : undefined
                    }
                    className="inline-block max-w-[80%] px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap cursor-default select-text"
                    style={{
                      fontFamily: MSG_FONT,
                      borderRadius: 18,
                      background: mine ? "#2f6bff" : "#26262b",
                      color: mine ? "#fff" : "#e8e8ea",
                      borderBottomRightRadius: mine ? 5 : 18,
                      borderBottomLeftRadius: mine ? 18 : 5
                    }}
                    title={
                      mine
                        ? "Double-click or right-click to edit"
                        : "Right-click to copy"
                    }
                  >
                    {body}
                  </div>
                  {m.edited && (
                    <div
                      className={`text-[10px] retro-dim mt-0.5 ${
                        mine ? "" : "text-left"
                      }`}
                    >
                      ✎ edited
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {running && (
          <div className="text-left">
            <div
              className="inline-block px-3.5 py-2.5 text-sm"
              style={{ background: "#26262b", borderRadius: 18, color: "#9aa0b0" }}
            >
              twins are drafting the next turn
              <span className="retro-cursor" />
            </div>
          </div>
        )}
      </div>

      {/* Agreement card — accept (green ✓) / reject (red ✗) */}
      {lastAgreement && (
        <div
          className="retro-panel p-3 mb-2"
          style={{
            borderColor: bothAccepted ? "var(--green)" : "var(--amber)"
          }}
        >
          <div
            className="retro-label"
            style={{ color: bothAccepted ? "var(--green)" : "var(--amber)" }}
          >
            // {bothAccepted ? "deal sealed" : "proposed final destination"}
          </div>
          <div
            className="mt-1.5 text-sm"
            style={{ fontFamily: MSG_FONT, color: "var(--text)" }}
          >
            {lastAgreement}
          </div>

          {/* counterpart status */}
          <div className="mt-2 text-[11px] retro-dim">
            {other.name}:{" "}
            {otherResponse?.response === "accepted" ? (
              <span className="retro-green">accepted ✓</span>
            ) : otherResponse?.response === "rejected" ? (
              <span className="retro-red">rejected ✗</span>
            ) : (
              "waiting for response"
            )}
          </div>

          {/* my action */}
          {rejecting ? (
            <div className="mt-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder="What doesn't work? Your twins will renegotiate with this in mind."
                className="retro-input text-sm"
                style={{ fontFamily: MSG_FONT }}
              />
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => {
                    setRejecting(false);
                    setRejectReason("");
                  }}
                  className="retro-btn text-xs"
                >
                  cancel
                </button>
                <button
                  onClick={submitRejection}
                  disabled={running || !rejectReason.trim()}
                  className="retro-btn text-xs"
                  style={{ borderColor: "var(--red)", color: "var(--red)" }}
                >
                  ✗ reject &amp; renegotiate
                </button>
              </div>
            </div>
          ) : myResponse?.response === "accepted" ? (
            <div className="mt-2">
              <div className="text-[11px] retro-green">
                You accepted ✓
              </div>
              {bothAccepted && (
                <a
                  href={calendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="retro-btn retro-btn-primary w-full mt-2 text-sm"
                >
                  &gt; Add to Google Calendar
                </a>
              )}
            </div>
          ) : (
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={acceptAgreement}
                disabled={running}
                className="retro-btn flex-1 text-sm"
                style={{
                  borderColor: "var(--green)",
                  color: "var(--green)"
                }}
              >
                ✓ Accept
              </button>
              <button
                onClick={() => setRejecting(true)}
                disabled={running}
                className="retro-btn flex-1 text-sm"
                style={{ borderColor: "var(--red)", color: "var(--red)" }}
              >
                ✗ Reject
              </button>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-[var(--border)] pt-3">
        {error && (
          <div
            className="mb-2 p-2 retro-panel"
            style={{ borderColor: "var(--red)" }}
          >
            <div className="retro-red text-xs font-semibold">
              ! something went wrong
            </div>
            <div className="retro-dim text-[11px] break-words mt-0.5">
              {error}
            </div>
          </div>
        )}
        <div className="retro-dim text-[11px] text-center">
          right-click any message to copy · double-click your own to edit —
          editing regenerates everything after
        </div>
      </div>

      {/* Context menu */}
      {menu && (
        <div
          className="fixed retro-panel retro-shadow z-50 text-sm"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => copyMessage(menu.id)}
            className="block w-full text-left px-4 py-2 hover:bg-[var(--panel-2)]"
          >
            Copy
          </button>
          {menu.canEdit && (
            <button
              onClick={() => startEdit(menu.id)}
              className="block w-full text-left px-4 py-2 hover:bg-[var(--panel-2)] border-t border-[var(--border)]"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </main>
  );
}
