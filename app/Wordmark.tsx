/**
 * SyncedIn wordmark — real logo PNG from /public, big and unmissable.
 *
 * Sizes (matched to header rhythm):
 *   sm: 32px   — inline body text, badges
 *   md: 60px   — sidebar / sub-page headers
 *   lg: 96px   — main dashboard / landing
 *   xl: 144px  — hero
 */
export function Wordmark({
  size = "lg"
}: {
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const h =
    size === "xl" ? 144 : size === "lg" ? 96 : size === "sm" ? 32 : 60;
  return (
    <span
      className="inline-flex items-center select-none"
      style={{ height: h }}
    >
      <img
        src="/syncedin-wordmark.png"
        alt="SyncedIn"
        height={h}
        style={{
          height: h,
          width: "auto",
          display: "block"
        }}
      />
    </span>
  );
}
