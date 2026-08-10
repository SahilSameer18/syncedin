"use client";

import Link from "next/link";

export function Wordmark({
  href = "/",
  darkText = true
}: {
  size?: "sm" | "md" | "lg" | "xl";
  href?: string | null;
  darkText?: boolean;
  width?: number;
  height?: number;
}) {
  const inner = (
    <div className="flex items-center gap-1.5 select-none">
      {/* Clean High-Impact Brand Title */}
      <span
        className={`text-2xl sm:text-3xl font-black tracking-tighter ${
          darkText ? "text-slate-900" : "text-white"
        } leading-none`}
      >
        Synced<span className={darkText ? "text-purple-600" : "text-purple-400"}>In</span>
      </span>
    </div>
  );

  if (!href) return inner;

  return (
    <Link
      href={href}
      aria-label="SyncedIn — home"
      className="inline-flex items-center select-none hover:opacity-95 transition-opacity"
    >
      {inner}
    </Link>
  );
}
