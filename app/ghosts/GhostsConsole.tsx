"use client";

import { useState } from "react";

/**
 * GhostsConsole — paste a URL, watch the conversation play out, send it.
 *
 * Pipeline:
 *  1. User pastes a profile URL (LinkedIn / X / IG / FB) or a website.
 *  2. We hit /api/bulk-create-invites with a single-contact payload —
 *     this reuses the EXACT scrape + ghost-twin + opener-generation
 *     pipeline that powers /invite. Returns a slug.
 *  3. We embed a streaming demo conversation for that slug (reusing
 *     /api/demo-conversation?stream=1, the same SSE endpoint /[slug]
 *     uses for its live demo).
 *  4. Big "send this to them" CTA at the bottom — one click to copy
 *     the opener + the landing URL, plus channel-specific deeplinks.
 *
 * Renders the conversation inline so the user experiences the demo
 * FIRST, then decides whether to send. Inverts the friction of /invite
 * (where the inviter has to send blind and hope the recipient sees the
 * demo).
 */
type GhostInvite = {
  slug: string;
  url: string;
  starter: string;
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    profile_url?: string;
  };
};

type Msg = { sender: "inviter" | "recipient"; text: string };

export function GhostsConsole({
  firstName,
  appUrl
}: {
  firstName: string;
  appUrl: string;
}) {
  const [contact, setContact] = useState("");
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string>("");
  const [ghost, setGhost] = useState<GhostInvite | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);

  async function spawnGhost() {
    if (!contact.trim() || generating) return;
    setGenerating(true);
    setErr("");
    setGhost(null);
    setMessages([]);
    try {
      const looksLikeUrl = /^https?:\/\//i.test(contact.trim());
      const looksLikeEmail = /@/.test(contact.trim());
      const payload = {
        contacts: [
          {
            profile_url: looksLikeUrl ? contact.trim() : undefined,
            email: looksLikeEmail && !looksLikeUrl ? contact.trim() : undefined,
            handle:
              !looksLikeUrl && !looksLikeEmail ? contact.trim() : undefined
          }
        ]
      };
      const res = await fetch("/api/bulk-create-invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(
          j.detail || j.error || `Couldn't summon ghost (HTTP ${res.status}).`
        );
      }
      const r = (j.results ?? [])[0] as GhostInvite | undefined;
      if (!r) {
        throw new Error(
          "No ghost came back. The profile may be private or the scrape vendor is down — try a different URL."
        );
      }
      setGhost(r);
      // Immediately kick off the streamed demo conversation.
      void streamConversation(r.slug);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function streamConversation(slug: string) {
    setStreaming(true);
    setMessages([]);
    try {
      const res = await fetch("/api/demo-conversation?stream=1", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream"
        },
        body: JSON.stringify({ slug })
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const collected: Msg[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
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
              setMessages([...collected]);
            } else if (evt.type === "error") {
              throw new Error(evt.detail || "stream-error");
            }
          } catch {
            /* malformed event — skip */
          }
        }
      }
    } catch (e: any) {
      setErr(e?.message || "Conversation stream broke. Tap regenerate.");
    } finally {
      setStreaming(false);
    }
  }

  async function copyShare() {
    if (!ghost) return;
    const blob = `${ghost.starter}\n\n${ghost.url}`;
    try {
      await navigator.clipboard.writeText(blob);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this:", blob);
    }
  }

  const ghostName = ghost?.contact?.name || "their ghost";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* INPUT PANEL */}
      <div
        style={{
          position: "relative",
          padding: 22,
          borderRadius: 18,
          background: "var(--panel-solid)",
          border: "1px solid var(--border)",
          boxShadow: "0 18px 50px -28px rgba(216, 59, 255, 0.28)",
          overflow: "hidden"
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background:
              "linear-gradient(90deg, #6b2dc9 0%, #d83bff 50%, #6b2dc9 100%)",
            backgroundSize: "200% 100%",
            animation: "ghostSweep 5s linear infinite"
          }}
        />
        <style>{`
          @keyframes ghostSweep {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
          .ghost-bubble {
            padding: 11px 14px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.45;
            max-width: 78%;
            word-wrap: break-word;
          }
          .ghost-bubble.inviter {
            background: linear-gradient(135deg, #1f8bff 0%, #2563eb 100%);
            color: #fff;
            border-bottom-right-radius: 4px;
          }
          .ghost-bubble.recipient {
            background: var(--panel-2);
            color: var(--text);
            border: 1px solid var(--border);
            border-bottom-left-radius: 4px;
          }
          .ghost-typing-dot {
            width: 6px; height: 6px; border-radius: 999px;
            background: currentColor; opacity: 0.45;
            animation: ghostTyping 1s ease-in-out infinite;
            display: inline-block;
          }
          @keyframes ghostTyping {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-3px); opacity: 0.95; }
          }
        `}</style>

        <h3
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.005em"
          }}
        >
          Who do you want to talk to?
        </h3>
        <p
          className="text-sm"
          style={{
            color: "var(--text-dim)",
            margin: "6px 0 14px",
            lineHeight: 1.5
          }}
        >
          Drop a profile URL, an email, or just a name. We&apos;ll summon
          their ghost from public data and play out the conversation.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "stretch"
          }}
        >
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && spawnGhost()}
            placeholder="linkedin.com/in/jane-doe  ·  jane@acme.com  ·  @janedoe"
            style={{
              flex: "1 1 320px",
              minWidth: 0,
              fontSize: 15,
              padding: "14px 16px",
              borderRadius: 12,
              border: "1.5px solid var(--border)",
              background: "var(--panel-2)",
              color: "var(--text)"
            }}
          />
          <button
            type="button"
            onClick={spawnGhost}
            disabled={!contact.trim() || generating}
            style={{
              padding: "13px 22px",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              color: "#fff",
              background:
                !contact.trim() || generating
                  ? "var(--panel-2)"
                  : "linear-gradient(135deg, #6b2dc9 0%, #d83bff 100%)",
              cursor:
                !contact.trim() || generating ? "not-allowed" : "pointer",
              opacity: !contact.trim() || generating ? 0.6 : 1,
              boxShadow: contact.trim()
                ? "0 10px 28px -10px rgba(216, 59, 255, 0.55)"
                : "none"
            }}
          >
            {generating ? "summoning…" : "👻 summon ghost"}
          </button>
        </div>
        {err && (
          <p
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "#ef4444"
            }}
          >
            {err}
          </p>
        )}
      </div>

      {/* CONVERSATION PANEL */}
      {ghost && (
        <div
          style={{
            padding: 22,
            borderRadius: 18,
            background: "var(--panel-solid)",
            border: "1px solid var(--border)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: 4
                }}
              >
                live demo · {firstName} ↔ {ghostName}
              </div>
              <div
                style={{ fontSize: 16, fontWeight: 700 }}
              >
                {streaming
                  ? "watching them talk…"
                  : "here&apos;s how it would go."}
              </div>
            </div>
            <button
              type="button"
              onClick={() => ghost && streamConversation(ghost.slug)}
              disabled={streaming}
              className="retro-btn text-xs"
              style={{ padding: "7px 12px", borderRadius: 10 }}
            >
              {streaming ? "streaming…" : "↻ regenerate"}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 480,
              overflowY: "auto",
              padding: "4px 2px"
            }}
          >
            {messages.length === 0 && !streaming && (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 12px",
                  color: "var(--text-dim)",
                  fontSize: 13
                }}
              >
                Spinning up your twin and their ghost…
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent:
                    m.sender === "inviter" ? "flex-end" : "flex-start"
                }}
              >
                <div className={`ghost-bubble ${m.sender}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {streaming && (
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    messages[messages.length - 1]?.sender === "inviter"
                      ? "flex-start"
                      : "flex-end"
                }}
              >
                <div
                  className={`ghost-bubble ${
                    messages[messages.length - 1]?.sender === "inviter"
                      ? "recipient"
                      : "inviter"
                  }`}
                  style={{ display: "inline-flex", gap: 4 }}
                >
                  <span className="ghost-typing-dot" />
                  <span
                    className="ghost-typing-dot"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="ghost-typing-dot"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEND-IT-FOR-REAL CTA */}
      {ghost && messages.length > 0 && !streaming && (
        <div
          style={{
            padding: 22,
            borderRadius: 18,
            background:
              "linear-gradient(135deg, rgba(31, 139, 255, 0.06) 0%, rgba(216, 59, 255, 0.06) 100%)",
            border: "1px solid rgba(216, 59, 255, 0.32)"
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#d83bff",
              marginBottom: 6
            }}
          >
            close the loop
          </div>
          <h3
            style={{
              margin: "0 0 6px",
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.005em"
            }}
          >
            Send this to {ghostName}.
          </h3>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: 14,
              margin: "0 0 14px",
              lineHeight: 1.55,
              maxWidth: 620
            }}
          >
            Their landing page is live — when they click, they&apos;ll see
            this exact conversation and can claim their real twin to
            respond.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center"
            }}
          >
            <button
              type="button"
              onClick={copyShare}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                border: "none",
                color: "#fff",
                background:
                  "linear-gradient(135deg, #1f8bff 0%, #6b2dc9 100%)",
                cursor: "pointer",
                boxShadow: "0 10px 28px -10px rgba(31, 139, 255, 0.55)"
              }}
            >
              {copied ? "✓ copied" : "📋 copy message + link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `${ghost.starter}\n\n${ghost.url}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                background: "rgba(37, 211, 102, 0.12)",
                color: "#16a34a",
                border: "1px solid rgba(37, 211, 102, 0.36)",
                textDecoration: "none"
              }}
            >
              🟢 WhatsApp
            </a>
            <a
              href={`sms:?&body=${encodeURIComponent(
                `${ghost.starter}\n\n${ghost.url}`
              )}`}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                background: "rgba(59, 130, 246, 0.10)",
                color: "#3b82f6",
                border: "1px solid rgba(59, 130, 246, 0.32)",
                textDecoration: "none"
              }}
            >
              💬 SMS
            </a>
            {ghost.contact.email && (
              <a
                href={`mailto:${ghost.contact.email}?subject=${encodeURIComponent(
                  "An invite from " + appUrl
                )}&body=${encodeURIComponent(`${ghost.starter}\n\n${ghost.url}`)}`}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  background: "rgba(168, 85, 247, 0.10)",
                  color: "#a855f7",
                  border: "1px solid rgba(168, 85, 247, 0.32)",
                  textDecoration: "none"
                }}
              >
                ✉️ Email
              </a>
            )}
            <a
              href={ghost.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: "auto",
                padding: "12px 14px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                background: "transparent",
                color: "var(--text-dim)",
                border: "1px solid var(--border)",
                textDecoration: "none"
              }}
              title="Preview the landing page the recipient will see"
            >
              🔗 preview their page
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
