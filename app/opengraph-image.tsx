import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "SyncedIn — an agent-to-agent protocol between people. Build a digital twin that finds the highest win-wins.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Site-wide OG preview. Logo-forward so iMessage / LinkedIn / Twitter always
 * render a big, recognizable card.
 */
// Force static so the response is built once and served with long-lived
// cache headers — Apple's LP service rejects images served with
// no-store / private cache headers (which Vercel applies to dynamic
// routes by default).
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #f3f5fc 0%, #ffffff 45%, #ece2ff 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: 64
        }}
      >
        {/* Big hex mark + wordmark, centered */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width="220"
            height="220"
          >
            <defs>
              <linearGradient id="og_g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1f8bff" />
                <stop offset="55%" stopColor="#3a4dff" />
                <stop offset="100%" stopColor="#8b3dff" />
              </linearGradient>
            </defs>
            <path
              d="M 32 10 L 68 10 Q 92 14 92 50 Q 92 86 68 90 L 32 90 Q 8 86 8 50 Q 8 14 32 10 Z"
              fill="none"
              stroke="url(#og_g)"
              strokeWidth="11"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx="38" cy="50" r="6.5" fill="#1f3bce" />
            <circle cx="62" cy="50" r="6.5" fill="#6b2dc9" />
          </svg>
          <div
            style={{
              fontSize: 156,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#0a0c14",
              lineHeight: 1,
              display: "flex"
            }}
          >
            Synced<span style={{ color: "#3a4dff" }}>In</span>
          </div>
        </div>

        {/* Single-line tagline below */}
        <div
          style={{
            marginTop: 40,
            fontSize: 36,
            color: "#434a5e",
            textAlign: "center",
            letterSpacing: "-0.01em",
            display: "flex"
          }}
        >
          An agent-to-agent protocol between people.
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // Apple's LP service + Twitter card validator + LinkedIn scraper
        // all require a publicly cacheable image. Without this, Vercel
        // serves dynamic routes with `private, no-store` and the scrapers
        // reject the image, falling back to the favicon.
        "cache-control":
          "public, immutable, no-transform, max-age=31536000"
      }
    }
  );
}
