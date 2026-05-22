"use client";

import { useState } from "react";

/**
 * Inline expand toggle for a proposal card. Unlike the previous lazy-
 * fetched ExpandProposal, the full agreement text is passed in as a
 * prop (pre-fetched server-side in /proposals/page.tsx) so clicking
 * "show the full proposal" is instant — no loading state.
 */
export function ExpandProposalInline({
  fullText
}: {
  fullText: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (!fullText) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
          {fullText}
        </div>
      )}
    </div>
  );
}
