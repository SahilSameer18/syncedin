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
          padding: "4px 10px",
          gap: 10,
          minHeight: 84
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open menu"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: "1px solid var(--border-bright)",
            background: "transparent",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // line-height:1 + matching font-size makes the glyph render
            // optically centered in the box (default line-height was
            // pushing the ☰ glyph slightly above center).
            lineHeight: 1,
            cursor: "pointer",
            color: "var(--text)",
            fontSize: 20,
            flexShrink: 0,
            // Equal padding on all sides so the SVG glyph sits dead
            // center regardless of font-metric quirks.
            padding: 0
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
            height: 72,
            textDecoration: "none",
            flexShrink: 0
          }}
        >
          {/* Wordmark at 72px — Jack's third request for 3x size.
              Original was ~22px so 72 is just over 3x. Mobile bar
              minHeight is 84 so the wordmark has breathing room without
              being clipped. wordmark-themed handles dark-mode invert. */}
          <img
            src="/syncedin-wordmark.png"
            alt="SyncedIn"
            className="wordmark-themed"
            height={72}
            style={{ height: 72, width: "auto", display: "block" }}
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
        {/* Sliding drawer — pulls in the desktop Sidebar content.
            The wordmark + its big top padding inside the Sidebar are
            HIDDEN here because the mobile top bar already shows the
            wordmark; rendering it again wasted ~140px of drawer height
            and pushed every nav item far down. CSS-scoped to the drawer
            via the class below so the desktop sidebar is unaffected. */}
        <div
          className="syncedin-mobile-drawer"
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
            // Padding halved per Jack's third request — the drawer used
            // to have a visible empty band above the nav list. 0 top, 6
            // sides, 12 bottom is the tightest comfortable spec.
            padding: "0 6px 12px"
          }}
        >
          {children}
        </div>
        <style>{`
          .syncedin-mobile-drawer img.wordmark-themed {
            display: none;
          }
          /* Kill the wordmark Link, all sidebar padding, and first-child
             margins. Drawer should open with nav items immediately at the
             top — no empty band, no logo space reservation. Jack flagged
             this empty padding multiple times. */
          .syncedin-mobile-drawer > div > a[aria-label="SyncedIn — home"] {
            display: none;
          }
          .syncedin-mobile-drawer > div {
            padding-top: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin-top: 0 !important;
          }
          .syncedin-mobile-drawer > div > *:first-child,
          .syncedin-mobile-drawer > div > *:first-child > * {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
        `}</style>
      </div>
    </>
  );
}
