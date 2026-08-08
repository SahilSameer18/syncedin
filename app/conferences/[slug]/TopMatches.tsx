"use client";

import { useState, useEffect } from "react";
import { Avatar } from "../../Avatar";

type Match = { userId: string; displayName: string; avatarUrl: string | null; score: number };

export function TopMatches({ conferenceSlug }: { conferenceSlug: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/room-matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conferenceSlug })
    })
      .then((r) => r.json())
      .then((data) => setMatches(data.matches ?? []))
      .catch((err) => console.error("Failed to load top matches", err))
      .finally(() => setLoading(false));
  }, [conferenceSlug]);

  if (loading) {
    return (
      <div className="retro-panel p-4 text-sm" style={{ color: "var(--text-dim)" }}>
        Finding your top matches in this room…
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <div className="retro-panel p-5 mb-6">
      <div className="retro-label">🎯 Your top matches in this room</div>
      <div className="mt-3 space-y-2">
        {matches.map((m) => (
          <div
            key={m.userId}
            className="flex items-center gap-3 p-2"
            style={{ background: "var(--panel-2)", borderRadius: "var(--radius)" }}
          >
            <Avatar id={m.userId} name={m.displayName} avatarUrl={m.avatarUrl} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.displayName}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>
              {m.score}% match
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

