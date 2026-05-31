"use client";

import { useEffect, useRef, useState } from "react";

/**
 * TalkChat — the streaming-style chat UI for /talk. POSTs to
 * /api/talk which returns { reply, tool_results, signup_url }.
 *
 * Layout: full-screen flex column. Header up in /talk/page.tsx;
 * this component owns scroller + composer + signup button.
 *
 * v1: non-streaming (full reply returns after Claude finishes).
 * Adequate for Haiku response times (1-3s). v2 swaps in real SSE.
 */
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const EXAMPLE_PROMPTS = [
  "who's on the platform?",
  "anyone like me — I'm a founder doing AI",
  "show me my top 3 matches",
  "how does this work?"
];

export function TalkChat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "intro",
      role: "assistant",
      content:
        "Hey, I'm Sync — the AI that knows everyone on SyncedIn. Ask me who's here, who you should meet, or how the platform works. When you're ready, drop your handle and I'll show you your top 3 matches before you even sign up."
    }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new message or when busy starts.
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages.length, busy]);

  async function send(text?: string) {
    const body = (text ?? input).trim();
    if (!body || busy) return;
    setError(null);
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: body
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/talk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content }))
        })
      });
      const j = await res.json();
      if (!res.ok || j?.error) {
        setError(j?.detail || j?.error || "Couldn't reach Sync.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: j.reply || "(no reply)"
        }
      ]);
      if (j.signup_url && typeof j.signup_url === "string") {
        setSignupUrl(j.signup_url);
      }
    } catch (e: any) {
      setError(e?.message || "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        maxWidth: 760,
        margin: "0 auto",
        width: "100%",
        padding: "0 16px 16px",
        minHeight: 0
      }}
    >
      {/* SCROLLER — independent overflow so the page doesn't body-scroll */}
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehavior: "contain",
          paddingTop: 20,
          paddingBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minHeight: 0
        }}
      >
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}

        {busy && (
          <div
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              background: "var(--panel-solid)",
              border: "1px solid var(--border)",
              borderRadius: 18,
              color: "var(--text-dim)"
            }}
            aria-label="Sync is thinking"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "currentColor",
                  opacity: 0.7,
                  animation: `talkDot 1.2s ${i * 0.18}s infinite ease-in-out`
                }}
              />
            ))}
            <style>{`
              @keyframes talkDot {
                0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
                30%           { opacity: 1;    transform: translateY(-2px); }
              }
            `}</style>
          </div>
        )}

        {error && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "8px 12px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: 10,
              fontSize: 12,
              color: "#ef4444"
            }}
          >
            {error}
          </div>
        )}

        {signupUrl && (
          <a
            href={signupUrl}
            style={{
              alignSelf: "flex-start",
              padding: "10px 18px",
              borderRadius: 999,
              background:
                "linear-gradient(135deg, #2358ff 0%, #6b2dc9 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              boxShadow: "0 8px 24px -8px rgba(31, 139, 255, 0.55)"
            }}
          >
            Sign up — spin up my twin →
          </a>
        )}

        {/* Example-prompt chips, only shown when the conversation
            is just the intro message + no signup CTA surfaced yet. */}
        {messages.length === 1 && !signupUrl && (
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 4
            }}
          >
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => void send(p)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                  color: "var(--text-dim)",
                  cursor: "pointer"
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* COMPOSER */}
      <div
        style={{
          flexShrink: 0,
          paddingTop: 10,
          borderTop: "1px solid var(--border)"
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end"
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask Sync anything — or paste your @handle"
            rows={1}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 18,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 15,
              lineHeight: 1.4,
              minHeight: 44,
              maxHeight: 160,
              resize: "none",
              outline: "none",
              fontFamily: "inherit"
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: "none",
              background:
                busy || !input.trim()
                  ? "var(--border)"
                  : "linear-gradient(135deg, #2358ff 0%, #6b2dc9 100%)",
              color: "#fff",
              fontSize: 18,
              cursor: busy || !input.trim() ? "default" : "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "var(--text-dim)",
            textAlign: "center"
          }}
        >
          Free · No signup required to chat with Sync
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const mine = m.role === "user";
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "min(86%, 580px)"
      }}
    >
      {!mine && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#1f8bff",
            marginBottom: 3
          }}
        >
          Sync
        </div>
      )}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 18,
          background: mine
            ? "linear-gradient(135deg, #2358ff 0%, #4a3dff 100%)"
            : "var(--panel-solid)",
          color: mine ? "#fff" : "var(--text)",
          border: mine ? "none" : "1px solid var(--border)",
          fontSize: 14.5,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}
      >
        {renderInlineMarkdown(m.content)}
      </div>
    </div>
  );
}

// Tiny **bold** + `code` renderer so the AI's markdown actually
// formats. Headers / lists pass through as plain text — keep small.
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(<strong key={`b${k++}`}>{tok.slice(2, -2)}</strong>);
    } else {
      out.push(
        <code
          key={`c${k++}`}
          style={{
            background: "rgba(120,130,160,0.18)",
            padding: "1px 5px",
            borderRadius: 4,
            fontSize: "0.92em",
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
          }}
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
