/**
 * SyncedIn wordmark — real logo PNG from /public.
 *
 * Sizes (raw heights so the wordmark really pops in headers):
 *   sm: 40px
 *   md: 80px
 *   lg: 140px
 *   xl: 200px
 */
export function Wordmark({
  size = "lg"
}: {
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const h =
    size === "xl" ? 200 : size === "lg" ? 140 : size === "sm" ? 40 : 80;
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
