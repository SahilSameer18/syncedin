"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";
import { Wordmark } from "./Wordmark";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Sidebar — vertical nav for signed-in users.
 *
 * Replaces the avatar-dropdown NavMenu. Profile block lives at the top,
 * primary destinations stack vertically, sign out is pinned to the bottom.
 *
 * Layout-friendly: the parent grid sizes this at 220px wide on desktop and
 * collapses to a horizontal scroller on mobile (handled by the parent).
 */
export function Sidebar({
  userId,
  displayName,
  avatarUrl,
  signOutAction,
  conferences = [],
  unreadCounts = {}
}: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  signOutAction: () => void | Promise<void>;
  conferences?: { slug: string; name: string }[];
  /** Per-route unread badges. Key is the route href (e.g. "/messages",
   *  "/poll"); value is the count to display in a small red bubble.
   *  0 or missing = no badge. AppShell computes these server-side so
   *  the nav badges stay accurate without a client round-trip. */
  unreadCounts?: Record<string, number>;
}) {
  const pathname = usePathname() ?? "";

  // Semantic emoji icons — each conveys the destination at a glance, much
  // better than the abstract geometric glyphs they replace.
  const items: Array<{ href: string; label: string; icon: string }> = [
    { href: "/dashboard", label: "Dashboard", icon: "🏠" },
    { href: "/messages", label: "Messages", icon: "💬" },
    { href: "/proposals", label: "Proposals", icon: "🤝" },
    { href: "/invite", label: "Invite", icon: "💌" },
    { href: "/poll", label: "Poll", icon: "📊" },
    { href: "/personal-intelligence", label: "Personal intelligence", icon: "✨" },
    { href: "/conferences/new", label: "Sync a conference", icon: "🎤" },
    { href: "/communities/new", label: "Sync a community", icon: "👥" },
    { href: "/onboarding", label: "Edit twin", icon: "🧬" },
    // Settings now points at the unified hub (notifications + password +
    // delete account + portfolio link), not the lone notifications page.
    { href: "/settings", label: "Settings", icon: "⚙️" },
    { href: "/feedback", label: "Feedback", icon: "💡" },
    // The Hypernetwork sits at the bottom as the destination — every other
    // action above feeds into it. Renamed from "Hypernetwork" so the label
    // reads like a place you can visit, not a generic concept.
    { href: "/hypernetwork", label: "The Hypernetwork", icon: "🌐" }
  ];

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <aside
      style={{
        position: "sticky",
        top: 16,
        alignSelf: "start",
        background: "var(--panel-solid)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        // Spacing: small breathing room around the logo (8px top / 8px
        // bottom on the sidebar shell itself) — was at 0 which made the
        // wordmark touch the panel edge. The tight wordmark PNG no
        // longer has the 80%-transparent-padding problem so a small
        // outer pad reads correctly.
        padding: "8px 14px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 6
        // minHeight removed — was 480 which created huge bottom whitespace
        // when the user has few nav items; let content size the sidebar.
      }}
    >
      {/* Wordmark — fills the sidebar width. Width:100% forces it to spread
          to the full available column instead of rendering at the PNG's
          natural pixel size. Tight top + bottom padding so the wordmark
          sits flush against the profile block below it. */}
      <Link
        href="/"
        aria-label="SyncedIn — home"
        style={{
          display: "block",
          padding: 0,
          margin: 0,
          textDecoration: "none",
          width: "100%"
        }}
      >
        {/* Use the TIGHT wordmark variant — the regular PNG has ~80%
            transparent padding baked into the 500x500 image (task #103),
            which is why the previous Sidebar-padding cuts didn't visibly
            change anything: the whitespace was inside the image, not
            around it. Hard max-height cap as belt-and-suspenders. */}
        <img
          src="/syncedin-wordmark-tight.png"
          alt="SyncedIn"
          className="wordmark-themed"
          style={{
            width: "100%",
            height: "auto",
            maxHeight: 34,
            objectFit: "contain",
            display: "block"
          }}
        />
      </Link>

      {/* Profile block */}
      <Link
        href="/onboarding"
        className="flex items-center gap-3"
        style={{
          padding: 8,
          borderRadius: 10,
          background: "var(--panel-2)",
          textDecoration: "none"
        }}
        aria-label="Edit your twin"
      >
        <Avatar
          id={userId}
          name={displayName}
          avatarUrl={avatarUrl}
          size={36}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: "var(--text)",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              marginTop: 2,
              letterSpacing: "0.06em",
              textTransform: "uppercase"
            }}
          >
            signed in
          </div>
        </div>
      </Link>

      {/* Primary nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((item) => {
          const active = isActive(item.href);
          const unread = unreadCounts[item.href] ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 8,
                fontSize: 14,
                color: active ? "var(--text)" : "var(--text-dim)",
                background: active ? "var(--panel-2)" : "transparent",
                fontWeight: active ? 600 : 400,
                textDecoration: "none",
                borderLeft: active
                  ? "2px solid var(--amber)"
                  : "2px solid transparent"
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  color: active ? "var(--amber-bright)" : "var(--text-dim)"
                }}
              >
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {unread > 0 && (
                <span
                  aria-label={`${unread} unread`}
                  title={`${unread} thing${
                    unread === 1 ? "" : "s"
                  } waiting on you`}
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 0 3px var(--panel-solid)"
                  }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* My conferences */}
      {conferences.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              padding: "0 10px 4px",
              marginTop: 4
            }}
          >
            Your conferences
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {conferences.map((c) => {
              const href = `/conferences/${c.slug}`;
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={c.slug}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    borderRadius: 8,
                    fontSize: 13,
                    color: active ? "var(--text)" : "var(--text-dim)",
                    background: active ? "var(--panel-2)" : "transparent",
                    fontWeight: active ? 600 : 400,
                    textDecoration: "none",
                    borderLeft: active
                      ? "2px solid var(--amber)"
                      : "2px solid transparent"
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      display: "inline-flex",
                      justifyContent: "center",
                      fontSize: 11,
                      color: active ? "var(--amber-bright)" : "var(--text-dim)",
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
                    }}
                  >
                    ◈
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                      flex: 1
                    }}
                  >
                    {c.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* + new conversation — primary CTA, lives above the sign out row */}
      <Link
        href="/conversations/new"
        className="retro-btn retro-btn-primary"
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px 12px",
          fontSize: 14
        }}
      >
        + new conversation
      </Link>

      {/* Bottom row: sign out + compact theme toggle */}
      <div
        style={{
          paddingTop: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderTop: "1px solid var(--border)"
        }}
      >
        <form action={signOutAction} style={{ flex: 1 }}>
          <button
            type="submit"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--text-dim)",
              background: "transparent",
              border: 0,
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              fontFamily: "inherit"
            }}
          >
            <span
              style={{
                width: 16,
                display: "inline-flex",
                justifyContent: "center",
                fontSize: 11,
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
              }}
            >
              ↗
            </span>
            <span>Sign out</span>
          </button>
        </form>
        {/* Compact theme toggle — wrapper shrinks the inline button styling
            without touching the shared ThemeToggle component used elsewhere. */}
        <div
          style={{
            fontSize: 11,
            transform: "scale(0.85)",
            transformOrigin: "right center"
          }}
        >
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
