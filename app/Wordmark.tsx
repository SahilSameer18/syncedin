import Link from "next/link";

/**
 * SyncedIn wordmark — real logo PNG from /public.
 *
 * Sizes (raw heights so the wordmark really pops in headers):
 *   sm: 40px
 *   md: 80px
 *   lg: 140px
 *   xl: 200px
 *
 * Always clickable — by default routes to "/", which redirects signed-in
 * users to /dashboard and shows the marketing home to signed-out users.
 * Pass `href={null}` to render a non-clickable mark (e.g. on the home page
 * itself, where it's already the destination).
 */
export function Wordmark({
  size = "lg",
  href = "/"
}: {
  size?: "sm" | "md" | "lg" | "xl";
  href?: string | null;
}) {
  const h =
    size === "xl" ? 200 : size === "lg" ? 140 : size === "sm" ? 40 : 80;

  const inner = (
    <img
      src="/syncedin-wordmark.png"
      alt="SyncedIn"
      height={h}
      // wordmark-themed: lets globals.css invert the PNG in dark mode so
      // the wordmark stays readable on dark surfaces. Without this class
      // the dark text in the PNG vanishes against a dark background —
      // exactly the bug Jack reported on the /[slug] custom-invite page.
      className="wordmark-themed"
      style={{
        height: h,
        width: "auto",
        display: "block"
      }}
    />
  );

  const wrap = (
    <span
      className="inline-flex items-center select-none"
      style={{ height: h }}
    >
      {inner}
    </span>
  );

  if (!href) return wrap;

  return (
    <Link
      href={href}
      aria-label="SyncedIn — home"
      className="inline-flex items-center select-none"
      style={{ height: h }}
    >
      {inner}
    </Link>
  );
}
