import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
        >
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1f8bff" />
              <stop offset="55%" stopColor="#3a4dff" />
              <stop offset="100%" stopColor="#8b3dff" />
            </linearGradient>
          </defs>
          <path
            d="M 32 10 L 68 10 Q 92 14 92 50 Q 92 86 68 90 L 32 90 Q 8 86 8 50 Q 8 14 32 10 Z"
            fill="none"
            stroke="url(#g)"
            strokeWidth="11"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="38" cy="50" r="6.5" fill="#1f3bce" />
          <circle cx="62" cy="50" r="6.5" fill="#6b2dc9" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
