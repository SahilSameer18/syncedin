import { computeSyncScore, type SyncInputs } from "@/lib/sync-score";

/**
 * SyncMeter v5 — gamified clone visual.
 *
 * Single continuous silhouette (head + body + arms + legs as one outline,
 * arms are part of the body outline so there are no overlapping internal
 * lines). Strictly symmetric around the center axis. White % readout in
 * the chest area. Rainbow fill rises from the feet upward, mapped to the
 * actual body height so 79% really looks like 79%.
 */
export function SyncMeter({
  inputs,
  size = 240
}: {
  inputs: SyncInputs;
  size?: number;
}) {
  const { total } = computeSyncScore(inputs);
  const FILL_TOP = 16; // very top of head
  const FILL_BOTTOM = 313; // foot bottom
  const fillY =
    FILL_BOTTOM - (FILL_BOTTOM - FILL_TOP) * (total / 100);

  // ── Head: a separate circle ────────────────────────────────────────────
  const HEAD_CX = 100;
  const HEAD_CY = 38;
  const HEAD_R = 22;
  const headPath = `M ${HEAD_CX} ${HEAD_CY - HEAD_R} a ${HEAD_R} ${HEAD_R} 0 1 0 0.001 0 Z`;

  // ── Body + arms + legs as ONE continuous outline ──────────────────────
  // Traced clockwise from the neck-left bottom. Arms are integrated into
  // the outline (down outer, around hand, up inner, into armpit, down
  // torso), so there are no double lines anywhere.
  const bodyPath = [
    // neck top
    "M 88 64",
    "L 112 64",
    // right shoulder slope outward to outer arm top
    "C 128 66 138 72 142 80",
    // outer right arm DOWN
    "L 142 188",
    // right hand (rounded bottom)
    "C 144 202 142 212 132 212",
    "C 122 212 120 202 122 188",
    // inner right arm UP toward armpit
    "L 122 88",
    // armpit: curve inward into the torso side
    "C 122 84 118 86 114 92",
    // right side of torso DOWN
    "L 112 200",
    // right outer thigh outward + down
    "L 122 270",
    "L 124 305",
    // right foot
    "C 124 311 120 313 116 313",
    "C 112 313 110 311 110 305",
    // right inner thigh UP to crotch
    "L 108 270",
    "L 102 200",
    // crotch (flat)
    "L 98 200",
    // left inner thigh DOWN
    "L 92 270",
    "L 90 305",
    // left foot
    "C 90 311 86 313 82 313",
    "C 78 313 76 311 76 305",
    // left outer thigh UP
    "L 78 270",
    "L 88 200",
    // left side of torso UP to armpit
    "L 86 92",
    // left armpit: curve outward into inner arm
    "C 82 86 78 84 78 88",
    // inner left arm DOWN
    "L 78 188",
    // left hand (rounded)
    "C 80 202 78 212 68 212",
    "C 58 212 56 202 58 188",
    // outer left arm UP
    "L 58 80",
    // left shoulder slope back to neck
    "C 62 72 72 66 88 64",
    "Z"
  ].join(" ");

  const silhouette = `${headPath} ${bodyPath}`;

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
          <clipPath
            id="syncBodyClip"
            clipPathUnits="userSpaceOnUse"
          >
            <path d={silhouette} fillRule="evenodd" />
          </clipPath>
        </defs>

        {/* Unfilled base */}
        <g clipPath="url(#syncBodyClip)">
          <rect x="0" y="0" width="200" height="320" fill="#eceef5" />
          <rect
            x="0"
            y={fillY}
            width="200"
            height={320 - fillY}
            fill="url(#syncRainbow)"
          />
        </g>

        {/* Crisp outline */}
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

      {/* % readout — chest height, white text */}
      <div
        style={{
          position: "absolute",
          top: "35%",
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
            fontSize: size * 0.13,
            lineHeight: 1,
            color: "#ffffff",
            textShadow:
              "0 1px 2px rgba(0,0,0,0.45), 0 0 14px rgba(0,0,0,0.35)"
          }}
        >
          {total}%
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: Math.max(9, size * 0.042),
            letterSpacing: "0.22em",
            fontWeight: 700,
            color: "#ffffff",
            textShadow:
              "0 1px 2px rgba(0,0,0,0.5), 0 0 10px rgba(0,0,0,0.35)",
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
