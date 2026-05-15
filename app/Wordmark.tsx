/**
 * SyncedIn wordmark. CSS-only so it renders even before the logo image is
 * dropped in. If /logo.png exists it's used as the icon; otherwise a small
 * monospace glyph block stands in.
 */
export function Wordmark({
  size = "md"
}: {
  size?: "sm" | "md" | "lg";
}) {
  const text =
    size === "lg"
      ? "text-3xl"
      : size === "sm"
      ? "text-sm"
      : "text-lg";
  const box =
    size === "lg" ? "w-9 h-9" : size === "sm" ? "w-5 h-5" : "w-7 h-7";

  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span
        className={`${box} grid place-items-center retro-panel`}
        style={{ borderColor: "var(--amber)", color: "var(--amber)" }}
        aria-hidden
      >
        <span style={{ fontSize: size === "lg" ? 18 : 12, fontWeight: 700 }}>
          ◎
        </span>
      </span>
      <span className={`${text} font-bold tracking-tight`}>
        Synced<span className="retro-amber">In</span>
      </span>
    </span>
  );
}
