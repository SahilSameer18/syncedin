"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

/**
 * PendingProposalsRail — desktop right-rail on /twin showing the user's
 * pending proposals with one-click Accept / Deny buttons.
 *
 * Pulls /api/twin/proposals on mount + every 30s. Accept/Deny POST
 * /api/respond-agreement and on success remove the card from the list
 * (optimistic) + re-fetch.
 *
 * The twin chat references these by counterpart name ("look at the
 * Tejas card to your right") so the twin can actually direct action
 * instead of saying "I can't, copy-paste yourself".
 */
type Proposal = {
  conversation_id: string;
  counterpart_id: string;
  counterpart_name: string;
  counterpart_avatar: string | null;
  counterpart_handle: string | null;
  summary: string;
  counterpart_summary: string;
  created_at: string;
};

export function PendingProposalsRail() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [denyOpen, setDenyOpen] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  // Collapsed by default per Jack: rail should be a small "▶ N pending"
  // header that expands on click. Avoids stacking 6 huge cards and
  // duplicating what the twin will surface inline once tool-use lands.
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/twin/proposals", {
        cache: "no-store"
      });
      const j = await res.json();
      setProposals(((j?.proposals as Proposal[]) ?? []).slice(0, 12));
    } catch {
      /* silent — empty list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const i = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(i);
  }, [load]);

  async function accept(p: Proposal) {
    if (acting) return;
    setActing(p.conversation_id);
    // Optimistic remove
    setProposals((prev) =>
      prev.filter((x) => x.conversation_id !== p.conversation_id)
    );
    try {
      await fetch("/api/respond-agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: p.conversation_id,
          response: "accepted"
        })
      });
    } finally {
      setActing(null);
      void load();
    }
  }

  async function deny(p: Proposal) {
    if (acting) return;
    setActing(p.conversation_id);
    setProposals((prev) =>
      prev.filter((x) => x.conversation_id !== p.conversation_id)
    );
    try {
      await fetch("/api/respond-agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: p.conversation_id,
          response: "rejected",
          reason: denyReason.trim() || null
        })
      });
    } finally {
      setActing(null);
      setDenyOpen(null);
      setDenyReason("");
      void load();
    }
  }

  return (
    <aside
      style={{
        position: "sticky",
        top: 12,
        maxHeight: "calc(100dvh - 100px)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      {/* Collapsible header. Click anywhere on the row to toggle.
          Shows "▶ 3 pending proposals" by default — expand to see
          full Accept/Deny cards. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: "var(--panel-solid)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
          width: "100%"
        }}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse proposals" : "Expand proposals"}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text)"
          }}
        >
          <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
            {expanded ? "▼" : "▶"}
          </span>
          {loading
            ? "Loading proposals…"
            : proposals.length === 0
            ? "Inbox clear"
            : `${proposals.length} pending proposal${
                proposals.length === 1 ? "" : "s"
              }`}
        </span>
        <Link
          href="/proposals"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 11,
            color: "var(--accent)",
            textDecoration: "none",
            fontWeight: 600
          }}
        >
          All →
        </Link>
      </button>

      {!expanded ? null : loading ? (
        <div
          style={{
            padding: 12,
            color: "var(--text-dim)",
            fontSize: 12
          }}
        >
          Loading…
        </div>
      ) : proposals.length === 0 ? (
        <div
          style={{
            background: "var(--panel)",
            border: "1px dashed var(--border)",
            borderRadius: 12,
            padding: 14,
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--text-dim)"
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 4
            }}
          >
            Inbox clear.
          </div>
          When your twin lands a deal in a conversation, Accept / Deny
          shows up here so you can move without leaving this page.
        </div>
      ) : (
        proposals.map((p) => (
          <div
            key={p.conversation_id}
            style={{
              background: "var(--panel-solid)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              {p.counterpart_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.counterpart_avatar}
                  alt={p.counterpart_name}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    objectFit: "cover",
                    flexShrink: 0
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--panel)",
                    flexShrink: 0
                  }}
                />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {p.counterpart_handle ? (
                    <Link
                      href={`/u/${p.counterpart_handle}`}
                      style={{
                        color: "inherit",
                        textDecoration: "none"
                      }}
                    >
                      {p.counterpart_name}
                    </Link>
                  ) : (
                    p.counterpart_name
                  )}
                </div>
              </div>
              <Link
                href={`/conversations/${p.conversation_id}`}
                title="Open conversation"
                style={{
                  fontSize: 11,
                  color: "var(--text-dim)",
                  textDecoration: "none",
                  flexShrink: 0
                }}
              >
                Open ↗
              </Link>
            </div>

            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.45,
                color: "var(--text)",
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }}
            >
              {p.summary || "(no summary)"}
            </div>

            {denyOpen === p.conversation_id ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <textarea
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  placeholder="Why deny? (optional — twin uses this for next round)"
                  rows={2}
                  style={{
                    fontSize: 12,
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    resize: "vertical",
                    fontFamily: "inherit"
                  }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDenyOpen(null);
                      setDenyReason("");
                    }}
                    style={btnGhost}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void deny(p)}
                    disabled={acting === p.conversation_id}
                    style={btnDangerSolid}
                  >
                    Confirm deny
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => void accept(p)}
                  disabled={acting === p.conversation_id}
                  style={btnAcceptSolid}
                >
                  ✓ Accept
                </button>
                <button
                  type="button"
                  onClick={() => setDenyOpen(p.conversation_id)}
                  disabled={acting === p.conversation_id}
                  style={btnGhost}
                >
                  Deny
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {/* Quick Actions — always-on shortcuts. Keeps the right rail
          full of value even when proposals are clear. */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          marginTop: 6
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
            marginBottom: 6,
            padding: "0 2px"
          }}
        >
          Quick actions
        </div>
        {[
          { href: "/dashboard", label: "Find someone to talk to", icon: "🔎" },
          { href: "/proposals", label: "All proposals", icon: "🤝" },
          { href: "/messages", label: "Open messages", icon: "💬" },
          {
            href: "/personal-intelligence",
            label: "Personal intelligence",
            icon: "✨"
          },
          { href: "/poll", label: "Ask the network", icon: "📊" },
          { href: "/invite", label: "Invite & earn", icon: "💌" }
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 8px",
              borderRadius: 8,
              textDecoration: "none",
              color: "var(--text)",
              fontSize: 13,
              fontWeight: 500
            }}
          >
            <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>
              {a.icon}
            </span>
            {a.label}
          </Link>
        ))}
      </div>

      {/* Steady context — always visible footer of the rail */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 14,
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--text-dim)",
          marginTop: 6
        }}
      >
        <div
          style={{
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: 4
          }}
        >
          How your twin learns
        </div>
        Your twin trains on every message you edit and every proposal
        you accept or deny. The more you steer it, the more it sounds
        like you — and the better the deals it lands.
      </div>
    </aside>
  );
}

const btnAcceptSolid: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer"
};
const btnDangerSolid: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: 10,
  border: "none",
  background: "#ef4444",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer"
};
const btnGhost: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-dim)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer"
};
