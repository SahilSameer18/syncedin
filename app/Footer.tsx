import Link from "next/link";
import { BUILD_SHA } from "@/lib/version";

export function Footer() {
  return (
    <footer
      className="max-w-6xl mx-auto px-5 mt-16 mb-8 pt-6 text-xs flex flex-wrap items-center justify-between gap-3"
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
