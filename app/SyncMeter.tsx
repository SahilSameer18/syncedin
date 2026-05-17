import { computeSyncScore, type SyncInputs } from "@/lib/sync-score";

/**
 * SyncMeter v4 — gamified clone visual.
 *
 * Strictly symmetric silhouette: head circle on top, body trapezoid in the
 * middle, two arms as SEPARATE tubes hanging beside the body (visible gap,
 * no overlapping outlines), two legs with feet.
 *
 * Fill rises from the feet upward. Mapped exactly to body height so a 79%
 * fill stops at 79% of the body, not 79% of the viewBox. White readout in
 * the chest. Caps at 99 by design.
 */
export function SyncMeter({
  inputs,
  size = 240
}: {
  inputs: SyncInputs;
  size?: number;
}) {
  const { total } = computeSyncScore(inputs);
  // Fill is computed against the actual rendered silhouette range so 79%
  // visually looks like 79% of the body, not 79% of the viewBox.
  const FILL_TOP = 14; // head top
  const FILL_BOTTOM = 313; // foot bottom
  const fillY =
    FILL_BOTTOM - (FILL_BOTTOM - FILL_TOP) * (total / 100);

  // ── Geometry (all symmetric around x = 100) ───────────────────────────
  // Head
  const HEAD_CX = 100;
  const HEAD_CY = 38;
  const HEAD_R = 22;
  const headPath = `M ${HEAD_CX} ${HEAD_CY - HEAD_R} a ${HEAD_R} ${HEAD_R} 0 1 0 0.001 0 Z`;

  // Body trapezoid + legs. Symmetric around x=100. No overlap with arms.
  const bodyPath =
    // top edge of body (just under the head)
    "M 88 64 " +
    "L 112 64 " +
    // right shoulder corner (narrow shoulders, arms are separate)
    "L 118 80 " +
    // right side of torso going down toward waist
    "L 116 200 " +
    // right outer thigh
    "L 124 270 " +
    "L 122 305 " +
    // right foot
    "C 122 311 118 313 114 313 " +
    "C 110 313 108 311 108 305 " +
    // right inner thigh up to crotch
    "L 106 270 " +
    "L 102 200 " +
    // crotch flat
    "L 98 200 " +
    // left inner thigh down
    "L 94 270 " +
    "L 92 305 " +
    // left foot
    "C 92 311 88 313 84 313 " +
    "C 80 313 78 311 78 305 " +
    "L 76 270 " +
    // left outer thigh up to waist
    "L 84 200 " +
    // left side of torso up
    "L 82 80 " +
    // back to neck-left
    "L 88 64 " +
    "Z";

  // Arms — separate tubes hanging beside the body with a visible gap.
  const leftArm =
    "M 60 80 " +
    "L 60 192 " +
    "C 58 202 60 212 68 212 " +
    "C 76 212 78 202 78 192 " +
    "L 78 80 " +
    "Z";
  const rightArm =
    "M 140 80 " +
    "L 140 192 " +
    "C 142 202 140 212 132 212 " +
    "C 124 212 122 202 122 192 " +
    "L 122 80 " +
    "Z";

  // Combined silhouette for the clip + outline (multiple subpaths in one d).
  const silhouette = `${headPath} ${bodyPath} ${leftArm} ${rightArm}`;

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

        {/* Inside-body desaturated base (the "unfilled" portion). */}
        <g clipPath="url(#syncBodyClip)">
          <rect x="0" y="0" width="200" height="320" fill="#eceef5" />
          {/* Rainbow rising from the feet, strictly inside the silhouette. */}
          <rect
            x="0"
            y={fillY}
            width="200"
            height={320 - fillY}
            fill="url(#syncRainbow)"
          />
        </g>

        {/* Crisp black outline (each subpath gets its own stroke). */}
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

      {/* % readout — white text for legibility on the rainbow */}
      <div
        style={{
          position: "absolute",
          top: "44%",
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
