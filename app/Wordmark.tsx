/**
 * SyncedIn wordmark — uses the real logo PNG from /public.
 */
export function Wordmark({
  size = "md"
}: {
  size?: "sm" | "md" | "lg";
}) {
  const h = size === "lg" ? 56 : size === "sm" ? 24 : 36;
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
