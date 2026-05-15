import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#080a12",
          color: "#2f6bff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 900,
          fontFamily:
            "ui-monospace, 'SF Mono', Menlo, monospace"
        }}
      >
        ◎
      </div>
    ),
    { ...size }
  );
}
