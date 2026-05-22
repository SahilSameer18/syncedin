"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Inline accept / counter / change / deny actions on the /proposals
 * page. Hits the same /api/respond-agreement endpoint the chat UI
 * uses so the user doesn't have to jump to /conversations/[id] just
 * to click again.
 *
 * Per Jack: "I should be able to click accept from the proposals
 * page and have that be accepted... The same issue occurs with
 * counter and change proposal and deny with reason."
 *
 *  - Accept → POST {response: "accepted"} and refresh the route.
 *  - Deny w/ reason → expand a textarea, then POST {response:
 *    "rejected", reason}.
 *  - Change / Counter → still link to the chat with the right hash
 *    + action query (they open the agreement panel in edit / counter
 *    mode there, which needs the message stream to be live).
 */
export function InlineActions({
  conversationId,
  alreadyAccepted,
  alreadyRejected
}: {
  conversationId: string;
  alreadyAccepted: boolean;
  alreadyRejected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "deny" | null>(null);
  const [err, setErr] = useState<string>("");
  const [denyOpen, setDenyOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [acceptedJustNow, setAcceptedJustNow] = useState(false);

  async function accept() {
    if (busy) return;
    setBusy("accept");
    setErr("");
    try {
      const res = await fetch("/api/respond-agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          response: "accepted"
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as any);
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      setAcceptedJustNow(true);
      // Refresh the server-rendered page so the row re-renders in the
      // "accepted" state without a hard navigation.
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function submitDeny() {
    if (busy || !reason.trim()) return;
    setBusy("deny");
    setErr("");
    try {
      const res = await fetch("/api/respond-agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          response: "rejected",
          reason: reason.trim()
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as any);
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      setDenyOpen(false);
      setReason("");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a
          href={`/conversations/${conversationId}`}
          className="retro-btn text-xs"
          style={{
            padding: "6px 12px",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4
          }}
        >
          💬 open full messages
        </a>
        {!alreadyAccepted && (
          <button
            type="button"
            onClick={accept}
            disabled={busy !== null}
            className="retro-btn retro-btn-primary text-xs"
            style={{
              padding: "6px 12px",
              fontWeight: 700,
              opacity: busy ? 0.6 : 1
            }}
          >
            {busy === "accept" || acceptedJustNow
              ? "✓ accepted"
              : "✓ accept"}
          </button>
        )}
        <a
          href={`/conversations/${conversationId}?action=change#agreement`}
          className="retro-btn text-xs"
          style={{
            padding: "6px 12px",
            fontWeight: 700,
            textDecoration: "none"
          }}
        >
          ✎ change proposal
        </a>
        <a
          href={`/conversations/${conversationId}?action=counter#agreement`}
          className="retro-btn text-xs"
          style={{
            padding: "6px 12px",
            fontWeight: 700,
            textDecoration: "none"
          }}
        >
          ↺ counter
        </a>
        {!alreadyRejected && (
          <button
            type="button"
            onClick={() => setDenyOpen((v) => !v)}
            disabled={busy !== null}
            className="retro-btn text-xs"
            style={{
              padding: "6px 12px",
              fontWeight: 700,
              color: "#ef4444",
              borderColor: "rgba(239, 68, 68, 0.35)"
            }}
          >
            {denyOpen ? "cancel" : "✕ deny with reason"}
          </button>
        )}
      </div>
      {denyOpen && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(239, 68, 68, 0.35)",
            background: "rgba(239, 68, 68, 0.05)"
          }}
        >
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#ef4444",
              letterSpacing: "0.04em",
              textTransform: "uppercase"
            }}
          >
            Reason for denial
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 600))}
            placeholder="What needs to change for you to accept this? Your twin will regenerate the conversation with this objection in context."
            rows={3}
            className="retro-input mt-1"
            style={{ width: "100%", fontSize: 13, padding: 10 }}
          />
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 8,
              justifyContent: "flex-end"
            }}
          >
            <button
              type="button"
              onClick={() => {
                setDenyOpen(false);
                setReason("");
              }}
              className="retro-btn text-xs"
              style={{ padding: "6px 12px" }}
            >
              cancel
            </button>
            <button
              type="button"
              onClick={submitDeny}
              disabled={!reason.trim() || busy !== null}
              className="retro-btn text-xs"
              style={{
                padding: "6px 12px",
                color: "#fff",
                background: "#ef4444",
                borderColor: "#ef4444"
              }}
            >
              {busy === "deny" ? "submitting…" : "submit denial"}
            </button>
          </div>
        </div>
      )}
      {err && (
        <div style={{ fontSize: 12, color: "#ef4444" }}>{err}</div>
      )}
    </div>
  );
}
