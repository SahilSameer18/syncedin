import { computeSyncScore, type SyncInputs } from "@/lib/sync-score";

/**
 * SyncMeter v3 — gamified clone visual.
 *
 * Clean human silhouette. Rainbow fills the body INSIDE the outline only,
 * rising from the feet up as your Sync % climbs. A soft outer glow brightens
 * with progress.
 *
 * Caps at 99 — the last 1% is on purpose.
 */
export function SyncMeter({
  inputs,
  size = 240
}: {
  inputs: SyncInputs;
  size?: number;
}) {
  const { total } = computeSyncScore(inputs);
  const fillPct = Math.round((total / 99) * 100);

  // Silhouette: head circle + body path, viewBox 200x320.
  const HEAD_CX = 100;
  const HEAD_CY = 36;
  const HEAD_R = 22;
  const BODY =
    "M 78 64 " +
    "L 122 64 " +
    "L 138 76 " +
    "L 156 124 " +
    "C 158 134 152 140 144 138 " +
    "L 138 130 " +
    "L 130 124 " +
    "L 134 116 " +
    "L 128 100 " +
    "L 128 142 " +
    "L 134 192 " +
    "L 130 244 " +
    "L 124 292 " +
    "L 124 304 " +
    "C 124 308 120 310 116 310 " +
    "C 112 310 110 308 110 304 " +
    "L 108 244 " +
    "L 104 192 " +
    "L 96 192 " +
    "L 92 244 " +
    "L 90 304 " +
    "C 90 308 86 310 82 310 " +
    "C 78 310 76 308 76 304 " +
    "L 76 292 " +
    "L 70 244 " +
    "L 66 192 " +
    "L 72 142 " +
    "L 72 100 " +
    "L 66 116 " +
    "L 70 124 " +
    "L 62 130 " +
    "L 56 138 " +
    "C 48 140 42 134 44 124 " +
    "L 62 76 " +
    "L 78 64 " +
    "Z";
  const HEAD = `M ${HEAD_CX} ${HEAD_CY - HEAD_R} a ${HEAD_R} ${HEAD_R} 0 1 0 0.001 0 Z`;
  const silhouette = `${HEAD} ${BODY}`;

  // Rainbow fill rises from the feet (y=320) upward to fillY.
  const fillY = 320 - (320 * fillPct) / 100;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size * 1.4,
        filter: `drop-shadow(0 0 ${10 + (total / 99) * 26}px rgba(120, 60, 220, 0.32))`
      }}
    >
      <svg
        viewBox="0 0 200 320"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="syncRainbow" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#9b3dff" />
            <stop offset="14%" stopColor="#3aa8ff" />
            <stop offset="34%" stopColor="#3cd870" />
            <stop offset="54%" stopColor="#ffe14d" />
            <stop offset="74%" stopColor="#ff8a3d" />
            <stop offset="90%" stopColor="#ff4d6d" />
            <stop offset="100%" stopColor="#ff77ee" />
          </linearGradient>
          <clipPath id="syncBodyClip" clipPathUnits="userSpaceOnUse">
            <path d={silhouette} fillRule="evenodd" />
          </clipPath>
        </defs>

        {/* Inside-body desaturated base — the "empty" part of the meter. */}
        <g clipPath="url(#syncBodyClip)">
          <rect x="0" y="0" width="200" height="320" fill="#eceef5" />
          {/* Rainbow rising from feet up. Strictly inside the silhouette. */}
          <rect
            x="0"
            y={fillY}
            width="200"
            height={320 - fillY}
            fill="url(#syncRainbow)"
          />
        </g>

        {/* Crisp body outline */}
        <path
          d={silhouette}
          fill="none"
          stroke="#0a0d18"
          strokeWidth="2.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          fillRule="evenodd"
        />
      </svg>

      {/* % readout floats centered on chest */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: 0,
          right: 0,
          textAlign: "center",
          pointerEvents: "none"
        }}
      >
        <div
          style={{
            fontFamily:
              '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
            fontWeight: 800,
            fontSize: size * 0.18,
            lineHeight: 1,
            color: "#0a0d18",
            textShadow: "0 0 12px rgba(255,255,255,0.9)"
          }}
        >
          {total}%
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            letterSpacing: "0.22em",
            fontWeight: 700,
            color: "#0a0d18",
            textShadow: "0 0 8px rgba(255,255,255,0.9)",
            fontFamily:
              '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace'
          }}
        >
          SYNC
        </div>
      </div>
    </div>
  );
}
