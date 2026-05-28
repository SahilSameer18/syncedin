"use client";

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
 *
 * Reload-free path: every successful action now mutates LOCAL state
 * (acceptedJustNow / rejectedJustNow / onProposalChanged callback)
 * instead of calling router.refresh(). The whole /proposals page is
 * a heavy server render — refresh used to cause a visible re-flow
 * (Jack: "After I did change proposal it had to reload the whole
 * page"). Local state keeps the UI snappy; canonical server data
 * picks up on next nav.
 */
export function InlineActions({
  conversationId,
  alreadyAccepted,
  alreadyRejected,
  currentProposal,
  onProposalChanged
}: {
  conversationId: string;
  alreadyAccepted: boolean;
  alreadyRejected: boolean;
  /** The existing proposal text — pre-fills the Change textarea so
   *  the user edits instead of writes from blank. */
  currentProposal?: string;
  /** Called after a successful "change proposal" save so the parent
   *  can update what's displayed without a router.refresh. If not
   *  provided we still close the editor + show a confirmation, just
   *  without an in-place update of any summary the parent renders. */
  onProposalChanged?: (newText: string) => void;
}) {
  const [busy, setBusy] = useState<"accept" | "deny" | "change" | null>(null);
  const [err, setErr] = useState<string>("");
  const [denyOpen, setDenyOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [acceptedJustNow, setAcceptedJustNow] = useState(false);
  const [rejectedJustNow, setRejectedJustNow] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeText, setChangeText] = useState(currentProposal ?? "");

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
      // No router.refresh — local state ("accepted") already drives
      // the UI swap. Avoids a full re-render of the heavy /proposals
      // server tree.
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function submitChange() {
    if (busy || !changeText.trim()) return;
    setBusy("change");
    setErr("");
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/change-proposal`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: changeText.trim() })
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as any);
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      setChangeOpen(false);
      // Push the new proposal to the parent wrapper so the displayed
      // summary + expand panel update inline. No router.refresh.
      onProposalChanged?.(changeText.trim());
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
      setRejectedJustNow(true);
      // No router.refresh — local "rejected" state hides the deny btn.
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
        {!alreadyAccepted && !acceptedJustNow && (
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
            {busy === "accept" ? "✓ accepted" : "✓ accept"}
          </button>
        )}
        {acceptedJustNow && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#15803d",
              background: "rgba(34, 197, 94, 0.12)",
              border: "1px solid rgba(34, 197, 94, 0.30)",
              borderRadius: 999
            }}
          >
            ✓ accepted
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            // Toggle the inline editor. Reset to the current proposal
            // text each time it opens so the user edits the latest.
            setChangeOpen((v) => {
              if (!v) setChangeText(currentProposal ?? "");
              return !v;
            });
            // Close the deny panel if open — only one editor at a time.
            setDenyOpen(false);
          }}
          disabled={busy !== null}
          className="retro-btn text-xs"
          style={{
            padding: "6px 12px",
            fontWeight: 700
          }}
        >
          {changeOpen ? "cancel" : "✎ change proposal"}
        </button>
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
        {!alreadyRejected && !rejectedJustNow && (
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
        {rejectedJustNow && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#b91c1c",
              background: "rgba(239, 68, 68, 0.10)",
              border: "1px solid rgba(239, 68, 68, 0.30)",
              borderRadius: 999
            }}
          >
            ✕ denied
          </span>
        )}
      </div>
      {changeOpen && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(31, 139, 255, 0.35)",
            background: "rgba(31, 139, 255, 0.05)"
          }}
        >
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#1f8bff",
              letterSpacing: "0.04em",
              textTransform: "uppercase"
            }}
          >
            Edit the proposal
          </label>
          <p
            style={{
              margin: "4px 0 6px",
              fontSize: 11,
              color: "var(--text-dim)",
              lineHeight: 1.45
            }}
          >
            Tweak the deal terms below. Saving clears both sides&apos;
            previous accept / reject so the counterpart sees the new
            version fresh.
          </p>
          <textarea
            value={changeText}
            onChange={(e) => setChangeText(e.target.value.slice(0, 4000))}
            rows={6}
            className="retro-input mt-1"
            style={{
              width: "100%",
              fontSize: 13,
              padding: 10,
              minHeight: 140,
              resize: "vertical"
            }}
          />
          <div
            style={{
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8
            }}
          >
            <span
              style={{ fontSize: 11, color: "var(--text-dim)" }}
            >
              {changeText.length}/4000
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setChangeOpen(false);
                  setChangeText(currentProposal ?? "");
                }}
                className="retro-btn text-xs"
                style={{ padding: "6px 12px" }}
              >
                cancel
              </button>
              <button
                type="button"
                onClick={submitChange}
                disabled={
                  !changeText.trim() ||
                  changeText.trim() === (currentProposal ?? "").trim() ||
                  busy !== null
                }
                className="retro-btn retro-btn-primary text-xs"
                style={{ padding: "6px 12px" }}
              >
                {busy === "change" ? "saving…" : "save new proposal"}
              </button>
            </div>
          </div>
        </div>
      )}
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
