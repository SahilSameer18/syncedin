"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BUILD_SHA } from "@/lib/version";

// Routes where the footer creates an awkward dead band — chat surfaces
// where the user's expectation is "this fills the viewport, not a
// scrollable marketing column with a footer band at the bottom". On
// these routes the footer renders nothing. Everywhere else (landing,
// dashboard, invite pages) it shows as before.
const HIDE_ON: Array<string | RegExp> = [
  /^\/conversations(?:\/|$)/,
  /^\/messages(?:\/|$)/,
  /^\/admin(?:\/|$)/
];

function shouldHide(path: string): boolean {
  return HIDE_ON.some((p) =>
    typeof p === "string" ? path === p : p.test(path)
  );
}

export function Footer() {
  const path = usePathname() || "";
  if (shouldHide(path)) return null;
  return (
    <footer
      // mt-16 → mt-8 cuts the cavernous gap users were seeing on shorter
      // pages. mb-8 stays — keeps the footer from clinging to the
      // viewport bottom.
      className="max-w-6xl mx-auto px-5 mt-8 mb-8 pt-6 text-xs flex flex-wrap items-center justify-between gap-3"
      style={{
        color: "var(--text-dim)",
        borderTop: "1px solid var(--border)"
      }}
    >
      <div className="font-mono">
        SyncedIn · build{" "}
        <span style={{ color: "var(--amber-bright)" }}>{BUILD_SHA}</span>
      </div>
      <nav className="flex items-center gap-4">
        <Link href="/hypernetwork" className="hover:text-white">
          Hypernetwork
        </Link>
        <Link href="/feedback" className="hover:text-white">
          Feedback
        </Link>
        <Link href="/privacy" className="hover:text-white">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-white">
          Terms
        </Link>
        <Link href="/support" className="hover:text-white">
          Support
        </Link>
        <a
          href="mailto:jacksonjezio@gmail.com"
          className="hover:text-white"
        >
          Contact
        </a>
      </nav>
    </footer>
  );
}
