"use client";

import { useState } from "react";
import { ExpandProposalInline } from "./ExpandProposalInline";
import { InlineActions } from "./InlineActions";

/**
 * Client wrapper around a single proposal row's body. Holds the
 * proposal text in local state so that "Change proposal" updates
 * the displayed summary + expand panel + editor textarea INLINE,
 * without a server round-trip (which is what made the page feel
 * like it was reloading).
 *
 * Jack: "After I did change proposal it had to reload the whole
 * page." Root cause was router.refresh() inside InlineActions —
 * that re-runs every server query on /proposals (profiles, twins,
 * agreement_responses, messages-for-each-conv). For a user with
 * 20+ proposals this is a visible page flash.
 *
 * Fix: lift proposalText into this client wrapper. submitChange
 * in InlineActions calls onProposalChanged, we update local state,
 * the <p> + ExpandProposalInline + InlineActions textarea all
 * re-render from the new value. No router.refresh — the canonical
 * server data updates on next nav, which is plenty.
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
  /** Short summary (what was shown in the <p>). */
  initialSummary: string;
  /** Full agreement text (what ExpandProposalInline shows + what the
   *  editor pre-fills). Defaults to initialSummary if no marker. */
  initialFullText: string;
  alreadyAccepted: boolean;
  alreadyRejected: boolean;
  sealed: boolean;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [fullText, setFullText] = useState(initialFullText);
  // Subtle confirmation flag — shows "✓ Saved" for ~2s after a change.
  const [savedTick, setSavedTick] = useState(0);

  return (
    <>
      <p
        style={{
          marginTop: 8,
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--text)",
          whiteSpace: "pre-wrap"
        }}
      >
        {summary}
      </p>
      <ExpandProposalInline
        // Re-mount when the text changes so the open/closed state
        // resets cleanly — otherwise a stale-open panel would still
        // show the old text until toggled.
        key={`exp-${savedTick}`}
        fullText={fullText}
      />
      {!sealed && (
        <InlineActions
          conversationId={conversationId}
          alreadyAccepted={alreadyAccepted}
          alreadyRejected={alreadyRejected}
          currentProposal={fullText}
          onProposalChanged={(newText) => {
            // Replace what we render locally — no router.refresh.
            setFullText(newText);
            setSummary(newText);
            setSavedTick((t) => t + 1);
          }}
        />
      )}
      {savedTick > 0 && (
        // Tiny inline confirmation. Auto-fades via CSS animation
        // (re-mounted each time savedTick increments via key).
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
