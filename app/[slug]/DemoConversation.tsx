"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  recipientAvatarUrl
}: {
  slug: string;
  initialMessages: Msg[];
  inviterName: string;
  recipientName: string;
  inviterAvatarUrl: string | null;
  recipientAvatarUrl: string | null;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [extraContext, setExtraContext] = useState<string>("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [regenerating, setRegenerating] = useState(false);
  const [err, setErr] = useState<string>("");

  // Restore prior session state (added context, edits) on mount.
  // If neither stored state nor initialMessages exist, auto-fire the
  // first generation so the demo arrives without the user pressing a
  // button. Loading state shows while it generates.
  useEffect(() => {
    const stored = loadState(slug);
    if (stored) {
      if (Array.isArray(stored.messages) && stored.messages.length > 0) {
        setMessages(stored.messages);
        if (typeof stored.extraContext === "string") {
          setExtraContext(stored.extraContext);
        }
        return; // have stored state — no autogen needed
      }
      if (typeof stored.extraContext === "string") {
        setExtraContext(stored.extraContext);
      }
    }
    if (messages.length === 0) {
      void regenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Persist on every meaningful change.
  useEffect(() => {
    saveState(slug, { messages, extraContext });
  }, [slug, messages, extraContext]);

  async function regenerate(opts?: { withContext?: string }) {
    setRegenerating(true);
    setErr("");
    try {
      // Pull edits out of state so the server keeps them in the rewrite.
      const edits = messages
        .map((m, i) => ({ index: i, text: m.text }))
        .filter((_, i) => {
          // Only treat as an edit if it's different from a hypothetical
          // server-default would-be-generated version. We don't know that,
          // so just send all current lines — the server uses them as
          // soft guidance, not hard overrides.
          return true;
        });
      const res = await fetch("/api/demo-conversation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          extra_context: opts?.withContext ?? extraContext,
          edits
        })
      });
      const j = await res.json();
      if (!res.ok || !Array.isArray(j.messages)) {
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      setMessages(j.messages);
    } catch (e: any) {
      setErr(e?.message || "Couldn't regenerate. Try again in a moment.");
    } finally {
      setRegenerating(false);
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

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 16
      }}
      className="demo-grid"
    >
      <style>{`
        @media (min-width: 900px) {
          .demo-grid {
            grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr) !important;
          }
        }
        .demo-bubble {
          display: inline-block;
          max-width: 86%;
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.45;
          word-wrap: break-word;
        }
        .demo-bubble-inviter {
          background: var(--panel-2);
          color: var(--text);
          border: 1px solid var(--border);
        }
        .demo-bubble-recipient {
          background: #1f8bff;
          color: #ffffff;
        }
        .demo-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          margin-bottom: 6px;
        }
        .demo-row.recipient {
          justify-content: flex-end;
        }
        .demo-avatar {
          width: 28px;
          height: 28px;
          border-radius: 14px;
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
        .demo-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .demo-edit-btn {
          font-size: 10px;
          color: var(--text-dim);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 2px 0;
          text-decoration: underline;
        }
      `}</style>

      {/* LEFT — conversation */}
      <div
        className="retro-panel"
        style={{ padding: 16, minHeight: 360 }}
      >
        <div
          className="retro-label"
          style={{ marginBottom: 10, color: "var(--amber-bright)" }}
        >
          live simulation · what your twins would actually say
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m, i) => {
            const mine = m.sender === "recipient";
            const isEditing = editing === i;
            const avatarSrc = mine ? recipientAvatarUrl : inviterAvatarUrl;
            const initials = (mine ? recipientName : inviterName)
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p: string) => p[0]?.toUpperCase() ?? "")
              .join("");
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
                <div style={{ maxWidth: "86%" }}>
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={Math.max(
                          3,
                          Math.min(10, editDraft.split("\n").length + 1)
                        )}
                        className="retro-input"
                        style={{
                          width: 320,
                          maxWidth: "86vw",
                          fontSize: 14,
                          padding: 10
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 6,
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
                          mine ? "demo-bubble-recipient" : "demo-bubble-inviter"
                        }`}
                      >
                        {m.text}
                      </div>
                      <div
                        style={{
                          textAlign: mine ? "right" : "left",
                          marginTop: 2
                        }}
                      >
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
                  <div className="demo-avatar" aria-hidden="true">
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
          {messages.length === 0 && (
            <p
              className="text-sm"
              style={{ color: "var(--text-dim)" }}
            >
              No simulation yet — paste a paragraph on the right and tap
              regenerate.
            </p>
          )}
        </div>
      </div>

      {/* RIGHT — context refine + CTA */}
      <div
        className="retro-panel"
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}
      >
        <div>
          <div className="retro-label" style={{ color: "var(--amber-bright)" }}>
            this isn&apos;t quite you yet
          </div>
          <p
            className="text-sm"
            style={{ color: "var(--text-dim)", marginTop: 4 }}
          >
            Your twin is a Claude-imagined version of {recipientName} based on
            their public footprint. Give it more context and it&apos;ll regenerate
            the conversation closer to what you&apos;d actually say. Edit any line
            on the left — every edit trains your personal concierge.
          </p>
        </div>

        <div>
          <label
            className="text-xs font-semibold"
            style={{ display: "block", marginBottom: 6 }}
          >
            paste a paragraph about you
          </label>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value.slice(0, 2000))}
            rows={5}
            placeholder="What you're working on, what you're looking for, dealbreakers, recent wins. The more specific, the more the simulation will sound like you."
            className="retro-input"
            style={{
              width: "100%",
              fontSize: 14,
              padding: 10,
              minHeight: 120
            }}
          />
          <div
            className="text-xs"
            style={{
              color: "var(--text-dim)",
              marginTop: 4,
              textAlign: "right"
            }}
          >
            {extraContext.length}/2000
          </div>
        </div>

        <button
          type="button"
          onClick={() => regenerate()}
          disabled={regenerating}
          className="retro-btn retro-btn-primary"
          style={{ fontSize: 14, padding: "10px 14px" }}
        >
          {regenerating ? "regenerating…" : "↻ regenerate with my context"}
        </button>
        {err && (
          <div
            className="text-xs"
            style={{ color: "#ef4444" }}
          >
            {err}
          </div>
        )}

        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
            marginTop: 4
          }}
        >
          <div
            className="text-xs"
            style={{ color: "var(--text-dim)", marginBottom: 6 }}
          >
            when you&apos;re ready
          </div>
          <Link
            href={`/login?invite=${slug}`}
            className="retro-btn retro-btn-primary"
            style={{
              display: "block",
              textAlign: "center",
              fontSize: 14,
              padding: "12px 14px",
              fontWeight: 800
            }}
          >
            open the final deal proposal →
          </Link>
          <p
            className="text-xs"
            style={{
              color: "var(--text-dim)",
              marginTop: 8,
              textAlign: "center"
            }}
          >
            Sign-in only required when you accept. Everything you typed and
            edited carries over to your real twin.
          </p>
        </div>
      </div>
    </div>
  );
}
