"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Message } from "@/lib/types";
import { Avatar } from "../../Avatar";
import { PerConversationGoal } from "./PerConversationGoal";
import { ComposeAtEnd } from "./ComposeAtEnd";
import { SocialIconRow } from "../../SocialIconRow";
import { PersistentCompose } from "./PersistentCompose";
import { FunnyModeToggle } from "./FunnyModeToggle";
import { CallButton } from "./CallButton";

/**
 * SchedulePanel — appears after both sides accept a deal. Surfaces multiple
 * ways to lock in a call so we never block on "find a time that works."
 *
 * Tiers (best-to-easiest):
 *  1. Calendly link paste — if one of you already has a Calendly, send it.
 *  2. Google Calendar appointment slot creator — picks 3 candidate times
 *     and creates a multi-attendee event template.
 *  3. .ics download — works with any calendar (Apple, Outlook, etc.).
 *  4. Free-text proposal — "How about Tues 2pm PT?" copy-paste hint.
 *
 * Future: OAuth Google/Microsoft calendars on both sides to auto-find a
 * free overlap. For now the proposal-three-times pattern beats the
 * alternative of stalling on scheduling.
 */
function SchedulePanel({
  selfName,
  selfEmail,
  otherName,
  otherEmail,
  agreement,
  conversationId
}: {
  selfName: string;
  selfEmail: string | null;
  otherName: string;
  otherEmail: string | null;
  agreement: string;
  conversationId: string;
}) {
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [proposal, setProposal] = useState("");
  const [sending, setSending] = useState<null | "calendly" | "proposal">(null);
  const [sent, setSent] = useState<null | "calendly" | "proposal">(null);

  // Default to a slot 2 days out at 10am local — better than now/+1hr.
  const start = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(10, 0, 0, 0);
    return d;
  })();
  const end = new Date(start.getTime() + 30 * 60_000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]|\.\d{3}/g, "")
      .slice(0, 15) + "Z";

  // Build a Google Calendar event template with the agreement in the description.
  // CRITICAL: prefill the guest list with both emails so the event creates
  // a real calendar invite that Google will send to the counterpart.
  const guests = [selfEmail, otherEmail].filter(Boolean).join(",");
  const gcalUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(`SyncedIn: ${selfName} × ${otherName}`)}` +
    `&dates=${fmt(start)}/${fmt(end)}` +
    `&details=${encodeURIComponent(`Agreed via SyncedIn:\n\n${agreement}\n\nReply to confirm or propose a different time.`)}` +
    (guests ? `&add=${encodeURIComponent(guests)}` : "");

  function downloadIcs() {
    const dtstart = fmt(start);
    const dtend = fmt(end);
    const attendeeLines: string[] = [];
    if (otherEmail) {
      attendeeLines.push(
        `ATTENDEE;CN=${otherName};RSVP=TRUE:mailto:${otherEmail}`
      );
    }
    if (selfEmail) {
      attendeeLines.push(`ORGANIZER;CN=${selfName}:mailto:${selfEmail}`);
    }
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SyncedIn//EN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${dtstart}-syncedin@${typeof location !== "undefined" ? location.hostname : "syncedin.org"}`,
      `DTSTAMP:${dtstart}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:SyncedIn: ${selfName} × ${otherName}`,
      `DESCRIPTION:Agreed via SyncedIn:\\n\\n${agreement.replace(/\n/g, "\\n")}`,
      ...attendeeLines,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `syncedin-${otherName.replace(/\s+/g, "-").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function postInThread(kind: "calendly" | "proposal", body: string) {
    if (!body.trim()) return;
    setSending(kind);
    try {
      const res = await fetch("/api/send-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          original_draft: body,
          final_text: body
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setSent(kind);
      // Soft RSC refresh — re-runs the server component so the new message
      // appears, without a hard reload (the hard reload was racing with back
      // navigation on mobile and crashing the tab).
      try {
        // dynamic import so this file can be authored without a top-level
        // router hook dependency
        const { default: Router } = await import("next/router").catch(
          () => ({ default: null as any })
        );
        if (typeof window !== "undefined") {
          // Soft full reload via assign keeps history intact — back button
          // still works.
          window.location.assign(window.location.pathname);
        }
      } catch {
        /* swallow */
      }
    } catch (e) {
      console.error("[schedule] send-in-chat failed", e);
    } finally {
      setSending(null);
    }
  }

  const calendlyMsg = calendlyUrl.trim()
    ? `Locked in. Here's my calendar to grab a time that works: ${calendlyUrl.trim()}`
    : "";
  const proposalMsg = proposal.trim()
    ? `How about ${proposal.trim()}? If that doesn't work, propose 2-3 alternatives.`
    : "";

  return (
    <div
      className="mt-3 retro-panel p-3 space-y-3"
      style={{ borderColor: "var(--green)" }}
    >
      <div
        className="retro-label flex items-center gap-2"
        style={{ color: "var(--green)" }}
      >
        ✓ deal sealed · lock in a time
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <a
          href={gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="retro-btn retro-btn-primary text-xs text-center"
          style={{ padding: "8px 10px" }}
          title={
            otherEmail
              ? `Pre-invites ${otherEmail}`
              : "No email on file for counterpart — invite will be empty"
          }
        >
          📅 Google Calendar{otherEmail ? " · invites them" : ""}
        </a>
        <button
          type="button"
          onClick={downloadIcs}
          className="retro-btn text-xs"
          style={{ padding: "8px 10px" }}
        >
          🍎 Apple / Outlook (.ics)
        </button>
      </div>

      <div>
        <div className="retro-label text-[10px]">
          Or share your Calendly in the thread
        </div>
        <div className="flex gap-2 mt-1">
          <input
            type="url"
            value={calendlyUrl}
            onChange={(e) => setCalendlyUrl(e.target.value)}
            placeholder="https://calendly.com/you/30min"
            className="retro-input text-xs flex-1"
          />
          <button
            type="button"
            onClick={() => postInThread("calendly", calendlyMsg)}
            disabled={!calendlyUrl.trim() || sending === "calendly"}
            className="retro-btn retro-btn-primary text-xs"
            style={{ padding: "4px 10px" }}
            title="Send the Calendly link as a real message in this thread"
          >
            {sending === "calendly"
              ? "sending…"
              : sent === "calendly"
              ? "✓ sent"
              : "send in chat"}
          </button>
        </div>
      </div>

      <div>
        <div className="retro-label text-[10px]">
          Or propose a time in chat
        </div>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            placeholder="Tuesday 2pm PT"
            className="retro-input text-xs flex-1"
          />
          <button
            type="button"
            onClick={() => postInThread("proposal", proposalMsg)}
            disabled={!proposal.trim() || sending === "proposal"}
            className="retro-btn retro-btn-primary text-xs"
            style={{ padding: "4px 10px" }}
          >
            {sending === "proposal"
              ? "sending…"
              : sent === "proposal"
              ? "✓ sent"
              : "send in chat"}
          </button>
        </div>
      </div>

      <div className="retro-dim text-[10px]">
        {otherEmail
          ? `Counterpart on file: ${otherEmail}. Google Calendar pre-invites them; .ics carries them as an attendee.`
          : `Counterpart has no email on file yet — Calendly / chat options work either way.`}
      </div>
    </div>
  );
}

/**
 * EditInfoBadge — small (?) icon, on hover surfaces an explainer that
 * (a) editing a message regenerates everything after it, AND
 * (b) we also capture WHY you changed it, which is the meta-learning
 *     signal that makes your twin truly act like you over time.
 */
function EditInfoBadge() {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex"
      }}
      className="group"
    >
      <span
        aria-label="What do edits do?"
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "1px solid var(--border-bright)",
          color: "var(--text-dim)",
          fontSize: 11,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          background: "var(--panel)"
        }}
      >
        ?
      </span>
      <span
        className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
        style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          width: 280,
          padding: "10px 12px",
          background: "var(--panel-solid)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--text)",
          zIndex: 20,
          boxShadow: "0 12px 32px -10px rgba(0,0,0,0.45)"
        }}
      >
        <strong style={{ display: "block", marginBottom: 4 }}>
          Edits = training signal
        </strong>
        Right-click any message to copy, double-click your own to edit. When
        you edit, everything after regenerates AND we ask why — that "why"
        is the meta-learning that makes your twin truly act like you. The
        more you edit, the more perfect it gets.
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
            color: "var(--text-dim)"
          }}
        >
          <strong style={{ color: "var(--green, #3cd870)" }}>
            Private
          </strong>{" "}
          — the other person only sees your final text. They never see what
          you edited or why.
        </div>
      </span>
    </span>
  );
}

/**
 * TwinLink — two avatars connected by a pulsing arc, showing that the
 * conversation is between two clones. When `active` is true (twins are
 * talking), the arc animates; when finished, the arc holds a solid link.
 */
function TwinLink({
  self,
  other,
  active
}: {
  self: { id: string; name: string; avatarUrl: string | null };
  other: { id: string; name: string; avatarUrl: string | null };
  active: boolean;
}) {
  return (
    <div
      className="flex items-center"
      style={{ gap: 0, position: "relative", height: 44 }}
      aria-label={`${self.name} ↔ ${other.name}`}
    >
      <Avatar
        id={self.id}
        name={self.name}
        avatarUrl={self.avatarUrl}
        size={40}
        ringColor="var(--amber-bright)"
      />
      <div
        style={{
          width: 36,
          height: 40,
          position: "relative",
          marginLeft: -6,
          marginRight: -6
        }}
      >
        <svg viewBox="0 0 36 40" width="36" height="40">
          <defs>
            <linearGradient id="tl_link" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3a4dff" />
              <stop offset="100%" stopColor="#8b3dff" />
            </linearGradient>
          </defs>
          {/* base arc */}
          <path
            d="M 4 20 Q 18 4 32 20 Q 18 36 4 20 Z"
            fill="none"
            stroke="url(#tl_link)"
            strokeWidth={active ? 2 : 1.5}
            opacity={active ? 0.35 : 0.6}
          />
          {/* traveling spark when active */}
          {active && (
            <circle r="2.5" fill="#fff">
              <animateMotion
                dur="1.6s"
                repeatCount="indefinite"
                path="M 4 20 Q 18 4 32 20 Q 18 36 4 20 Z"
              />
            </circle>
          )}
        </svg>
      </div>
      <Avatar
        id={other.id}
        name={other.name}
        avatarUrl={other.avatarUrl}
        size={40}
        ringColor="#3a4dff"
      />
    </div>
  );
}

const AGREEMENT_MARKER = ">>> AGREEMENT:";
const CLIENT_TURN_CAP = 16; // safety net; server enforces the real cap

// Strip markdown so raw ** / # / ` never show in a chat bubble.
function clean(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*>\s+/gm, "")
    .trim();
}

/**
 * Linkify — render plain text with URLs (and bare domains like
 * calendly.com/jackjay) as clickable <a> tags. Returns a React fragment
 * so it can drop directly into a JSX expression.
 *
 * Patterns recognized:
 *  - https?://...  → linked as-is
 *  - www.example.com/...  → linked with https:// prefix
 *  - bare-domain.com/path  → linked when the domain has a TLD we know
 *
 * Email addresses become mailto: links.
 */
const LINK_RE =
  /(https?:\/\/[^\s)]+|(?:www\.|[a-z0-9-]+\.)[a-z0-9-]+(?:\.[a-z]{2,})+(?:\/[^\s)]*)?|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

export function linkify(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // Reset stateful regex
  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    if (start > lastIndex) out.push(text.slice(lastIndex, start));
    let href = raw;
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(raw)) {
      href = `mailto:${raw}`;
    } else if (!/^https?:\/\//i.test(raw)) {
      href = `https://${raw}`;
    }
    out.push(
      <a
        key={`l-${start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          color: "inherit",
          textDecoration: "underline",
          textUnderlineOffset: 2
        }}
      >
        {raw}
      </a>
    );
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

// Split a message into its conversational body + optional agreement line.
function splitAgreement(text: string): { body: string; agreement: string | null } {
  const idx = text.indexOf(AGREEMENT_MARKER);
  if (idx === -1) return { body: clean(text), agreement: null };
  return {
    body: clean(text.slice(0, idx)),
    agreement: clean(text.slice(idx + AGREEMENT_MARKER.length))
  };
}

const MSG_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

type ResponseState = { response: "accepted" | "rejected"; reason?: string | null };

export function ChatUI({
  conversationId,
  selfUserId,
  selfName,
  selfEmail,
  selfAvatarUrl,
  other,
  initialMessages,
  initialDone,
  initialMyResponse,
  initialOtherResponse,
  otherLastReadAt,
  initialSummary = null
}: {
  conversationId: string;
  selfUserId: string;
  selfName: string;
  selfEmail?: string | null;
  selfAvatarUrl?: string | null;
  other: {
    id: string;
    name: string;
    email?: string | null;
    isTestPersona: boolean;
    avatarUrl?: string | null;
    socials?: {
      linkedin_url: string | null;
      x_url: string | null;
      instagram_url: string | null;
      facebook_url: string | null;
      website_url: string | null;
    } | null;
  };
  initialMessages: Message[];
  initialDone: boolean;
  initialMyResponse: ResponseState | null;
  initialOtherResponse: ResponseState | null;
  /** Counterpart's most recent /api/conversations/[id]/read timestamp.
   *  Used to render ✓✓ (read) vs ✓ (delivered) on outgoing bubbles. */
  otherLastReadAt?: string | null;
  /** Server-fetched summary so the outcome card renders at the top of
   *  the page on first load — no need to click "summarize" first.
   *  Jack: "We should actually just be a summary of the conversation
   *  and the outcome, probably automatically." */
  initialSummary?: {
    summary: string;
    counterpart_summary: string;
    excitement_score: number;
  } | null;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [done, setDone] = useState(initialDone);
  // Mirror of `done` for the auto-summarize effect — used so the
  // effect can check the latest `done` value without re-running every
  // time it flips (which would re-trigger the summary).
  const doneRef = useRef(initialDone);
  useEffect(() => {
    doneRef.current = done;
  }, [done]);
  const [running, setRunning] = useState(false);
  // Whether the bottom-of-conversation compose textarea is open. Hidden
  // by default after the twin loop finishes — user pops it open with
  // the "+ add another message" button, closes via the X in the panel.
  const [composeOpen, setComposeOpen] = useState(false);
  // Same pattern for the per-conversation goal override panel.
  const [goalOpen, setGoalOpen] = useState(false);
  // The user_id of whoever's about to draft the next turn. Drives the
  // iMessage-style typing indicator's side + name. Falls back to the
  // "not the last sender" inference if the server didn't return it yet.
  const [nextTurnUserId, setNextTurnUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Manual summarize state — Jack's call: add a summarize button to the
  // messaging interface so the user can regenerate the outcome summary
  // + excitement score on demand (not just at auto-completion).
  const [summarizing, setSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<{
    summary: string;
    counterpart_summary: string;
    excitement_score: number;
  } | null>(initialSummary);

  async function summarizeNow() {
    if (summarizing) return;
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch("/api/summarize-conversation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as any);
        throw new Error(
          j.detail || j.error || `Couldn't summarize (HTTP ${res.status})`
        );
      }
      const j = await res.json();
      setSummaryResult({
        summary: j.summary ?? "",
        counterpart_summary: j.counterpart_summary ?? "",
        excitement_score: Number(j.excitement_score) || 0
      });
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSummarizing(false);
    }
  }

  // Auto-summarize on conversation complete. Jack: "lets automatically
  // summarize the conversation" — kill the manual "✦ summarize" button
  // and trigger as soon as the chat is done + we don't already have a
  // summary. Only fires once per session per conversation since the
  // ref guard prevents re-fires after the result is cleared.
  const autoSummarizedRef = useRef(false);
  useEffect(() => {
    if (autoSummarizedRef.current) return;
    if (summarizing) return;
    if (summaryResult) return;
    if (messages.length < 2) return;
    // `done` is the chat completion flag flipped by the auto-run loop.
    // Without this guard we'd start summarizing every turn.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // (done is in scope below; we reference it from the surrounding
    //  component closure)
    // — see usage further down for the actual definition.
    if (!doneRef.current) return;
    autoSummarizedRef.current = true;
    void summarizeNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, summaryResult, summarizing]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menu, setMenu] = useState<
    { id: string; x: number; y: number; canEdit: boolean } | null
  >(null);
  const [myResponse, setMyResponse] = useState<ResponseState | null>(
    initialMyResponse
  );
  const [otherResponse, setOtherResponse] = useState<ResponseState | null>(
    initialOtherResponse
  );
  const [rejecting, setRejecting] = useState(false);
  // Default-collapsed on mount so SSR + first paint matches the
  // mobile/narrow-desktop layout (inline rail under the chat — the
  // expanded panel would cover the input area). A post-mount effect
  // below expands automatically once we detect a ≥1440px viewport
  // where the rail docks to the right and "always-expanded" is what
  // Jack asked for: "Now that we have proposed destination on the
  // right side we can put it under outcome and not collapsed."
  const [agreementCollapsed, setAgreementCollapsed] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1440px)");
    const apply = () => setAgreementCollapsed(!mq.matches);
    apply();
    // Re-evaluate on resize so dragging the browser between widths
    // does the right thing without a reload.
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const [rejectReason, setRejectReason] = useState("");
  // Counter-proposal: pre-fills the textarea with the current agreement
  // text so the user edits the deal rather than retyping it. Submitting
  // hits /api/conversations/[id]/change-proposal which clears both
  // sides' accept/reject so the counterpart sees the new version fresh.
  // Jack: "on the proposed final destination in this message, there's
  // no counterproposal, so that would be good."
  const [countering, setCountering] = useState(false);
  const [counterText, setCounterText] = useState("");

  // Read-receipt: stamp /api/conversations/[id]/read on mount and after
  // every new message arrives, so the counterpart sees our ✓✓ next time
  // they load. Fire-and-forget — failure shouldn't block the chat.
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/read`, {
      method: "POST"
    }).catch(() => {});
  }, [conversationId, messages.length]);

  // Counterpart's last_read timestamp as a Date for per-message
  // comparison. Stays static from initial server render; refreshing the
  // page re-reads the latest value.
  const otherReadAt = otherLastReadAt ? new Date(otherLastReadAt) : null;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth"
    });
    // Intentionally NOT depending on editingId — entering edit mode on a
    // message in the middle of the thread should keep the user's scroll
    // position so they can see the textarea they just opened. The earlier
    // version dragged the viewport to the bottom every time edit was
    // tapped, which hid the field the user was about to type into.
  }, [messages.length, running]);

  // Dismiss the context menu on any outside click / escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  async function readError(res: Response): Promise<string> {
    const j = await res.json().catch(() => ({}) as any);
    return j.detail || j.hint || j.error || `Request failed (HTTP ${res.status})`;
  }

  // Read both the friendly message AND the retryable flag so the run loop
  // can do one more client-level retry for transient AI overloads before
  // surfacing the error to the user.
  async function readErrorWithRetryFlag(
    res: Response
  ): Promise<{ message: string; retryable: boolean }> {
    const j = await res.json().catch(() => ({}) as any);
    return {
      message:
        j.detail || j.hint || j.error || `Request failed (HTTP ${res.status})`,
      retryable: !!j.retryable
    };
  }

  // Auto-run the conversation: keep generating turns until the server says done.
  // If the user clicks re-run while done=true (typically after adding a per-
  // convo goal), pass `force: true` so the server skips its "already at turn
  // cap" / "already agreed" early-exit and actually fires another turn with
  // the new goal_override pulled fresh from the DB.
  // `proposeNow` (default false) is wired through to the prompt builder so a
  // dedicated "propose destination" button can trigger the wrap-up turn
  // without waiting for the twin to decide on its own — twins were ending
  // conversations too fast before this gate existed.
  const runLoop = useCallback(async (opts?: { proposeNow?: boolean }) => {
    const forceNext = done || !!opts?.proposeNow;
    setRunning(true);
    setError(null);
    setDone(false);
    // Per-turn timeout. Jack's bug report: "Nicole's twin has been typing
    // for the past three minutes. It seemingly is broken. There should be
    // an error message." If the server retry chain doesn't return in
    // ~45s (server already has 12s + we give 8s of client retry = 20s of
    // expected grace), we bail with a visible error instead of letting
    // the typing dots spin forever.
    const TURN_TIMEOUT_MS = 45_000;
    function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const t = window.setTimeout(() => {
          reject(
            new Error(
              `The other twin took too long to respond (${label}). They might be offline or hitting a rate limit. Try again or come back in a bit — we've logged this.`
            )
          );
        }, ms);
        p.then((v) => {
          window.clearTimeout(t);
          resolve(v);
        }).catch((err) => {
          window.clearTimeout(t);
          reject(err);
        });
      });
    }
    try {
      for (let i = 0; i < CLIENT_TURN_CAP; i++) {
        // Inner retry: if the server tells us the failure was retryable
        // (i.e. Anthropic 529 even after server-side retries), wait 8s
        // and try once more silently before surfacing to the user.
        let res: Response | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            res = await withTimeout(
              fetch("/api/run-conversation", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  conversation_id: conversationId,
                  // Only force on the FIRST iteration of the loop — once we've
                  // generated one fresh turn the natural early-exit logic
                  // should resume.
                  force: forceNext && i === 0,
                  // Same scoping: propose_now only applies to the first turn.
                  propose_now: !!opts?.proposeNow && i === 0
                })
              }),
              TURN_TIMEOUT_MS,
              `turn ${i + 1}`
            );
          } catch (timeoutErr) {
            // Auto-report so it lands on /admin/reports without the user
            // having to copy-paste the error.
            try {
              const data = JSON.stringify({
                message: `[chat-stuck] ${(timeoutErr as Error).message}`,
                source: "chat:turn-timeout",
                extras: { conversation_id: conversationId, turn: i + 1 }
              });
              if (typeof navigator !== "undefined" && navigator.sendBeacon) {
                navigator.sendBeacon(
                  "/api/error-report",
                  new Blob([data], { type: "application/json" })
                );
              }
            } catch {
              /* never throw from the reporter */
            }
            throw timeoutErr;
          }
          if (res.ok) break;
          const { message, retryable } = await readErrorWithRetryFlag(
            res.clone()
          );
          if (!retryable || attempt === 1) {
            throw new Error(message);
          }
          // Wait 8 seconds before the client-level retry. The server has
          // already burned ~12s on its 4-attempt backoff chain at this
          // point, so 8s + 12s = ~20s of total grace.
          await new Promise((r) => setTimeout(r, 8000));
        }
        if (!res || !res.ok) throw new Error(await readError(res!));
        const json = await res.json();
        if (json.message) {
          setMessages((m) => [...m, json.message]);
        }
        // Server hands back who's typing next so the indicator can render
        // on the correct side with the right name.
        if (typeof json.next_turn_user_id !== "undefined") {
          setNextTurnUserId(json.next_turn_user_id ?? null);
        }
        if (json.done) {
          setDone(true);
          // Fire-and-forget: generate the outcome summary + excitement score.
          fetch("/api/summarize-conversation", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ conversation_id: conversationId })
          }).catch(() => {});
          break;
        }
      }
    } catch (e: any) {
      setError(e.message || String(e));
      // Kill the typing-indicator state — otherwise the user sees BOTH
      // the error banner AND "Nicole is typing…" stuck on the side,
      // which is exactly the bug Jack flagged. nextTurnUserId=null
      // makes the indicator render condition fall through.
      setNextTurnUserId(null);
    } finally {
      setRunning(false);
    }
  }, [conversationId]);

  // On mount:
  //  - if the conversation isn't finished, auto-run it
  //  - if it IS finished, make sure a summary + excitement score exist
  //    (covers conversations that completed before this feature shipped)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!done) {
      runLoop();
    } else {
      fetch("/api/summarize-conversation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId })
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openMenu(e: React.MouseEvent, id: string, canEdit: boolean) {
    e.preventDefault();
    setMenu({ id, x: e.clientX, y: e.clientY, canEdit });
  }

  // Mobile equivalent of right-click: press-and-hold a bubble for ~500ms
  // to open the same menu. A single ref-keyed timer per gesture so a fast
  // tap (touchend before threshold) doesn't open the menu.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function startLongPress(
    e: React.TouchEvent,
    id: string,
    canEdit: boolean
  ) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    const t = e.touches[0];
    if (!t) return;
    const x = t.clientX;
    const y = t.clientY;
    longPressTimer.current = setTimeout(() => {
      setMenu({ id, x, y, canEdit });
    }, 500);
  }
  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  async function copyMessage(id: string) {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    try {
      await navigator.clipboard.writeText(splitAgreement(m.final_text).body);
    } catch {
      /* clipboard blocked */
    }
    setMenu(null);
  }

  function startEdit(id: string) {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    setEditingId(id);
    setEditText(m.final_text);
    setMenu(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const id = editingId;
    const newText = editText;
    // Meta-learning signal removed from the foreground: the window.prompt
    // for "why did you change this" was egregious on mobile (modal that
    // blocks the entire OS-level UI). The edit itself is still a valuable
    // training signal; we just no longer interrogate the user for the
    // reason on every save. If we want this back later it should be an
    // inline expandable note on the edited bubble, not a blocking prompt.
    const reason: string | null = null;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/edit-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message_id: id,
          new_text: newText,
          reason: reason ?? undefined
        })
      });
      if (!res.ok) throw new Error(await readError(res));
      // Locally: keep messages up to & including the edited one, drop the rest.
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === id);
        if (idx === -1) return prev;
        const kept = prev.slice(0, idx + 1);
        kept[idx] = { ...kept[idx], final_text: newText, edited: true };
        return kept;
      });
      setEditingId(null);
      setEditText("");
      setDone(false);
    } catch (e: any) {
      setError(e.message || String(e));
      setRunning(false);
      return;
    }
    // Regenerate the rest of the conversation from the edit point.
    setRunning(false);
    runLoop();
  }

  async function acceptAgreement() {
    setError(null);
    try {
      const res = await fetch("/api/respond-agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          response: "accepted"
        })
      });
      if (!res.ok) throw new Error(await readError(res));
      setMyResponse({ response: "accepted" });
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function submitRejection() {
    if (!rejectReason.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/respond-agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          response: "rejected",
          reason: rejectReason
        })
      });
      if (!res.ok) throw new Error(await readError(res));
      // Server dropped the agreement message and injected the reason as a
      // real message. Reflect that locally, then regenerate.
      const reasonText = `I can't agree to that as proposed. ${rejectReason.trim()}`;
      setMessages((prev) => {
        const kept = prev.slice(0, Math.max(0, prev.length - 1));
        return [
          ...kept,
          {
            id: `local-${Date.now()}`,
            conversation_id: conversationId,
            sender_user_id: selfUserId,
            original_draft: reasonText,
            final_text: reasonText,
            edited: false,
            sent_at: new Date().toISOString()
          }
        ];
      });
      setMyResponse(null);
      setOtherResponse(null);
      setRejecting(false);
      setRejectReason("");
      setDone(false);
    } catch (e: any) {
      setError(e.message || String(e));
      setRunning(false);
      return;
    }
    setRunning(false);
    runLoop();
  }

  /**
   * Submit a counter-proposal — user edits the deal terms and saves.
   * Hits /api/conversations/[id]/change-proposal which:
   *   - rewrites the last >>>AGREEMENT message with the new text
   *   - clears both sides' accept/reject so the counterpart sees the
   *     updated version fresh
   * On success: reflect the new agreement in local messages so the
   * panel re-renders with the counter text, close the editor, clear
   * accept/reject state.
   */
  async function submitCounter() {
    const text = counterText.trim();
    if (!text || text === (lastAgreement ?? "").trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/change-proposal`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text })
        }
      );
      if (!res.ok) throw new Error(await readError(res));
      // Patch the last agreement-bearing message locally so the panel
      // reflects the counter immediately. The next page nav (or a
      // /api/conversations/[id]/messages refetch) hydrates canonically.
      setMessages((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const { agreement, body } = splitAgreement(prev[i].final_text);
          if (agreement) {
            const next = [...prev];
            const body0 = (body ?? "").trim();
            const rebuilt = body0
              ? `${body0}\n\n>>> AGREEMENT: ${text}`
              : `>>> AGREEMENT: ${text}`;
            next[i] = {
              ...prev[i],
              original_draft: rebuilt,
              final_text: rebuilt,
              edited: true
            };
            return next;
          }
        }
        return prev;
      });
      setMyResponse(null);
      setOtherResponse(null);
      setCountering(false);
      setCounterText("");
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setRunning(false);
    }
  }

  // Pull the agreement (if any) from the last message for the summary card.
  const lastAgreement = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const { agreement } = splitAgreement(messages[i].final_text);
      if (agreement) return agreement;
    }
    return null;
  })();

  const bothAccepted =
    myResponse?.response === "accepted" &&
    otherResponse?.response === "accepted";

  // Lightweight "link your calendar" — opens a pre-filled Google Calendar event.
  const calendarUrl = lastAgreement
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        `SyncedIn: ${selfName} × ${other.name}`
      )}&details=${encodeURIComponent(
        `Agreed via SyncedIn:\n\n${lastAgreement}`
      )}`
    : "";

  return (
    <main
      className="max-w-2xl mx-auto px-4 py-4 flex flex-col h-[calc(100dvh-56px)] lg:h-[calc(100dvh-64px)] overflow-hidden"
      // Was h-screen (100vh). That ignored the sticky mobile top bar
      // (~56px) AND the desktop TopBar (~64px) sitting above main in
      // normal flow, so the page extended past the viewport and the
      // body itself scrolled. Jack: "We can make this part fit rather
      // than there being any scroll on the EXTERNAL part of this
      // chat." Now we subtract the top-bar height so main exactly
      // fills the remaining viewport — the messages-scroll container
      // inside handles all scrolling internally, no body scroll.
      //
      // 100dvh (dynamic viewport height) instead of 100vh so the
      // calc shrinks correctly when mobile address bars retract.
    >
      {(() => {
        // Short label helpers — emails crammed into a single row with two
        // spans and a "×" between them produced the mess Jack flagged
        // ("cksonjezion@…  ×  Jackson Jes…"). Derive a clean first name
        // (or local-part of email) so the header reads "Jack × Mack" on
        // mobile instead of half-truncated email addresses.
        const shortName = (full: string): string => {
          const f = (full || "").trim();
          if (!f) return "you";
          if (f.includes("@")) return f.split("@")[0]!.split(/[._\-+]/)[0]!;
          return f.split(/\s+/)[0]!;
        };
        const selfShort = shortName(selfName);
        const otherShort = shortName(other.name);
        return (
          <header className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <TwinLink
                self={{
                  id: selfUserId,
                  name: selfName,
                  avatarUrl: selfAvatarUrl ?? null
                }}
                other={{
                  id: other.id,
                  name: other.name,
                  avatarUrl: other.avatarUrl ?? null
                }}
                active={running}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href="/messages"
                  prefetch={true}
                  className="retro-dim text-xs"
                  style={{ display: "inline-block", marginBottom: 2 }}
                >
                  &lt; messages
                </Link>
                <div className="text-base sm:text-lg font-bold flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="truncate" style={{ maxWidth: "8em" }}>
                    {selfShort}
                  </span>
                  <span className="retro-dim text-xs">×</span>
                  <span className="truncate" style={{ maxWidth: "8em" }}>
                    {otherShort}
                  </span>
                  {other.isTestPersona && (
                    <span
                      className="retro-label retro-panel"
                      style={{ padding: "1px 6px", fontSize: 9 }}
                    >
                      sample
                    </span>
                  )}
                  {/* Clickable LinkedIn / X / IG / Facebook / website
                      pills next to the counterpart's name so the user
                      can dig into who they're talking to without
                      leaving the chat. Renders nothing if the user
                      hasn't connected any social profiles. */}
                  {other.socials && (
                    <SocialIconRow urls={other.socials} size={14} gap={4} />
                  )}
                  {/* Per-convo funny-mode toggle. When on, twin prompt
                      swaps to personality-forward wiring. */}
                  <FunnyModeToggle conversationId={conversationId} />
                  {/* Audio + video call launchers — opens a Jitsi
                      iframe + tldraw dream board side-by-side. On
                      end, the pasted transcript appends to BOTH
                      participants' twin context. */}
                  <CallButton
                    conversationId={conversationId}
                    otherName={other.name}
                  />
                </div>
                <div className="retro-dim text-xs flex items-center gap-1.5 mt-0.5">
                  <span>
                    {running
                      ? "twins are talking…"
                      : done
                      ? "conversation complete"
                      : "twins ready"}
                  </span>
                  <EditInfoBadge />
                </div>
              </div>
            </div>
            {!running && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Propose destination — explicit manual trigger so the
                    twin doesn't end conversations on its own discretion.
                    Only shown once there's been ≥3 exchanges (after a
                    real opener round-trip) and the conversation isn't
                    already sealed. */}
                {messages.length >= 3 && !done && (
                  <button
                    type="button"
                    onClick={() => runLoop({ proposeNow: true })}
                    className="retro-btn text-xs"
                    title="Have your twin wrap up with a concrete proposal now"
                    style={{
                      borderColor: "var(--amber)",
                      color: "var(--amber-bright)"
                    }}
                  >
                    🎯 propose destination
                  </button>
                )}
                <button
                  onClick={() => runLoop()}
                  className="retro-btn text-xs"
                  title="Continue / re-run"
                >
                  {messages.length === 0
                    ? "start"
                    : done
                      ? "re-run"
                      : "continue"}
                </button>
              </div>
            )}
          </header>
        );
      })()}

      <div ref={scrollerRef} className="flex-1 overflow-y-auto py-4 space-y-2">
        {messages.length === 0 && !running && (
          <p className="retro-dim text-sm text-center py-8">
            Press “start” — your twins will run the conversation.
          </p>
        )}

        {messages.map((m) => {
          const mine = m.sender_user_id === selfUserId;
          const { body } = splitAgreement(m.final_text);
          const isEditing = editingId === m.id;

          return (
            <div key={m.id} className={mine ? "text-right" : "text-left"}>
              {isEditing ? (
                <div className={mine ? "text-right" : "text-left"}>
                  {/* Edit happens IN the bubble — same shape, color, side. */}
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    /* Row count: take the max of explicit newlines AND a
                       wrapping estimate (~35 chars/line for the narrow
                       mobile bubble). The old formula only counted hard
                       newlines, so a 400-char paragraph with 0 newlines
                       collapsed to rows={2} even though it visibly spans
                       12+ wrapped lines. Min 4 so even short edits get
                       breathing room; cap 16 so massive blobs don't push
                       the keyboard offscreen. */
                    rows={Math.min(
                      16,
                      Math.max(
                        4,
                        editText.split("\n").length,
                        Math.ceil(editText.length / 35)
                      )
                    )}
                    autoFocus
                    className="inline-block w-[90%] max-w-md px-3.5 py-2 text-[15px] leading-snug outline-none resize-none align-bottom"
                    style={{
                      fontFamily: MSG_FONT,
                      borderRadius: 18,
                      background: mine ? "#0b84ff" : "var(--bubble-them, #e5e5ea)",
                      color: mine ? "#ffffff" : "var(--bubble-them-text, #1c1c1e)",
                      borderBottomRightRadius: mine ? 5 : 18,
                      borderBottomLeftRadius: mine ? 18 : 5,
                      boxShadow: "0 0 0 2px var(--amber)",
                      // Safety floor so even mis-computed rows can't
                      // shrink below ~5 visible lines. Keyboard takes
                      // ~half the viewport on mobile — anything tighter
                      // than this and the user can't see their text.
                      minHeight: "140px"
                    }}
                  />
                  <div
                    className={`flex gap-2 mt-1.5 ${
                      mine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                      className="retro-btn text-xs"
                    >
                      cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={running || !editText.trim()}
                      className="retro-btn retro-btn-primary text-xs"
                    >
                      save
                    </button>
                  </div>
                  <div className="retro-dim text-[10px] mt-1">
                    everything after this message regenerates
                  </div>
                </div>
              ) : (
                <>
                  <div
                    onContextMenu={(e) => openMenu(e, m.id, mine)}
                    onDoubleClick={
                      mine ? () => startEdit(m.id) : undefined
                    }
                    onTouchStart={(e) => startLongPress(e, m.id, mine)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    className="inline-block max-w-[80%] px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap cursor-default select-text"
                    style={{
                      fontFamily: MSG_FONT,
                      borderRadius: 18,
                      background: mine ? "#0b84ff" : "var(--bubble-them, #e5e5ea)",
                      color: mine ? "#ffffff" : "var(--bubble-them-text, #1c1c1e)",
                      borderBottomRightRadius: mine ? 5 : 18,
                      borderBottomLeftRadius: mine ? 18 : 5,
                      // iOS / Android long-press selects text by default;
                      // suppress that so our 500ms timer wins instead.
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "text"
                    }}
                    title={
                      mine
                        ? "Double-click, right-click, or long-press to edit"
                        : "Right-click or long-press to copy"
                    }
                  >
                    {/* linkify() wraps URLs, bare domains, and emails in
                        <a> tags so users can actually click them. Was
                        defined but never invoked — body was rendered as
                        plain text, making every link in every message
                        non-clickable. Hard bug to spot because the
                        plain-text version looked stylistically fine. */}
                    {linkify(body)}
                  </div>
                  {/* Edit affordance on your own messages. The bubble has
                      always been double-click-to-edit + right-click-to-edit
                      (per the title), but those are hidden cues nobody
                      discovers without instruction. Surfacing a small
                      "✎ edit" button below own messages makes the
                      capability obvious. Tapping it opens the same inline
                      editor double-click would. */}
                  {mine && (
                    <div
                      className="text-[10px] mt-0.5 flex items-center justify-end gap-2"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {/* WhatsApp-style read receipt. Single ✓ = delivered
                          (message exists in our DB). Double ✓✓ in brand
                          blue = the counterpart has loaded a fresh page
                          AFTER this message was sent. Server-rendered
                          snapshot only — for realtime ✓✓ updates we'd
                          subscribe to last_read_* via Supabase realtime
                          in a follow-up. */}
                      {(() => {
                        const sentAt = m.sent_at ? new Date(m.sent_at) : null;
                        const read =
                          otherReadAt && sentAt && otherReadAt >= sentAt;
                        return (
                          <span
                            aria-label={read ? "read" : "delivered"}
                            title={read ? "read" : "delivered"}
                            style={{
                              color: read
                                ? "var(--amber-bright)"
                                : "var(--text-dim)",
                              fontSize: 11,
                              lineHeight: 1
                            }}
                          >
                            {read ? "✓✓" : "✓"}
                          </span>
                        );
                      })()}
                      {m.edited && <span>✎ edited</span>}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(m.id);
                          setEditText(m.final_text);
                        }}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          background: "transparent",
                          color: "var(--text-dim)",
                          cursor: "pointer",
                          letterSpacing: "0.02em"
                        }}
                        title="Edit this message — the rest of the conversation regenerates after"
                      >
                        ✎ edit
                      </button>
                    </div>
                  )}
                  {!mine && m.edited && (
                    <div
                      className="text-[10px] retro-dim mt-0.5 text-left"
                    >
                      ✎ edited
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {running && (() => {
          // Figure out whose twin is mid-draft. Server tells us via
          // next_turn_user_id; if it hasn't responded yet, fall back to
          // "whoever's NOT the last sender" so the indicator still picks
          // a side on the very first turn.
          //
          // NB: must use `selfUserId` / `selfName` here, NOT a `self`
          // object — this component's props are flat (selfUserId,
          // selfName, ...). The bare identifier `self` resolves to the
          // browser's `window.self` global and breaks the type check.
          const lastSenderId = messages.length
            ? messages[messages.length - 1].sender_user_id
            : null;
          const typerId =
            nextTurnUserId ??
            (lastSenderId === selfUserId
              ? other.id
              : lastSenderId === other.id
                ? selfUserId
                : other.id);
          const isMine = typerId === selfUserId;
          const typerFirstName = (isMine ? selfName : other.name)
            .split(/\s+/)[0];
          return (
            <div
              className={isMine ? "text-right" : "text-left"}
              style={{ marginTop: 6 }}
            >
              <div
                className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm"
                style={{
                  background: isMine
                    ? "var(--bubble-me, #007aff)"
                    : "var(--bubble-them, #e5e5ea)",
                  borderRadius: 18,
                  color: isMine
                    ? "var(--bubble-me-text-dim, #cfe1ff)"
                    : "var(--bubble-them-text-dim, #6c6c70)"
                }}
              >
                <span style={{ fontSize: 12 }}>
                  {typerFirstName}&apos;s twin
                </span>
                {/* Three-dot animated indicator. Keyframes defined in
                    globals.css as @keyframes twinTypingDot. */}
                <span
                  aria-label="typing"
                  style={{
                    display: "inline-flex",
                    gap: 3,
                    alignItems: "center"
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "currentColor",
                        opacity: 0.7,
                        animation: `twinTypingDot 1.2s ${i * 0.18}s infinite ease-in-out`
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* PERSISTENT COMPOSE — replaces the older 3-button action row
          per Jack's call. Always-on textarea at the bottom of the
          conversation so users can type a reply directly like any
          standard chat. The ✨ AI button pre-drafts what the twin
          would say next so the user can edit before sending. The
          "let twins continue" link inside the compose calls runLoop()
          when the user wants the twins to handle the next turn on
          their own. Per-conversation goal moved to a slim toggle
          above the compose. */}
      {done && !running && !editingId && (
        <>
          {/* Twin-control chips sit together in one row above the
              compose — "add specific goal" + "let twins continue" are
              peers per Jack's restructure. Same on desktop and mobile.
              Both render as low-emphasis chips so the compose textarea
              stays the dominant affordance. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 8
            }}
          >
            <button
              type="button"
              onClick={() => setGoalOpen((v) => !v)}
              className="retro-btn text-xs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderColor: goalOpen ? "#1f8bff" : undefined,
                color: goalOpen ? "#1f8bff" : undefined,
                fontSize: 11,
                padding: "5px 10px"
              }}
              title="Set a goal that's specific to this conversation"
            >
              {goalOpen ? "× hide goal" : "🎯 add a specific goal for this convo"}
            </button>
            <button
              type="button"
              onClick={() => runLoop()}
              className="retro-btn text-xs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                padding: "5px 10px"
              }}
              title="Have the twins continue the conversation on their own"
            >
              ↻ let twins continue
            </button>
          </div>
          {goalOpen && (
            <PerConversationGoal
              conversationId={conversationId}
              otherName={other.name}
            />
          )}
          <PersistentCompose
            conversationId={conversationId}
            onSent={(msg) => {
              setMessages((prev) => [...prev, msg]);
              setDone(false);
            }}
            onContinueLoop={() => runLoop()}
          />
        </>
      )}

      {/* Wrapper: proposed-destination pill + expanded agreement panel
          + outcome card. On lg+ desktop screens this stack pins to the
          right of the chat as a fixed rail — Jack: "we can fix it by
          putting the proposed destination and the outcome on the right
          side where there's free space." On mobile/tablet it stays
          inline at the bottom of the chat. */}
      <div className="conv-action-rail">
        <style>{`
          /* Mobile / tablet / narrow desktop (<1440): inline (default
             block flow). Panels appear after the message stream but
             before the input. Saves us from cramming a 330px rail
             into a viewport that doesn't have room for it. */
          .conv-action-rail { display: block; }

          /* True desktop (≥1440px) — fixed right rail. Bumped up from
             1100px after Jack flagged the chat looking cramped: at
             1100-1380px the centered max-w-2xl chat (672px) + left
             sidebar (220px) + conv rail (~64px) + right rail (330px)
             leaves no breathing room. 1440 gives ~150px of margin on
             each side of the chat. */
          @media (min-width: 1440px) {
            .conv-action-rail {
              position: fixed;
              top: 96px;
              right: 28px;
              width: 330px;
              max-height: calc(100dvh - 120px);
              overflow-y: auto;
              z-index: 6;
              padding-left: 4px;
            }
            .conv-action-rail::-webkit-scrollbar { width: 6px; }
            .conv-action-rail::-webkit-scrollbar-thumb {
              background: rgba(120, 130, 160, 0.25);
              border-radius: 3px;
            }
          }
        `}</style>
      {/* Outcome / "the deal" card — placed ABOVE the proposed-destination
          panel in the rail. Jack: "Now that we have proposed destination
          on the right side we can put it under outcome and not collapsed."
          The outcome reads as the headline (deal summary + excitement %)
          and the proposed-destination panel underneath is the actionable
          panel where the user accepts / counters / rejects. */}
      {summaryResult && (
        <div
          className="mb-2 p-3 retro-panel"
          style={{
            borderColor: "var(--amber)",
            background: "var(--panel-2)"
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
            <div
              className="retro-label"
              style={{ color: "var(--amber-bright)" }}
            >
              outcome
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--amber-bright)",
                fontFamily: "monospace"
              }}
              title="Excitement score — your twin's read on how high-potential this connection is (0-99)."
            >
              {Math.round(summaryResult.excitement_score)}%
            </div>
          </div>
          {summaryResult.summary && (
            <div
              className="text-sm"
              style={{ marginBottom: 6, lineHeight: 1.45 }}
            >
              {summaryResult.summary}
            </div>
          )}
          {summaryResult.counterpart_summary && (
            <div
              className="retro-dim text-xs"
              style={{ lineHeight: 1.5 }}
            >
              <strong style={{ color: "var(--text)" }}>
                About {other.name}:
              </strong>{" "}
              {summaryResult.counterpart_summary}
            </div>
          )}
        </div>
      )}

      {/* Agreement card — accept (green ✓) / reject (red ✗) */}
      {/* Collapsed pill — taps to expand. Pulses subtly to read as
          actionable; the static version was getting missed because users
          read it as a status badge, not a button. */}
      {lastAgreement && agreementCollapsed && (
        <>
          <style>{`
            @keyframes synced-destination-pulse {
              0%, 100% {
                box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55);
              }
              50% {
                box-shadow: 0 0 0 6px rgba(245, 158, 11, 0);
              }
            }
            @keyframes synced-destination-pulse-sealed {
              0%, 100% {
                box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
              }
              50% {
                box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
              }
            }
            .synced-destination-pill {
              animation: synced-destination-pulse 2.4s ease-in-out infinite;
              transition: transform 120ms ease;
            }
            .synced-destination-pill.sealed {
              animation: synced-destination-pulse-sealed 2.4s ease-in-out infinite;
            }
            .synced-destination-pill:hover,
            .synced-destination-pill:active {
              transform: scale(1.01);
            }
            .synced-destination-check {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 22px;
              height: 22px;
              border-radius: 11px;
              flex-shrink: 0;
              font-size: 13px;
              font-weight: 800;
              line-height: 1;
            }
            @media (prefers-reduced-motion: reduce) {
              .synced-destination-pill { animation: none !important; }
            }
          `}</style>
          <button
            type="button"
            onClick={() => setAgreementCollapsed(false)}
            className={`retro-panel mb-2 w-full text-left synced-destination-pill${
              bothAccepted ? " sealed" : ""
            }`}
            style={{
              borderColor: bothAccepted ? "var(--green)" : "var(--amber)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                color: bothAccepted ? "var(--green)" : "var(--amber-bright)",
                fontWeight: 700
              }}
            >
              <span
                className="synced-destination-check"
                aria-hidden="true"
                style={{
                  background: bothAccepted
                    ? "var(--green)"
                    : "var(--amber-bright)",
                  color: "#0a0c14"
                }}
              >
                ✓
              </span>
              {bothAccepted ? "deal sealed" : "proposed destination"}
            </span>
            <span
              className="retro-dim"
              style={{ fontSize: 11, whiteSpace: "nowrap" }}
            >
              tap to {bothAccepted ? "schedule" : "review & accept"} →
            </span>
          </button>
        </>
      )}
      {lastAgreement && !agreementCollapsed && (
        <div
          className="retro-panel p-3 mb-2"
          style={{
            borderColor: bothAccepted ? "var(--green)" : "var(--amber)"
          }}
        >
          {/* Header is the full-width collapse target — clicking anywhere
              in the strip (not just the small "− collapse" button) folds
              the panel. The accept/reject buttons below still work
              because their own onClick handlers stopPropagation. */}
          <div
            className="flex items-center justify-between gap-2"
            onClick={() => setAgreementCollapsed(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setAgreementCollapsed(true);
              }
            }}
            style={{ cursor: "pointer", userSelect: "none" }}
            aria-label="Collapse deal panel"
            title="Click anywhere on this row to collapse"
          >
            <div
              className="retro-label"
              style={{
                color: bothAccepted ? "var(--green)" : "var(--amber)"
              }}
            >
              // {bothAccepted ? "deal sealed" : "proposed final destination"}
            </div>
            <span
              className="retro-dim"
              style={{ fontSize: 11 }}
            >
              − collapse
            </span>
          </div>
          <div
            className="mt-1.5 text-sm"
            style={{ fontFamily: MSG_FONT, color: "var(--text)" }}
          >
            {lastAgreement}
          </div>

          {/* counterpart status */}
          <div className="mt-2 text-[11px] retro-dim">
            {other.name}:{" "}
            {otherResponse?.response === "accepted" ? (
              <span className="retro-green">accepted ✓</span>
            ) : otherResponse?.response === "rejected" ? (
              <span className="retro-red">rejected ✗</span>
            ) : (
              "waiting for response"
            )}
          </div>

          {/* my action */}
          {rejecting ? (
            <div className="mt-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder="What doesn't work? Your twins will renegotiate with this in mind."
                className="retro-input text-sm"
                style={{ fontFamily: MSG_FONT }}
              />
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => {
                    setRejecting(false);
                    setRejectReason("");
                  }}
                  className="retro-btn text-xs"
                >
                  cancel
                </button>
                <button
                  onClick={submitRejection}
                  disabled={running || !rejectReason.trim()}
                  className="retro-btn text-xs"
                  style={{ borderColor: "var(--red)", color: "var(--red)" }}
                >
                  ✗ reject &amp; renegotiate
                </button>
              </div>
            </div>
          ) : myResponse?.response === "accepted" ? (
            <div className="mt-2">
              <div className="text-[11px] retro-green">
                You accepted ✓
              </div>
              {bothAccepted && (
                <SchedulePanel
                  selfName={selfName}
                  selfEmail={selfEmail ?? null}
                  otherName={other.name}
                  otherEmail={other.email ?? null}
                  agreement={lastAgreement ?? ""}
                  conversationId={conversationId}
                />
              )}
            </div>
          ) : (
            <div
              className="flex gap-2 mt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  acceptAgreement();
                }}
                disabled={running}
                className="retro-btn retro-btn-primary flex-1 text-sm"
                style={{
                  // Primary CTA styling — filled background, white text,
                  // green-tinted glow so it reads as THE button to press.
                  background:
                    "linear-gradient(135deg, var(--green, #3cd870) 0%, #2bb95a 100%)",
                  borderColor: "transparent",
                  color: "#ffffff",
                  fontWeight: 700,
                  padding: "10px 14px",
                  boxShadow: "0 4px 14px -4px rgba(60, 216, 112, 0.55)"
                }}
              >
                ✓ Accept this deal
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRejecting(true);
                }}
                disabled={running}
                className="retro-btn text-sm"
                style={{
                  borderColor: "var(--red)",
                  color: "var(--red)",
                  flex: "0 0 auto",
                  padding: "10px 14px"
                }}
              >
                ✗ Reject
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Pre-fill with the current agreement so the user is
                  // editing the deal, not rewriting from blank.
                  setCounterText(lastAgreement ?? "");
                  setCountering(true);
                }}
                disabled={running}
                className="retro-btn text-sm"
                style={{
                  borderColor: "var(--amber)",
                  color: "var(--amber-bright)",
                  flex: "0 0 auto",
                  padding: "10px 14px"
                }}
                title="Edit the deal terms — both sides' accept/reject clears so the counterpart sees your counter fresh."
              >
                ↺ Counter
              </button>
            </div>
          )}
          {countering && (
            <div
              className="mt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="retro-label"
                style={{
                  color: "var(--amber-bright)",
                  marginBottom: 6
                }}
              >
                Counter-proposal
              </div>
              <p
                className="retro-dim"
                style={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  marginBottom: 6
                }}
              >
                Edit the deal below. Saving clears both sides&apos;
                accept/reject so {other.name} sees the new version fresh.
              </p>
              <textarea
                value={counterText}
                onChange={(e) =>
                  setCounterText(e.target.value.slice(0, 4000))
                }
                rows={6}
                autoFocus
                className="retro-input text-sm"
                style={{
                  width: "100%",
                  fontFamily: MSG_FONT,
                  padding: 10,
                  resize: "vertical"
                }}
              />
              <div
                className="flex items-center justify-between mt-2"
                style={{ gap: 8 }}
              >
                <span
                  style={{ fontSize: 11, color: "var(--text-dim)" }}
                >
                  {counterText.length}/4000
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCountering(false);
                      setCounterText("");
                    }}
                    className="retro-btn text-xs"
                    style={{ padding: "6px 12px" }}
                  >
                    cancel
                  </button>
                  <button
                    onClick={submitCounter}
                    disabled={
                      running ||
                      !counterText.trim() ||
                      counterText.trim() === (lastAgreement ?? "").trim()
                    }
                    className="retro-btn retro-btn-primary text-xs"
                    style={{ padding: "6px 12px" }}
                  >
                    {running ? "saving…" : "save counter"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      </div>{/* /conv-action-rail */}

      <div className="border-t border-[var(--border)] pt-3">
        {error && (
          <div
            className="mb-2 p-2 retro-panel"
            style={{ borderColor: "var(--red)" }}
          >
            <div className="retro-red text-xs font-semibold">
              ! something went wrong
            </div>
            <div className="retro-dim text-[11px] break-words mt-0.5">
              {error}
            </div>
          </div>
        )}

        {/* Manual "summarize conversation" button removed — Jack:
            "lets automatically summarize the conversation." The
            useEffect at the top of this component triggers
            summarizeNow() the first time `done` flips true with
            messages present. A subtle "summarizing…" pill renders
            below while it's in flight so the user knows. */}
        {summarizing && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 8,
              fontSize: 11,
              color: "var(--text-dim)"
            }}
          >
            ✦ auto-summarizing…
          </div>
        )}

        {/* outcome card moved into conv-action-rail above so it docks
            on the right side on desktop instead of cluttering the
            bottom of the chat flow. */}

        <div className="retro-dim text-[11px] text-center">
          right-click any message to copy · double-click your own to edit —
          editing regenerates everything after
        </div>
      </div>

      {/* Context menu */}
      {menu && (
        <div
          className="fixed retro-panel retro-shadow z-50 text-sm"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => copyMessage(menu.id)}
            className="block w-full text-left px-4 py-2 hover:bg-[var(--panel-2)]"
          >
            Copy
          </button>
          {menu.canEdit && (
            <button
              onClick={() => startEdit(menu.id)}
              className="block w-full text-left px-4 py-2 hover:bg-[var(--panel-2)] border-t border-[var(--border)]"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </main>
  );
}
