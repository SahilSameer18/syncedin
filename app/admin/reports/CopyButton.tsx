"use client";

import { useState } from "react";

/**
 * Tiny client component for the admin error reports page — one-click
 * copy of a fully-formed error blob so Jack can paste straight back
 * into the next Claude session without retyping.
 */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
      className="retro-btn"
      style={{
        fontSize: 12,
        padding: "5px 10px",
        flexShrink: 0,
        borderColor: copied ? "#22c55e" : undefined,
        color: copied ? "#22c55e" : undefined
      }}
    >
      {copied ? "✓ copied" : label}
    </button>
  );
}
