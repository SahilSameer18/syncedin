"use client";

import { useState } from "react";

/**
 * Toggle to expand a proposal card and reveal the FULL agreement text
 * the twins converged on — vs. the short `summary` headline that's
 * always visible. Lazy-fetches /api/conversations/<id>/agreement-text
 * on first expand so we don't bloat the proposals page payload by
 * embedding every full agreement upfront.
 */
export function ExpandProposal({
  conversationId
}: {
  conversationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (loaded) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/agreement-text`
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setText(
        j.agreement_text ||
          j.summary ||
          "(No full agreement text found — only the short summary above.)"
      );
      setLoaded(true);
    } catch (e: any) {
      setErr(e?.message || "Couldn't load the full proposal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={toggle}
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          color: "#1f8bff",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer"
        }}
      >
        {open ? "▲ hide full proposal" : "▼ show the full proposal"}
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 10,
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text)",
            whiteSpace: "pre-wrap"
          }}
        >
          {busy ? (
            <span style={{ color: "var(--text-dim)" }}>Loading…</span>
          ) : err ? (
            <span style={{ color: "#ef4444" }}>{err}</span>
          ) : (
            text
          )}
        </div>
      )}
    </div>
  );
}
