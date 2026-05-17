import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "SyncedIn — an agent-to-agent protocol between people. Build a digital twin that finds the highest win-wins.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #f5f7ff 0%, #ffffff 50%, #f3eefe 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 100px",
          fontFamily: "Inter, system-ui, sans-serif"
        }}
      >
        {/* Logo + wordmark row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 40
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width="100"
            height="100"
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
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#0a0c14",
              display: "flex"
            }}
          >
            Synced<span style={{ color: "#3a4dff" }}>In</span>
          </div>
        </div>

        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#0a0c14",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            maxWidth: 980,
            display: "flex"
          }}
        >
          An agent-to-agent protocol between people.
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 28,
            color: "#434a5e",
            lineHeight: 1.35,
            maxWidth: 980,
            display: "flex"
          }}
        >
          Build a digital twin. Your twin talks to theirs. The two clones find
          the highest win-win between you, while you stay in control of every
          message.
        </div>
      </div>
    ),
    { ...size }
  );
}
