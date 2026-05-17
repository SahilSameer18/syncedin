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
  // Body silhouette: arms hang DOWN by the sides with rounded hands,
  // torso tapers from shoulders to waist, two legs with feet.
  const BODY =
    // ── Neck + right shoulder slope
    "M 92 64 " +
    "L 108 64 " +
    "C 120 68 132 74 138 84 " +
    "C 142 90 144 98 142 108 " +
    // ── Outer right arm down
    "L 142 184 " +
    // ── Right hand (rounded)
    "C 142 194 140 200 132 200 " +
    "C 124 200 122 194 122 184 " +
    // ── Inner right arm back up to armpit
    "L 124 108 " +
    "C 124 98 122 92 118 88 " +
    // ── Right side of torso down to hip
    "L 122 140 " +
    "L 126 200 " +
    // ── Outer right leg down
    "L 124 268 " +
    "L 122 304 " +
    // ── Right foot
    "C 122 310 118 312 114 312 " +
    "C 110 312 108 310 108 304 " +
    // ── Inner right leg up
    "L 106 268 " +
    "L 102 200 " +
    // ── Crotch
    "L 98 200 " +
    // ── Inner left leg down
    "L 94 268 " +
    "L 92 304 " +
    // ── Left foot
    "C 92 310 88 312 84 312 " +
    "C 80 312 76 310 76 304 " +
    // ── Outer left leg up
    "L 74 268 " +
    "L 78 200 " +
    // ── Left side of torso up
    "L 78 140 " +
    "L 82 88 " +
    "C 78 92 76 98 76 108 " +
    // ── Inner left arm down
    "L 78 184 " +
    // ── Left hand (rounded)
    "C 78 194 76 200 68 200 " +
    "C 60 200 58 194 58 184 " +
    // ── Outer left arm back up to shoulder
    "L 58 108 " +
    "C 56 98 58 90 62 84 " +
    "C 68 74 80 68 92 64 " +
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

      {/* % readout floats centered on chest — kept compact so it fits inside the torso */}
      <div
        style={{
          position: "absolute",
          top: "38%",
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
            fontSize: size * 0.11,
            lineHeight: 1,
            color: "#0a0d18",
            textShadow: "0 0 10px rgba(255,255,255,0.9)"
          }}
        >
          {total}%
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: Math.max(8, size * 0.038),
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: "#0a0d18",
            textShadow: "0 0 6px rgba(255,255,255,0.9)",
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
