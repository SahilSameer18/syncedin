"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "../Avatar";
import { ClientDate } from "../ClientDate";
import { ExcitementControl } from "./ExcitementControl";
import { SocialIconRow, type SocialUrls } from "../SocialIconRow";

/**
 * Dashboard conversations list — client component so we can filter
 * and re-sort without a server round-trip. Jack: "lets have it say
 * SYNC SCORE [filter ▼]" + the (i) tooltip moves up into the header
 * (was duplicated per-row before).
 *
 * Filters:
 *   - excitement  (legacy default — the "X excited about this convo")
 *   - sync        (sync score: high → low)
 *   - active      (most recently active — last message time)
 *   - newest      (most recent conversation creation)
 *
 * The SocialIconRow under each name lights up the LinkedIn / X / IG /
 * Facebook buttons we have on file for the counterpart, so the user
 * can verify them before opening the convo. Profile rows without any
 * social URLs simply render no icons (the component returns null).
 */
export type ConversationRow = {
  id: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  other_socials: SocialUrls | null;
  /** ISO timestamp of when the counterpart was last seen on SyncedIn
   *  (stamped by middleware on every authed page load). Null if the
   *  user hasn't been active since the column was added — we just hide
   *  the badge in that case. */
  other_last_active_at: string | null;
  status: { kind: string; label: string; color: string } | null;
  counterpart_summary: string | null;
  summary: string | null;
  created_at: string;
  excitement_score: number | null;
  excitement_locked: boolean | null;
  sync_score: number;
  last_message_at: string | null;
};

/**
 * Format a last-active timestamp into a compact "active Xh ago" pill.
 * - <2 min: "active now" (green)
 * - <1 hr:  "active 23m ago" (green)
 * - <24 hr: "active 4h ago" (amber)
 * - <7 days: "active 3d ago" (dim)
 * - <30 days: "active 2w ago" (dim)
 * - older: "active 4mo ago" (dim)
 */
function formatLastActive(iso: string | null): {
  label: string;
  color: string;
} | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 2 * 60_000) {
    return { label: "active now", color: "var(--green)" };
  }
  if (diff < 60 * 60_000) {
    const mins = Math.max(1, Math.round(diff / 60_000));
    return { label: `active ${mins}m ago`, color: "var(--green)" };
  }
  if (diff < 24 * 60 * 60_000) {
    const hrs = Math.max(1, Math.round(diff / (60 * 60_000)));
    return { label: `active ${hrs}h ago`, color: "var(--amber-bright)" };
  }
  if (diff < 7 * 24 * 60 * 60_000) {
    const days = Math.max(1, Math.round(diff / (24 * 60 * 60_000)));
    return { label: `active ${days}d ago`, color: "var(--text-dim)" };
  }
  if (diff < 30 * 24 * 60 * 60_000) {
    const weeks = Math.max(1, Math.round(diff / (7 * 24 * 60 * 60_000)));
    return { label: `active ${weeks}w ago`, color: "var(--text-dim)" };
  }
  const months = Math.max(1, Math.round(diff / (30 * 24 * 60 * 60_000)));
  return { label: `active ${months}mo ago`, color: "var(--text-dim)" };
}

type SortKey = "excitement" | "sync" | "active" | "newest";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "excitement", label: "Excitement" },
  { key: "sync", label: "Sync score" },
  { key: "active", label: "Most recent active" },
  { key: "newest", label: "Most recent convo" }
];

export function ConversationsList({ rows }: { rows: ConversationRow[] }) {
  const [sort, setSort] = useState<SortKey>("excitement");
  const [openFilter, setOpenFilter] = useState(false);
  // Sync-score prompt overlay: loaded lazily when the user opens the
  // edit modal. Avoids a fetch on first paint of the dashboard.
  const [promptModal, setPromptModal] = useState(false);
  const [promptValue, setPromptValue] = useState<string>("");
  const [promptDefault, setPromptDefault] = useState<string>("");
  const [promptIsCustom, setPromptIsCustom] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptErr, setPromptErr] = useState<string | null>(null);

  async function openPromptModal() {
    setPromptModal(true);
    setPromptErr(null);
    if (promptDefault) return; // already loaded
    setPromptLoading(true);
    try {
      const r = await fetch("/api/sync-score-prompt");
      const j = await r.json();
      if (!r.ok) {
        setPromptErr(j.detail || j.error || `HTTP ${r.status}`);
      } else {
        setPromptDefault(j.default_prompt ?? "");
        setPromptValue(j.prompt ?? j.default_prompt ?? "");
        setPromptIsCustom(!!j.is_custom);
      }
    } catch (e: any) {
      setPromptErr(e?.message || "Couldn't load prompt.");
    } finally {
      setPromptLoading(false);
    }
  }
  async function savePrompt(value: string) {
    setPromptSaving(true);
    setPromptErr(null);
    try {
      const r = await fetch("/api/sync-score-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: value })
      });
      const j = await r.json();
      if (!r.ok) {
        setPromptErr(j.detail || j.error || `HTTP ${r.status}`);
        return;
      }
      setPromptIsCustom(value.trim().length > 0);
      setPromptModal(false);
    } catch (e: any) {
      setPromptErr(e?.message || "Couldn't save.");
    } finally {
      setPromptSaving(false);
    }
  }

  const sorted = useMemo(() => {
    const list = [...rows];
    switch (sort) {
      case "sync":
        return list.sort((a, b) => b.sync_score - a.sync_score);
      case "active":
        return list.sort((a, b) => {
          const at = a.last_message_at || a.created_at;
          const bt = b.last_message_at || b.created_at;
          return new Date(bt).getTime() - new Date(at).getTime();
        });
      case "newest":
        return list.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
      case "excitement":
      default:
        return list.sort(
          (a, b) =>
            (b.excitement_score ?? -1) - (a.excitement_score ?? -1)
        );
    }
  }, [rows, sort]);

  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Excitement";

  return (
    <section>
      <div
        className="retro-label"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap"
        }}
      >
        <span>
          your conversations · sorted by{" "}
          <span style={{ color: "var(--amber-bright)" }}>
            {sortLabel.toLowerCase()}
          </span>
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            letterSpacing: 0,
            textTransform: "none",
            // Allow the right-side header chunk to shrink on narrow
            // viewports instead of forcing horizontal scroll.
            minWidth: 0,
            maxWidth: "100%"
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-dim)"
            }}
          >
            SYNC SCORE
          </span>
          {/* (i) explainer — opens a modal that surfaces the underlying
              scoring prompt + lets the user edit it. Jack: "surface
              the underlying prompt we're using to calculate the sync
              score, and let a user edit that if they want." */}
          <button
            type="button"
            onClick={openPromptModal}
            aria-label="How is Sync score calculated?"
            title="View / edit how your sync score is calculated"
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "1px solid var(--border-bright)",
              color: "var(--text-dim)",
              fontSize: 10,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: "var(--panel)",
              fontFamily: "system-ui, sans-serif",
              padding: 0
            }}
          >
            i
          </button>
          {/* Filter dropdown */}
          <button
            type="button"
            onClick={() => setOpenFilter((v) => !v)}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              border: "1px solid var(--border-bright)",
              background: openFilter ? "var(--panel-2)" : "transparent",
              color: "var(--text)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <span>filter</span>
            <span aria-hidden="true">▾</span>
          </button>
          {openFilter && (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                marginTop: 30,
                minWidth: 200,
                background: "var(--panel-solid)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                boxShadow: "0 16px 36px -12px rgba(0,0,0,0.45)",
                zIndex: 20,
                overflow: "hidden"
              }}
            >
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setSort(s.key);
                    setOpenFilter(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background:
                      sort === s.key ? "var(--panel-2)" : "transparent",
                    border: 0,
                    color: sort === s.key ? "var(--text)" : "var(--text-dim)",
                    fontWeight: sort === s.key ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer"
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {sorted.map((c) => (
          <div key={c.id} className="retro-panel retro-panel-hover p-3">
            <div className="flex items-start gap-3">
              <Link
                href={`/conversations/${c.id}`}
                className="shrink-0"
              >
                <Avatar
                  id={c.other_id}
                  name={c.other_name}
                  avatarUrl={c.other_avatar}
                  size={40}
                />
              </Link>
              <Link
                href={`/conversations/${c.id}`}
                className="min-w-0 flex-1"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                  <span>{c.other_name}</span>
                  {c.status && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: c.status.color,
                        border: `1px solid ${c.status.color}`,
                        background: "transparent",
                        letterSpacing: "0.04em"
                      }}
                    >
                      {c.status.label}
                    </span>
                  )}
                  {(() => {
                    const la = formatLastActive(c.other_last_active_at);
                    if (!la) return null;
                    return (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        title={`Last seen ${new Date(
                          c.other_last_active_at!
                        ).toLocaleString()}`}
                        style={{
                          color: la.color,
                          border: `1px solid ${la.color}`,
                          background: "transparent",
                          letterSpacing: "0.04em"
                        }}
                      >
                        {la.label}
                      </span>
                    );
                  })()}
                  <SocialIconRow urls={c.other_socials} size={14} />
                </div>
                {c.counterpart_summary && (
                  <div className="retro-dim text-xs mt-1">
                    {c.counterpart_summary}
                  </div>
                )}
                {c.summary && (
                  <div className="text-xs mt-1.5">
                    <span className="retro-dim">outcome: </span>
                    {c.summary}
                  </div>
                )}
                <div className="retro-dim text-[11px] mt-1">
                  <ClientDate value={c.created_at} />
                </div>
              </Link>
              {/* Compact single-row score cluster. Jack: "FIX THE UI/UX
                  HERE" — the previous stacked SYNC + DEAL labels ate
                  ~80px vertical per card and read as duplicate noise
                  next to the "SYNC SCORE" column header. New design:
                  ONE row with `77%` (sync, color-coded) and `◆91`
                  (deal/excitement, blue) separated by a thin divider,
                  no caps labels. The column header above the list now
                  explains both. Hover tooltips on each kept for the
                  curious. */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0
                }}
              >
                <span
                  title="Sync — pair-wise complementarity between your twins."
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color:
                      c.sync_score >= 70
                        ? "var(--green)"
                        : c.sync_score >= 40
                        ? "var(--amber-bright)"
                        : "var(--text-dim)",
                    fontFamily:
                      '"IBM Plex Mono", ui-monospace, monospace',
                    lineHeight: 1
                  }}
                >
                  {c.sync_score}%
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 1,
                    height: 14,
                    background: "var(--border)"
                  }}
                />
                <ExcitementControl
                  conversationId={c.id}
                  score={c.excitement_score}
                  locked={!!c.excitement_locked}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SYNC-SCORE PROMPT MODAL — opened by the (i) badge in the
          header. Shows the default natural-language description of
          the scoring algorithm; user can override with their own
          prompt that future scoring will incorporate. */}
      {promptModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPromptModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(8, 11, 24, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 640,
              width: "100%",
              maxHeight: "min(80vh, 720px)",
              overflow: "auto",
              background: "var(--panel-solid)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 22,
              boxShadow: "0 24px 64px -16px rgba(0,0,0,0.6)"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 8
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "-0.005em"
                }}
              >
                How your sync score is calculated
              </h3>
              <button
                type="button"
                onClick={() => setPromptModal(false)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: 14
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                color: "var(--text-dim)",
                lineHeight: 1.55
              }}
            >
              This is the prompt the platform uses to compute your sync
              score against everyone else. Edit it to reflect what YOU
              think makes a high-leverage match — your override gets
              applied when your scores are recomputed.
            </p>
            {promptLoading ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--text-dim)",
                  fontSize: 13
                }}
              >
                loading…
              </div>
            ) : (
              <>
                <textarea
                  value={promptValue}
                  onChange={(e) =>
                    setPromptValue(e.target.value.slice(0, 8000))
                  }
                  rows={14}
                  className="retro-input"
                  style={{
                    width: "100%",
                    fontSize: 13,
                    lineHeight: 1.55,
                    fontFamily:
                      '"IBM Plex Mono", ui-monospace, monospace'
                  }}
                />
                {promptErr && (
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "#ef4444",
                      whiteSpace: "pre-wrap"
                    }}
                  >
                    {promptErr}
                  </p>
                )}
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => savePrompt(promptValue)}
                    disabled={promptSaving}
                    className="retro-btn retro-btn-primary"
                    style={{ padding: "8px 16px", fontSize: 13 }}
                  >
                    {promptSaving ? "saving…" : "save my prompt"}
                  </button>
                  {promptIsCustom && (
                    <button
                      type="button"
                      onClick={() => {
                        setPromptValue(promptDefault);
                        savePrompt("");
                      }}
                      disabled={promptSaving}
                      className="retro-btn"
                      style={{ padding: "8px 14px", fontSize: 12 }}
                    >
                      ↺ reset to default
                    </button>
                  )}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      color: "var(--text-dim)"
                    }}
                  >
                    {promptIsCustom ? "✓ using your override" : "using default"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
