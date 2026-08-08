"use client";

import { useState, useEffect } from "react";
import { Avatar } from "../../Avatar";
import { startConversationWithUser } from "../../dashboard/actions";

type Match = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
};

export function TopMatches({ conferenceSlug }: { conferenceSlug: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);

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
      <section
        className="retro-panel p-5 sm:p-7 mb-8"
        style={{
          border: "1px solid var(--border-bright)",
          boxShadow: "0 8px 30px -10px var(--accent-glow)",
          borderRadius: "var(--radius)"
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{
                background: "var(--amber-bright)",
                boxShadow: "0 0 8px var(--accent-glow)"
              }}
            />
            <span
              className="retro-label"
              style={{ color: "var(--amber-bright)", fontSize: 11 }}
            >
              🎯 AI Match Radar · Top Matches
            </span>
          </div>
          <span
            className="font-mono text-[11px] uppercase tracking-wider"
            style={{ color: "var(--text-dim)" }}
          >
            Scanning Room Vectors…
          </span>
        </div>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-2 text-[var(--text)]">
          Calculating your highest-leverage connections in this room…
        </h2>
        <p className="text-xs mb-5" style={{ color: "var(--text-dim)" }}>
          Your digital twin is running 768-dimensional reciprocal cosine matching against all room members.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl animate-pulse flex flex-col justify-between"
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                height: 140,
                borderRadius: "var(--radius)"
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full"
                  style={{ background: "var(--panel-solid)" }}
                />
                <div className="space-y-2 flex-1">
                  <div
                    className="h-3.5 w-3/4 rounded"
                    style={{ background: "var(--panel-solid)" }}
                  />
                  <div
                    className="h-2.5 w-1/2 rounded"
                    style={{ background: "var(--panel-solid)" }}
                  />
                </div>
              </div>
              <div
                className="h-2 w-full rounded mt-4"
                style={{ background: "var(--panel-solid)" }}
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (matches.length === 0) return null;

  return (
    <section
      className="retro-panel p-5 sm:p-7 mb-10"
      style={{
        border: "1px solid var(--border-bright)",
        boxShadow: "0 8px 32px -8px var(--accent-glow)",
        borderRadius: "var(--radius)"
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: "var(--green)",
              boxShadow: "0 0 10px var(--green)"
            }}
          />
          <span
            className="retro-label"
            style={{ color: "var(--green)", fontSize: 11 }}
          >
            🎯 Live Match Radar
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExplanation((prev) => !prev)}
            className="text-[11px] font-mono hover:underline cursor-pointer flex items-center gap-1"
            style={{ color: "var(--amber-bright)" }}
          >
            <span>{showExplanation ? "✕ Hide info" : "💡 How it works"}</span>
          </button>
          <span
            className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full"
            style={{
              color: "var(--text-dim)",
              background: "var(--panel-2)",
              border: "1px solid var(--border)"
            }}
          >
            {matches.length} Top {matches.length === 1 ? "Match" : "Matches"}
          </span>
        </div>
      </div>

      <h2
        className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1 mb-1.5"
        style={{ color: "var(--text)" }}
      >
        Your Top Matches in This Room
      </h2>
      <p
        className="text-xs sm:text-sm mb-4 max-w-2xl leading-relaxed"
        style={{ color: "var(--text-dim)" }}
      >
        Ranked automatically using 768-dimensional AI embeddings comparing your goals and deal preferences with everyone here.
      </p>

      {/* Explanatory Guide Drawer */}
      {showExplanation && (
        <div
          className="mb-6 p-4 rounded-xl border animate-in fade-in duration-200"
          style={{
            background: "var(--panel-solid)",
            borderColor: "var(--border-bright)"
          }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wider mb-2.5"
            style={{ color: "var(--amber-bright)" }}
          >
            ⚡ What is this &amp; How it works
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
            <div className="p-3 rounded-lg" style={{ background: "var(--panel-2)" }}>
              <div className="font-bold text-[var(--text)] mb-1">
                1. Vector Embeddings
              </div>
              <p style={{ color: "var(--text-dim)", lineHeight: 1.5 }}>
                Your twin extracts your background, goals, and deal criteria into a dense 768-dimensional semantic embedding.
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--panel-2)" }}>
              <div className="font-bold text-[var(--text)] mb-1">
                2. Reciprocal Alignment
              </div>
              <p style={{ color: "var(--text-dim)", lineHeight: 1.5 }}>
                The engine computes two-way cosine similarity: matching your goals to their offers, and their goals to your offers.
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--panel-2)" }}>
              <div className="font-bold text-[var(--text)] mb-1">
                3. Autonomous Negotiation
              </div>
              <p style={{ color: "var(--text-dim)", lineHeight: 1.5 }}>
                Clicking connect has your digital twin initiate conversation directly with their twin to propose immediate win-wins.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {matches.map((m, idx) => {
          const isHigh = m.score >= 75;
          const isMid = m.score >= 50;
          const badgeColor = isHigh
            ? "var(--green)"
            : isMid
            ? "var(--amber-bright)"
            : "var(--text-dim)";
          const barColor = isHigh ? "var(--green)" : "var(--amber-bright)";

          return (
            <div
              key={m.userId}
              className="retro-panel-hover flex flex-col justify-between p-4 sm:p-5"
              style={{
                background: "var(--panel-2)",
                border: idx === 0 ? "1px solid var(--amber-bright)" : "1px solid var(--border)",
                borderRadius: "var(--radius)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {idx === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    background: "var(--amber)",
                    color: "#ffffff",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "3px 10px",
                    borderBottomLeftRadius: 8
                  }}
                >
                  ★ #1 Top Match
                </div>
              )}

              <div>
                <div className="flex items-center gap-3">
                  <Avatar id={m.userId} name={m.displayName} avatarUrl={m.avatarUrl} size={46} />
                  <div className="min-w-0 flex-1">
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {m.displayName}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        marginTop: 2
                      }}
                    >
                      Room Attendee
                    </div>
                  </div>
                </div>

                {/* Score & Progress Bar */}
                <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--text-dim)"
                      }}
                    >
                      Synergy Score
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        fontFamily: "monospace",
                        color: badgeColor
                      }}
                    >
                      {m.score}% match
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      borderRadius: 999,
                      background: "var(--panel-solid)",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(8, m.score)}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: barColor,
                        transition: "width 0.4s ease"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Form */}
              <form action={startConversationWithUser} className="mt-4">
                <input type="hidden" name="userId" value={m.userId} />
                <button
                  type="submit"
                  className="retro-btn retro-btn-primary w-full text-xs font-bold py-2.5 justify-center flex items-center gap-1.5 cursor-pointer"
                >
                  <span>+ Connect with Twin</span>
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </section>
  );
}
