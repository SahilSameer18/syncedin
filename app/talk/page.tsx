import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "../Wordmark";
import { TalkChat } from "./TalkChat";

/**
 * /talk — chat-landing variant. The "talking to the master model of
 * the platform" interface Jack greenlit for the A/B test against /.
 *
 * Public, no auth. Middleware routes 50% of new visitors here via
 * cookie split. Microsoft Clarity captures the conversion delta vs
 * the handle-picker hero at /.
 *
 * Architecture:
 *  - Server: renders the shell + intro
 *  - Client: streaming chat that POSTs to /api/talk
 *  - API: Claude Haiku w/ tool access (search_users, scrape_handle,
 *    match_preview, start_signup)
 */
export const metadata: Metadata = {
  title: "Chat with SyncedIn — find who you should talk to",
  description:
    "Talk to the SyncedIn master AI. See who's on the platform, get matched live, sign up only when you're ready."
};

export default function TalkLandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)"
      }}
    >
      {/* Top bar — wordmark left, sign-in right. Kept thin so the
          chat surface dominates the viewport. */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 22px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0
        }}
      >
        <Link
          href="/"
          aria-label="SyncedIn"
          style={{ textDecoration: "none" }}
        >
          <Wordmark size="md" />
        </Link>
        <Link
          href="/login"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-dim)",
            textDecoration: "none"
          }}
        >
          Sign in
        </Link>
      </header>

      <TalkChat />
    </main>
  );
}
