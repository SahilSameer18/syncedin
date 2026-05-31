import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Avatar } from "../../Avatar";

/**
 * ConversationRail — narrow vertical strip on the left of the
 * conversation page (desktop only). Lets the user hop between active
 * conversations without going back to /messages. Mounted as a fixed-
 * position element so it doesn't fight ChatUI's `h-screen` layout.
 *
 * On screens < lg it's hidden — mobile uses the back button + the
 * AppShell hamburger drawer for nav.
 *
 * Each item: small avatar + first name + status pip. The active
 * conversation is highlighted. Every link uses prefetch={true} so
 * hopping is instant.
 */
export async function ConversationRail({
  activeId
}: {
  activeId: string;
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();

  const { data: convs } = await supabase
    .from("conversations")
    .select(
      "id, participant_a, participant_b, status, created_at, excitement_score"
    )
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = (convs as any[]) ?? [];
  if (rows.length === 0) return null;

  // Status pip color per conversation. The dot used to be a flat blue
  // glyph on every avatar — Jack's call: make it mean something.
  //   amber  = waiting on YOU (last message is theirs, you should reply)
  //   gray   = waiting on them (last message is yours, ball in their court)
  //   none   = no messages yet
  // Pulled in one batched messages query so we don't N+1.
  const convIds = rows.map((c) => c.id);
  const { data: lastMsgs } = convIds.length
    ? await service
        .from("messages")
        .select("conversation_id, sender_user_id, sent_at")
        .in("conversation_id", convIds)
        .order("sent_at", { ascending: false })
    : { data: [] as Array<{
        conversation_id: string;
        sender_user_id: string;
        sent_at: string;
      }> };
  const lastByConv = new Map<string, { sender_user_id: string; sent_at: string }>();
  for (const m of (lastMsgs ?? []) as Array<{
    conversation_id: string;
    sender_user_id: string;
    sent_at: string;
  }>) {
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, {
        sender_user_id: m.sender_user_id,
        sent_at: m.sent_at
      });
    }
  }
  function statusDot(convId: string):
    | { color: string; label: string }
    | null {
    const last = lastByConv.get(convId);
    if (!last) return null;
    if (last.sender_user_id === user!.id) {
      return { color: "#9ca3af", label: "waiting on them" };
    }
    return { color: "var(--amber-bright)", label: "your turn" };
  }

  const otherIds = Array.from(
    new Set(
      rows.map((c) => (c.participant_a === user.id ? c.participant_b : c.participant_a))
    )
  );
  const { data: profiles } = await service
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .in("id", otherIds);
  const profById = new Map<
    string,
    { display_name: string | null; email: string | null; avatar_url: string | null }
  >();
  for (const p of (profiles ?? []) as any[]) {
    profById.set(p.id, {
      display_name: p.display_name ?? null,
      email: p.email ?? null,
      avatar_url: p.avatar_url ?? null
    });
  }

  const firstName = (full: string) => {
    const f = (full || "").trim();
    if (!f) return "—";
    if (f.includes("@")) return f.split("@")[0]!.split(/[._\-+]/)[0]!;
    return f.split(/\s+/)[0]!;
  };

  return (
    <>
      {/* Mobile horizontal rail — sticks under the AppShell mobile top
          bar so users can swipe between conversations without bouncing
          back to /messages. Same data as the desktop vertical rail. */}
      {/* Mobile rail — kept compact (no name labels, smaller avatars)
          so it doesn't overlap or compete with the conversation header
          right below it. Names are still implied by the avatar itself
          (initials/photo) and the active state has an amber ring. */}
      <aside
        className="flex lg:hidden"
        style={{
          position: "sticky",
          // MobileShell's top bar is 56px tall (sticky, top: 0). The rail
          // sits flush against the bottom of that bar — top: 56 prevents
          // the rail from sliding UNDER the wordmark on scroll, which was
          // creating the double-overlap you saw on mobile.
          top: 56,
          zIndex: 6,
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          background: "var(--panel-solid)",
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          minHeight: 38
        }}
      >
        <Link
          href="/messages"
          prefetch={true}
          aria-label="Back to all messages"
          title="Back to all messages"
          style={{
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 14,
            background: "var(--panel-2)",
            color: "var(--text-dim)",
            textDecoration: "none"
          }}
        >
          {/* Chat-bubble glyph instead of the second hamburger — the
              hamburger was confusable with MobileShell's nav drawer
              trigger right above it. This icon reads as "back to
              messages list" with one glance. */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </Link>
        {rows.map((c) => {
          const otherId =
            c.participant_a === user.id ? c.participant_b : c.participant_a;
          const p = profById.get(otherId);
          const fullName = p?.display_name || p?.email || "Someone";
          const active = c.id === activeId;
          return (
            <Link
              key={c.id}
              href={`/conversations/${c.id}`}
              prefetch={true}
              aria-label={`Open conversation with ${fullName}`}
              aria-current={active ? "page" : undefined}
              style={{
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                padding: 0,
                border: active
                  ? "2px solid var(--amber)"
                  : "2px solid transparent",
                borderRadius: 16,
                width: 32,
                height: 32
              }}
            >
              <div style={{ position: "relative" }}>
                <Avatar
                  id={otherId}
                  name={fullName}
                  avatarUrl={p?.avatar_url ?? null}
                  size={26}
                />
                {(() => {
                  const dot = statusDot(c.id);
                  if (!dot) return null;
                  return (
                    <span
                      aria-label={dot.label}
                      title={dot.label}
                      style={{
                        position: "absolute",
                        right: -2,
                        bottom: -2,
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        background: dot.color,
                        border: "1.5px solid var(--panel-solid)"
                      }}
                    />
                  );
                })()}
              </div>
            </Link>
          );
        })}
      </aside>

      <aside
        className="hidden lg:flex"
        style={{
          position: "fixed",
          top: 16,
          bottom: 16,
          // Sits immediately right of the main sidebar. After
          // matching sidebar width to AppShell's 200px the rail
          // moves from left:252 → left:232 (200 + 16 gap + 16
          // padding) so the chat column starts at the same place
          // it does on every other AppShell page.
          left: 232,
          width: 110,
          flexDirection: "column",
          gap: 6,
          padding: 10,
          background: "var(--panel-solid)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflowY: "auto",
          zIndex: 5
        }}
      >
      <Link
        href="/messages"
        prefetch={true}
        aria-label="All messages"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "6px 4px",
          textDecoration: "none",
          color: "var(--text-dim)",
          fontSize: 9,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 700,
          borderRadius: 8,
          marginBottom: 4,
          background: "var(--panel-2)"
        }}
      >
        <span style={{ fontSize: 16 }}>☰</span>
        <span>all</span>
      </Link>

      {rows.map((c) => {
        const otherId =
          c.participant_a === user.id ? c.participant_b : c.participant_a;
        const p = profById.get(otherId);
        const fullName = p?.display_name || p?.email || "Someone";
        const fn = firstName(fullName);
        const active = c.id === activeId;
        // Status dot is now action-aware, not status-string-aware:
        //   amber = waiting on you (their last message, ball in your court)
        //   gray  = waiting on them (your last message)
        //   sealed conversations still show green for completion
        const sd = statusDot(c.id);
        const dot =
          c.status === "closed"
            ? "var(--green, #3cd870)"
            : sd
              ? sd.color
              : "transparent";
        const dotLabel = c.status === "closed" ? "sealed" : sd?.label ?? "";
        return (
          <Link
            key={c.id}
            href={`/conversations/${c.id}`}
            prefetch={true}
            aria-label={`Open conversation with ${fullName}`}
            aria-current={active ? "page" : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "6px 4px",
              borderRadius: 10,
              textDecoration: "none",
              background: active ? "var(--panel-2)" : "transparent",
              border: active
                ? "1px solid var(--amber)"
                : "1px solid transparent",
              transition: "background 120ms, border-color 120ms"
            }}
          >
            <div style={{ position: "relative" }}>
              <Avatar
                id={otherId}
                name={fullName}
                avatarUrl={p?.avatar_url ?? null}
                size={56}
              />
              {dot !== "transparent" && (
                <span
                  aria-label={dotLabel}
                  title={dotLabel}
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: -1,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: dot,
                    border: "2px solid var(--panel-solid)"
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: active ? "var(--text)" : "var(--text-dim)",
                maxWidth: 60,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "center"
              }}
            >
              {fn}
            </span>
          </Link>
        );
      })}
    </aside>
    </>
  );
}
