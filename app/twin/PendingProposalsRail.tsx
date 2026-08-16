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
    <aside className="space-y-4 max-h-[calc(100vh-100px)] overflow-y-auto pr-1">
      {/* Collapsible header */}
      <div className="glass-card-elevated p-3 border border-purple-100/80 bg-white/95">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between text-left select-none"
          aria-expanded={expanded}
        >
          <span className="inline-flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
            <span className="text-[10px] text-purple-600">
              {expanded ? "▼" : "▶"}
            </span>
            {loading
              ? "Loading proposals…"
              : proposals.length === 0
              ? "Inbox clear"
              : `${proposals.length} Pending Proposal${
                  proposals.length === 1 ? "" : "s"
                }`}
          </span>
          <Link
            href="/proposals"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] font-extrabold text-purple-600 hover:text-purple-800"
          >
            All →
          </Link>
        </button>
      </div>

      {!expanded ? null : loading ? (
        <div className="glass-card-elevated p-4 text-xs font-medium text-slate-400 bg-white/90">
          Loading proposals…
        </div>
      ) : proposals.length === 0 ? (
        <div className="glass-card-elevated p-4 border border-dashed border-purple-200 bg-white/80 space-y-1">
          <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Inbox Clear
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            When your Twin discovers high synergy in an autonomous conversation, the intro appears here for one-click approval.
          </p>
        </div>
      ) : (
        proposals.map((p) => (
          <div
            key={p.conversation_id}
            className="glass-card-elevated p-4 border border-purple-100/90 bg-white space-y-3 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              {p.counterpart_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.counterpart_avatar}
                  alt={p.counterpart_name}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="w-8 h-8 rounded-full object-cover border border-purple-200 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-black text-xs flex items-center justify-center shrink-0">
                  {p.counterpart_name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-900 truncate">
                  {p.counterpart_handle ? (
                    <Link
                      href={`/u/${p.counterpart_handle}`}
                      className="hover:text-purple-600 transition-colors"
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
                className="text-[11px] font-bold text-slate-400 hover:text-purple-600 shrink-0"
              >
                Open ↗
              </Link>
            </div>

            <div className="text-xs text-slate-600 font-medium leading-relaxed line-clamp-3 bg-purple-50/40 p-2.5 rounded-xl border border-purple-50">
              {p.summary || "(no summary)"}
            </div>

            {denyOpen === p.conversation_id ? (
              <div className="space-y-2">
                <textarea
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  placeholder="Why deny? (optional — twin learns from this)"
                  rows={2}
                  className="w-full p-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-purple-600"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDenyOpen(null);
                      setDenyReason("");
                    }}
                    className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void deny(p)}
                    disabled={acting === p.conversation_id}
                    className="px-3 py-1 text-xs font-bold rounded-full bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                  >
                    Confirm deny
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void accept(p)}
                  disabled={acting === p.conversation_id}
                  className="flex-1 btn-purple-pill py-1.5 px-3 text-xs font-black shadow-sm"
                >
                  ✓ Accept Intro
                </button>
                <button
                  type="button"
                  onClick={() => setDenyOpen(p.conversation_id)}
                  disabled={acting === p.conversation_id}
                  className="px-3 py-1.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Pass
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {/* Quick Actions Card */}
      <div className="glass-card-elevated p-4 border border-purple-100/90 bg-white/95 space-y-2.5">
        <div className="text-[10px] font-black uppercase tracking-wider text-purple-900">
          ⚡ Quick Dojo Prompts
        </div>
        <div className="space-y-1">
          {[
            {
              icon: "🎯",
              label: "Find my best match",
              prompt:
                "Who on the platform is my highest-leverage match right now, and why? Search and show me the top few."
            },
            {
              icon: "🤝",
              label: "Triage my proposals",
              prompt:
                "Triage my pending proposals: which should I accept, counter, or deny, and why? Stage the actions."
            },
            {
              icon: "✍️",
              label: "Sharpen my twin's voice",
              prompt:
                "Critique how my twin currently sounds and suggest 3 concrete edits to make it more like me."
            },
            {
              icon: "👋",
              label: "Who to reach out to today",
              prompt: "Who are the 3 people I should reach out to today, and what should I say?"
            },
            {
              icon: "💌",
              label: "Invite a peer",
              prompt:
                "I want to invite someone to SyncedIn. Ask me for their name and a profile link, email, or handle, then create the invite."
            }
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("twin-quick-prompt", {
                      detail: { text: item.prompt }
                    })
                  );
                }
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-900 transition-all"
            >
              <span className="text-sm shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* How Twin Learns Trust Card */}
      <div className="glass-card-elevated p-4 border border-purple-100/80 bg-white/90 space-y-1.5 text-left">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase text-purple-900 tracking-wider">
            🧠 Continuous Training
          </span>
        </div>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Your Twin learns from every proposal you accept or deny, and every message you edit in this chat.
        </p>
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
