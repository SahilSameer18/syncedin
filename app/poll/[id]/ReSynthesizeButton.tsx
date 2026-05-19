"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ReSynthesizeButton — anyone who can view the poll can request a fresh
 * synthesis (since human overrides may have been added since the last run).
 * Hits /api/polls/[id]/synthesize and refreshes.
 */
export function ReSynthesizeButton({ pollId }: { pollId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const r = await fetch(`/api/polls/${pollId}/synthesize`, {
        method: "POST"
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.detail || j.error || "Re-synthesize failed.");
        setRunning(false);
        return;
      }
      router.refresh();
      setRunning(false);
    } catch {
      setError("Couldn't reach the server.");
      setRunning(false);
    }
  }

  return (
    <div className="mt-5 flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="retro-btn text-xs"
      >
        {running ? "re-synthesizing…" : "↻ re-synthesize with overrides"}
      </button>
      {error && (
        <span className="text-xs" style={{ color: "var(--red, #ef4444)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
