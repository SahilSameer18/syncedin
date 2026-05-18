import { computeSyncScore, type SyncInputs } from "@/lib/sync-score";

/**
 * SyncMeter v7 — combined "profile-head + outside %" (variants C × F).
 *
 * The head is replaced by the user's avatar circle (or a gradient initials
 * disc if no avatar). The body is a filled rainbow silhouette. The %
 * readout lives OUTSIDE the body to the right, so it never fights the
 * silhouette for visual weight and we can use a bigger, cleaner number.
 */

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarGradient(seed: string): [string, string] {
  const palettes: Array<[string, string]> = [
    ["#3a4dff", "#8b3dff"],
    ["#1f8bff", "#3a4dff"],
    ["#5ee5b2", "#1f8bff"],
    ["#a060ff", "#ff77ee"]
  ];
  return palettes[hashCode(seed) % palettes.length];
}

export function SyncMeter({
  inputs,
  size = 240,
  avatarUrl,
  userId
}: {
  inputs: SyncInputs;
  size?: number;
  avatarUrl?: string | null;
  userId?: string | null;
}) {
  const { total } = computeSyncScore(inputs);
  const name = inputs.name ?? "";
  const [gA, gB] = avatarGradient(userId || name || "x");
  const ini = initials(name);

  // Body silhouette (no head — head is the avatar above)
  const FILL_TOP = 78;
  const FILL_BOTTOM = 313;
  const fillY =
    FILL_BOTTOM - (FILL_BOTTOM - FILL_TOP) * (total / 100);

  const bodyPath = [
    // shoulders/neck base
    "M 88 78",
    "L 112 78",
    "C 124 80 132 84 138 92",
    "C 142 92 144 96 144 104",
    "L 144 232",
    "C 144 240 142 244 138 244",
    "C 134 244 132 240 132 232",
    "L 132 104",
    "C 132 110 128 114 126 120",
    "C 126 150 122 178 116 200",
    "L 120 215",
    "L 118 305",
    "C 118 311 114 313 110 313",
    "C 106 313 104 311 104 305",
    "L 104 215",
    "C 102 209 98 209 96 215",
    "L 96 305",
    "C 96 311 92 313 88 313",
    "C 84 313 82 311 82 305",
    "L 80 215",
    "L 84 200",
    "C 78 178 74 150 74 120",
    "C 72 114 68 110 68 104",
    "L 68 232",
    "C 68 240 66 244 62 244",
    "C 58 244 56 240 56 232",
    "L 56 104",
    "C 56 96 58 92 62 92",
    "C 68 84 76 80 88 78",
    "Z"
  ].join(" ");

  // SVG viewBox is wider than tall now (we add right column for % readout).
  // Body: x=40..160, head circle above it.
  // Right column: x=180..320 for % + SYNC label.
  const VB_W = 320;
  const VB_H = 360;

  const headCx = 100;
  const headCy = 44;
  const headR = 30;

  return (
    <div
      style={{
        position: "relative",
        width: size * 1.35,
        height: size * 1.6,
        filter: `drop-shadow(0 0 ${10 + (total / 99) * 26}px rgba(120, 60, 220, 0.32))`
      }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
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
          <linearGradient id="avatarBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gA} />
            <stop offset="100%" stopColor={gB} />
          </linearGradient>
          <clipPath id="syncBodyClip" clipPathUnits="userSpaceOnUse">
            <path d={bodyPath} fillRule="evenodd" />
          </clipPath>
          <clipPath id="avatarClip" clipPathUnits="userSpaceOnUse">
            <circle cx={headCx} cy={headCy} r={headR} />
          </clipPath>
        </defs>

        {/* Body — filled rainbow under a thin outline */}
        <g clipPath="url(#syncBodyClip)">
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="#eceef5" />
          <rect
            x="0"
            y={fillY}
            width={VB_W}
            height={VB_H - fillY}
            fill="url(#syncRainbow)"
          />
        </g>
        <path
          d={bodyPath}
          fill="none"
          stroke="#0a0d18"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* Avatar head — circle, with image or initials */}
        <circle
          cx={headCx}
          cy={headCy}
          r={headR + 2}
          fill="#0a0d18"
          opacity="0.18"
        />
        {avatarUrl ? (
          <image
            href={avatarUrl}
            x={headCx - headR}
            y={headCy - headR}
            width={headR * 2}
            height={headR * 2}
            clipPath="url(#avatarClip)"
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <>
            <circle cx={headCx} cy={headCy} r={headR} fill="url(#avatarBg)" />
            <text
              x={headCx}
              y={headCy + 8}
              textAnchor="middle"
              fill="#ffffff"
              fontFamily='"IBM Plex Mono", ui-monospace, monospace'
              fontWeight={700}
              fontSize={headR * 0.85}
              letterSpacing="0.02em"
            >
              {ini}
            </text>
          </>
        )}
        {/* head outline */}
        <circle
          cx={headCx}
          cy={headCy}
          r={headR}
          fill="none"
          stroke="#0a0d18"
          strokeWidth="2"
          opacity="0.55"
        />

        {/* Right-side % readout (outside the body) */}
        <text
          x={235}
          y={195}
          textAnchor="start"
          fontFamily='"IBM Plex Mono", ui-monospace, monospace'
          fontWeight={800}
          fontSize={56}
          fill="var(--text, #0a0d18)"
        >
          {total}%
        </text>
        <text
          x={236}
          y={218}
          textAnchor="start"
          fontFamily='"IBM Plex Mono", ui-monospace, monospace'
          fontWeight={700}
          fontSize={14}
          letterSpacing="0.32em"
          fill="var(--text-dim, #6c7385)"
        >
          SYNC
        </text>
      </svg>
    </div>
  );
}
