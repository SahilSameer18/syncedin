"use client";

import { useState } from "react";
import { ExpandProposalInline } from "./ExpandProposalInline";
import { InlineActions } from "./InlineActions";
import { MicButton } from "../MicButton";

/**
 * Client wrapper around a single proposal row's body.
 *
 * Per Jack: "This page just feels cluttered. We don't need the counter
 * button because that's the same as change proposal. The change
 * proposal icon can just be a wrapper around the existing text summary,
 * and that can be edited. Then click check mark."
 *
 * New interaction model:
 *   - Default: render summary as text with a faint ✎ pencil hint on hover.
 *   - Tap the text → it morphs into a textarea pre-filled with the full
 *     proposal text. Header shows ✓ Save / × Cancel.
 *   - Save calls the same /api/conversations/[id]/change-proposal we
 *     used to call from the now-deleted "change proposal" button.
 *   - On save: parent updates local state so the displayed summary +
 *     expand panel update inline (no router.refresh — the proposals
 *     page is a heavy server render, see InlineActions for why).
 *
 * Plus: integrated MicButton next to the textarea for voice dictation
 * (Web Speech API, free, instant). Same component is used on the
 * deny-with-reason textarea inside InlineActions.
 */
export function ProposalRowBody({
  conversationId,
  initialSummary,
  initialFullText,
  alreadyAccepted,
  alreadyRejected,
  sealed
}: {
  conversationId: string;
  initialSummary: string;
  initialFullText: string;
  alreadyAccepted: boolean;
  alreadyRejected: boolean;
  sealed: boolean;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [fullText, setFullText] = useState(initialFullText);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialFullText);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [savedTick, setSavedTick] = useState(0);

  function openEdit() {
    if (sealed || alreadyAccepted) return; // locked
    setDraft(fullText);
    setErr("");
    setEditing(true);
  }

  async function saveEdit() {
    const text = draft.trim();
    if (!text || text === fullText.trim() || busy) {
      // No change → just close the editor without round-tripping.
      setEditing(false);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/change-proposal`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text })
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as any);
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      setFullText(text);
      setSummary(text);
      setEditing(false);
      setSavedTick((t) => t + 1);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const locked = sealed || alreadyAccepted;

  return (
    <>
      {editing ? (
        // INLINE EDITOR — same vertical footprint as the read view so
        // the page doesn't jump when entering edit mode.
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(31, 139, 255, 0.35)",
            background: "rgba(31, 139, 255, 0.05)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 6
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#1f8bff",
                letterSpacing: "0.04em",
                textTransform: "uppercase"
              }}
            >
              Edit proposal
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {draft.length}/4000
            </span>
          </div>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "flex-start",
              gap: 6
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
              rows={Math.max(4, Math.min(12, Math.ceil(draft.length / 60)))}
              autoFocus
              className="retro-input"
              style={{
                flex: 1,
                fontSize: 14,
                lineHeight: 1.5,
                padding: 10,
                resize: "vertical",
                minHeight: 100
              }}
            />
            <MicButton
              onText={(chunk) =>
                setDraft((d) => `${d}${d && !d.endsWith(" ") ? " " : ""}${chunk}`)
              }
              ariaLabel="Dictate proposal edit"
              size={30}
            />
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8
            }}
          >
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(fullText);
                setErr("");
              }}
              className="retro-btn text-xs"
              style={{ padding: "6px 12px" }}
              aria-label="Cancel edit"
              title="Cancel"
            >
              × cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={
                busy ||
                !draft.trim() ||
                draft.trim() === fullText.trim()
              }
              className="retro-btn retro-btn-primary text-xs"
              style={{
                padding: "6px 14px",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
              aria-label="Save edited proposal"
              title="Save — clears both sides' previous accept/reject"
            >
              {busy ? "saving…" : "✓ save"}
            </button>
          </div>
          {err && (
            <div
              style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}
            >
              {err}
            </div>
          )}
        </div>
      ) : (
        // READ VIEW — the summary text IS the click target. Pencil
        // hint on hover so the affordance is discoverable without
        // crowding the row with buttons.
        <button
          type="button"
          onClick={openEdit}
          disabled={locked}
          className="proposal-summary-target"
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            marginTop: 8,
            padding: "8px 10px",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--text)",
            whiteSpace: "pre-wrap",
            cursor: locked ? "default" : "text",
            transition: "background 120ms ease, border-color 120ms ease",
            position: "relative"
          }}
          title={
            locked
              ? "This proposal is locked"
              : "Tap to edit the proposal"
          }
          aria-label={
            locked
              ? "Proposal text (locked)"
              : "Edit proposal — tap to change the deal terms"
          }
        >
          {summary}
          {!locked && (
            <span
              className="proposal-summary-hint"
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 8,
                right: 10,
                fontSize: 11,
                color: "var(--text-dim)",
                opacity: 0,
                transition: "opacity 120ms ease",
                pointerEvents: "none"
              }}
            >
              ✎ edit
            </span>
          )}
        </button>
      )}
      <style>{`
        .proposal-summary-target:not(:disabled):hover {
          background: rgba(31, 139, 255, 0.04);
          border-color: rgba(31, 139, 255, 0.20);
        }
        .proposal-summary-target:not(:disabled):hover .proposal-summary-hint {
          opacity: 1;
        }
        .proposal-summary-target:focus-visible {
          outline: 2px solid #1f8bff;
          outline-offset: 2px;
        }
      `}</style>
      <ExpandProposalInline
        key={`exp-${savedTick}`}
        fullText={fullText}
      />
      {!sealed && (
        <InlineActions
          conversationId={conversationId}
          alreadyAccepted={alreadyAccepted}
          alreadyRejected={alreadyRejected}
        />
      )}
      {savedTick > 0 && (
        <span
          key={`pill-${savedTick}`}
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#15803d",
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.30)",
            animation: "proposal-saved-fade 2.4s ease-out forwards"
          }}
        >
          ✓ proposal updated
        </span>
      )}
      <style>{`
        @keyframes proposal-saved-fade {
          0%   { opacity: 0; transform: translateY(2px); }
          12%  { opacity: 1; transform: translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
