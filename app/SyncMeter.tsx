import { computeSyncScore, type SyncInputs } from "@/lib/sync-score";

/**
 * SyncMeter v6 — clean human silhouette, perfectly symmetric.
 *
 * Single continuous outline. Arms hang at the sides with a curved armpit
 * transition into the torso. Legs are mirror-symmetric with the same
 * width. Rainbow fill rises from feet up, mapped to actual body height
 * so 79% = 79% of the body. The % readout lives strictly inside the
 * chest area between the arms (centered, narrow width) so it never
 * crosses the arm outlines.
 */
export function SyncMeter({
  inputs,
  size = 240
}: {
  inputs: SyncInputs;
  size?: number;
}) {
  const { total } = computeSyncScore(inputs);
  const FILL_TOP = 16;
  const FILL_BOTTOM = 313;
  const fillY = FILL_BOTTOM - (FILL_BOTTOM - FILL_TOP) * (total / 100);

  // Head is a separate circle on top
  const HEAD_CX = 100;
  const HEAD_CY = 40;
  const HEAD_R = 22;
  const headPath = `M ${HEAD_CX} ${HEAD_CY - HEAD_R} a ${HEAD_R} ${HEAD_R} 0 1 0 0.001 0 Z`;

  // Body + arms + legs as one continuous symmetric outline.
  // Tracing clockwise from neck-left bottom.
  const bodyPath = [
    "M 88 66",
    "L 112 66",
    // right shoulder slope
    "C 124 68 132 74 138 82",
    // outer top of right arm
    "C 144 82 148 86 148 96",
    // outer right arm DOWN
    "L 148 198",
    // right hand
    "C 148 210 144 214 138 214",
    "C 132 214 128 210 128 198",
    // inner right arm UP
    "L 128 96",
    // right armpit (curve into torso)
    "C 128 102 124 108 116 112",
    // right side of torso DOWN
    "L 116 200",
    // right hip outward
    "L 120 215",
    // outer right leg DOWN
    "L 118 305",
    // right foot
    "C 118 311 114 313 110 313",
    "C 106 313 104 311 104 305",
    // inner right leg UP to crotch
    "L 104 215",
    // crotch V
    "C 102 209 98 209 96 215",
    // inner left leg DOWN
    "L 96 305",
    // left foot
    "C 96 311 92 313 88 313",
    "C 84 313 82 311 82 305",
    // outer left leg UP
    "L 80 215",
    // left hip inward
    "L 84 200",
    // left side of torso UP
    "L 84 112",
    // left armpit
    "C 76 108 72 102 72 96",
    // inner left arm DOWN
    "L 72 198",
    // left hand
    "C 72 210 68 214 62 214",
    "C 56 214 52 210 52 198",
    // outer left arm UP
    "L 52 96",
    // outer top of left arm
    "C 52 86 56 82 62 82",
    // left shoulder slope back to neck
    "C 68 74 76 68 88 66",
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
          <clipPath id="syncBodyClip" clipPathUnits="userSpaceOnUse">
            <path d={silhouette} fillRule="evenodd" />
          </clipPath>
        </defs>

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

      {/* % readout — chest-only, narrow so it never crosses the arm outlines.
          Chest spans roughly viewBox x=84-116 (32 wide of 200 total = 16%).
          We give it ~28% of the container width centered, with extra
          breathing room. */}
      <div
        style={{
          position: "absolute",
          top: "39%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "28%",
          textAlign: "center",
          pointerEvents: "none"
        }}
      >
        <div
          style={{
            fontFamily:
              '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
            fontWeight: 800,
            fontSize: size * 0.115,
            lineHeight: 1,
            color: "#ffffff",
            textShadow:
              "0 1px 2px rgba(0,0,0,0.5), 0 0 14px rgba(0,0,0,0.35)"
          }}
        >
          {total}%
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: Math.max(8, size * 0.034),
            letterSpacing: "0.22em",
            fontWeight: 700,
            color: "#ffffff",
            textShadow:
              "0 1px 2px rgba(0,0,0,0.55), 0 0 10px rgba(0,0,0,0.35)",
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
