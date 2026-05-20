"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";
import Link from "next/link";

/**
 * MobileShell — client wrapper that ONLY renders on mobile (≤ lg breakpoint).
 *
 * On mobile the sidebar was rendering as a full-width column stacked above
 * the page content. With the new sci-fi-upload SyncMeter (which has a 50px
 * magenta drop-shadow), the dashboard's main column would render the meter
 * RIGHT ON TOP of the sidebar list. Looked broken.
 *
 * This component:
 *   1. Renders a thin top bar with [☰] + wordmark + theme toggle.
 *   2. Hides the desktop sidebar entirely on screens < lg.
 *   3. Toggles a slide-in drawer that holds the full sidebar content
 *      when the hamburger is tapped.
 *
 * AppShell still owns the desktop sidebar — it's wrapped in
 * `<div className="hidden lg:block">` so it disappears on mobile, and
 * MobileShell takes over the navigation chrome for ≤lg.
 */
export function MobileShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Close drawer on route change. Detect via popstate since Next 14 App
  // Router doesn't expose a low-level "route changed" hook in the same way.
  useEffect(() => {
    function onNav() {
      setOpen(false);
    }
    window.addEventListener("popstate", onNav);
    return () => window.removeEventListener("popstate", onNav);
  }, []);

  // Body scroll lock when drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Top mobile bar — kept thin. Padding + button height + wordmark
          height all sized so the bar lands at ~44px total. Earlier
          version ate ~30% of phone viewport height because the wordmark
          rendered at natural ~60px tall.

          CRITICAL: `display` MUST stay in the className, not the inline
          style. Inline-style `display: flex` outranks Tailwind's
          `lg:hidden` (which sets `display: none` at lg+), and the bar
          starts leaking onto desktop. Bug shipped once already. */}
      <div
        className="flex lg:hidden items-center"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "var(--panel-solid)",
          borderBottom: "1px solid var(--border)",
          padding: "5px 10px",
          gap: 8,
          minHeight: 44
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open menu"
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            border: "1px solid var(--border-bright)",
            background: "transparent",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text)",
            fontSize: 16,
            flexShrink: 0
          }}
        >
          {open ? "✕" : "☰"}
        </button>
        <Link
          href="/"
          aria-label="SyncedIn — home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 28,
            textDecoration: "none",
            flexShrink: 0
          }}
        >
          {/* Bypass the Wordmark component's size prop (smallest preset is
              40px, too tall for the mobile bar) and render the PNG directly
              at 22px. wordmark-themed class handles dark-mode invert. */}
          <img
            src="/syncedin-wordmark.png"
            alt="SyncedIn"
            className="wordmark-themed"
            height={22}
            style={{ height: 22, width: "auto", display: "block" }}
          />
        </Link>
      </div>

      {/* Drawer + scrim — slides in from left when open. Same
          inline-style vs Tailwind specificity caveat as above: do NOT
          set `display` inline; let `lg:hidden` win at lg+. We control
          interactivity via pointerEvents, not display, so the drawer
          can still animate when open changes on mobile. */}
      <div
        className="lg:hidden"
        aria-hidden={!open}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          pointerEvents: open ? "auto" : "none"
        }}
      >
        {/* Scrim */}
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(10, 13, 24, 0.55)",
            opacity: open ? 1 : 0,
            transition: "opacity 180ms ease"
          }}
        />
        {/* Sliding drawer — pulls in the desktop Sidebar content */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: "min(280px, 86vw)",
            background: "var(--panel-solid)",
            borderRight: "1px solid var(--border)",
            transform: open ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            overflowY: "auto",
            padding: "12px 14px 24px"
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
