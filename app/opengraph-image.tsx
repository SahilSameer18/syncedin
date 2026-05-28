/**
 * OG image route — serves the static JPG extracted from Jack's
 * uploaded hero video (see /public/social/syncedin-preview.jpg).
 *
 * History: this file used to ImageResponse-render a card. The auto-
 * routed file convention overrides metadata.openGraph.images in
 * layout.tsx, so the ONLY way to put the new image at the canonical
 * `/opengraph-image` URL is to make THIS file return its bytes.
 *
 * For the GIF/animated version see app/twitter-image.tsx (Twitter
 * animates GIFs inside preview cards; LinkedIn / WhatsApp don't).
 */

export const runtime = "edge";
export const alt =
  "SyncedIn — two twins finding the highest-leverage win-win between you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

export default async function OG(): Promise<Response> {
  const SITE_URL =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";
  const res = await fetch(`${SITE_URL}/social/syncedin-preview.jpg`, {
    next: { revalidate: 60 * 60 * 24 * 7 }
  });
  if (!res.ok) {
    // 1×1 transparent PNG fallback so og:image is never broken.
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
