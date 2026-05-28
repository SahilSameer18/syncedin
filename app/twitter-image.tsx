/**
 * Twitter image route — serves the static JPG (same as opengraph).
 *
 * Previously this served the animated GIF. Switched to JPG because
 * LinkedIn's Post Inspector was rejecting the GIF-served-from-dynamic-
 * route as "No image found" even though iMessage / Slack / Discord
 * happily animated it. A static JPG is the most universally accepted
 * preview image type.
 *
 * Platforms that animate GIFs (iMessage, Slack, Discord, Telegram)
 * will still animate when the GIF is shared DIRECTLY at
 * /social/syncedin-preview.gif — we just stop offering it as the
 * canonical twitter:image. The video itself lives at
 * /social/syncedin-preview-small.mp4 for explicit linking.
 */

export const runtime = "edge";
export const alt =
  "SyncedIn — two twins finding the highest-leverage win-win between you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

export default async function TwitterImage(): Promise<Response> {
  const SITE_URL =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";
  const res = await fetch(`${SITE_URL}/social/syncedin-preview.jpg`, {
    next: { revalidate: 60 * 60 * 24 * 7 }
  });
  if (!res.ok) {
    return new Response(
      new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
      ]),
      { headers: { "content-type": "image/png" } }
    );
  }
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
    }
  });
}
