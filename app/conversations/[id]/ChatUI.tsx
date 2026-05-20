"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Message } from "@/lib/types";
import { Avatar } from "../../Avatar";

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
  initialOtherResponse
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
  };
  initialMessages: Message[];
  initialDone: boolean;
  initialMyResponse: ResponseState | null;
  initialOtherResponse: ResponseState | null;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [done, setDone] = useState(initialDone);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  // Mobile-critical: the deal-sealed panel + SchedulePanel together can
  // cover the entire viewport on a phone, hiding the chat the user is
  // trying to read. Default collapsed on first render — the user sees a
  // small "Deal sealed · open" pill and taps to expand.
  const [agreementCollapsed, setAgreementCollapsed] = useState(true);
  const [rejectReason, setRejectReason] = useState("");

  const scrollerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages.length, running, editingId]);

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

  // Auto-run the conversation: keep generating turns until the server says done.
  const runLoop = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      for (let i = 0; i < CLIENT_TURN_CAP; i++) {
        const res = await fetch("/api/run-conversation", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversation_id: conversationId })
        });
        if (!res.ok) throw new Error(await readError(res));
        const json = await res.json();
        if (json.message) {
          setMessages((m) => [...m, json.message]);
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
    <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col h-screen">
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
                <div className="text-base sm:text-lg font-bold flex items-center gap-1.5 min-w-0">
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
              <button
                onClick={runLoop}
                className="retro-btn text-xs shrink-0"
                title="Continue / re-run"
              >
                {messages.length === 0 ? "start" : done ? "re-run" : "continue"}
              </button>
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
                    rows={Math.min(
                      12,
                      Math.max(2, editText.split("\n").length)
                    )}
                    autoFocus
                    className="inline-block w-[80%] max-w-md px-3.5 py-2 text-[15px] leading-snug outline-none resize-none align-bottom"
                    style={{
                      fontFamily: MSG_FONT,
                      borderRadius: 18,
                      background: mine ? "#0b84ff" : "var(--bubble-them, #e5e5ea)",
                      color: mine ? "#ffffff" : "var(--bubble-them-text, #1c1c1e)",
                      borderBottomRightRadius: mine ? 5 : 18,
                      borderBottomLeftRadius: mine ? 18 : 5,
                      boxShadow: "0 0 0 2px var(--amber)"
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
                    className="inline-block max-w-[80%] px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap cursor-default select-text"
                    style={{
                      fontFamily: MSG_FONT,
                      borderRadius: 18,
                      background: mine ? "#0b84ff" : "var(--bubble-them, #e5e5ea)",
                      color: mine ? "#ffffff" : "var(--bubble-them-text, #1c1c1e)",
                      borderBottomRightRadius: mine ? 5 : 18,
                      borderBottomLeftRadius: mine ? 18 : 5
                    }}
                    title={
                      mine
                        ? "Double-click or right-click to edit"
                        : "Right-click to copy"
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

        {running && (
          <div className="text-left">
            <div
              className="inline-block px-3.5 py-2.5 text-sm"
              style={{
                background: "var(--bubble-them, #e5e5ea)",
                borderRadius: 18,
                color: "var(--bubble-them-text-dim, #6c6c70)"
              }}
            >
              twins are drafting the next turn
              <span className="retro-cursor" />
            </div>
          </div>
        )}
      </div>

      {/* Agreement card — accept (green ✓) / reject (red ✗) */}
      {/* Collapsed pill — minimal footprint, taps to expand */}
      {lastAgreement && agreementCollapsed && (
        <button
          type="button"
          onClick={() => setAgreementCollapsed(false)}
          className="retro-panel mb-2 w-full text-left"
          style={{
            borderColor: bothAccepted ? "var(--green)" : "var(--amber)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "10px 12px",
            fontSize: 13,
            cursor: "pointer"
          }}
        >
          <span
            style={{
              color: bothAccepted ? "var(--green)" : "var(--amber-bright)",
              fontWeight: 600
            }}
          >
            {bothAccepted ? "✓ deal sealed" : "// proposed destination"}
          </span>
          <span
            className="retro-dim"
            style={{ fontSize: 11 }}
          >
            tap to {bothAccepted ? "schedule" : "review & accept"} →
          </span>
        </button>
      )}
      {lastAgreement && !agreementCollapsed && (
        <div
          className="retro-panel p-3 mb-2"
          style={{
            borderColor: bothAccepted ? "var(--green)" : "var(--amber)"
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div
              className="retro-label"
              style={{
                color: bothAccepted ? "var(--green)" : "var(--amber)"
              }}
            >
              // {bothAccepted ? "deal sealed" : "proposed final destination"}
            </div>
            <button
              type="button"
              onClick={() => setAgreementCollapsed(true)}
              className="retro-dim hover:text-white"
              style={{
                fontSize: 11,
                background: "transparent",
                border: 0,
                cursor: "pointer",
                padding: "2px 6px"
              }}
              aria-label="Collapse deal panel"
            >
              − collapse
            </button>
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
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={acceptAgreement}
                disabled={running}
                className="retro-btn flex-1 text-sm"
                style={{
                  borderColor: "var(--green)",
                  color: "var(--green)"
                }}
              >
                ✓ Accept
              </button>
              <button
                onClick={() => setRejecting(true)}
                disabled={running}
                className="retro-btn flex-1 text-sm"
                style={{ borderColor: "var(--red)", color: "var(--red)" }}
              >
                ✗ Reject
              </button>
            </div>
          )}
        </div>
      )}

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
