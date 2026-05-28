"use client";

import { useState } from "react";

/**
 * Owner-only floating "Regenerate" button. Calls /api/portfolio-generate
 * with force=true, then reloads the page so the new sections render.
 *
 * Hidden via parent guard (isOwner) — never shown to other viewers.
 */
export function RegenerateButton({ hasExisting }: { hasExisting: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  async function go() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/portfolio-generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true })
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      // Reload so the new sections render. Slight delay so the user
      // sees the success flash.
      setTimeout(() => window.location.reload(), 400);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 22,
        right: 22,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6
      }}
    >
      <button
        type="button"
        onClick={go}
        disabled={busy}
        style={{
          padding: "12px 18px",
          fontSize: 13,
          fontWeight: 800,
          borderRadius: 999,
          border: "none",
          color: "#fff",
          background: "linear-gradient(135deg, #1f59ff 0%, #6b2dc9 100%)",
          boxShadow: "0 14px 28px -10px rgba(31, 89, 255, 0.55)",
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.85 : 1,
          letterSpacing: "0.02em"
        }}
        title="Re-runs Claude over your full twin context to redesign this page."
      >
        {busy
          ? "✦ regenerating…"
          : hasExisting
            ? "✦ regenerate site"
            : "✦ generate my site"}
      </button>
      {err && (
        <span style={{ fontSize: 11, color: "#ef4444" }}>{err}</span>
      )}
    </div>
  );
}
