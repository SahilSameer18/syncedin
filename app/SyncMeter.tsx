import { computeSyncScore, type SyncInputs } from "@/lib/sync-score";

/**
 * Small (i) badge that shows the full Sync-score breakdown on hover.
 * CSS-only — no JS state, so it's safe to render inside a server component.
 */
function SyncInfoBadge({
  breakdown,
  nextStep
}: {
  breakdown: { label: string; points: number; max: number; done: boolean }[];
  nextStep: string | null;
}) {
  return (
    <span
      className="group"
      style={{ position: "relative", display: "inline-flex", marginLeft: 6 }}
    >
      <span
        aria-label="How Sync % works"
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px solid var(--border-bright)",
          color: "var(--text-dim)",
          fontSize: 10,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          background: "var(--panel)",
          fontFamily: "system-ui, sans-serif"
        }}
      >
        i
      </span>
      <span
        className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
        style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 280,
          padding: "12px 14px",
          background: "var(--panel-solid)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          fontSize: 11,
          lineHeight: 1.45,
          color: "var(--text)",
          zIndex: 30,
          boxShadow: "0 16px 36px -12px rgba(0,0,0,0.45)",
          textAlign: "left"
        }}
      >
        <strong style={{ display: "block", marginBottom: 6, fontSize: 12 }}>
          How Sync % works
        </strong>
        <div
          style={{
            color: "var(--text-dim)",
            marginBottom: 8,
            fontSize: 10.5,
            lineHeight: 1.5
          }}
        >
          The meter grows every time you give your twin more signal — new
          context, a finished conversation, a captured edit, a sealed deal.
          It caps at 99% on purpose (the last 1% is the north star).
        </div>
        <table
          style={{
            width: "100%",
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            fontSize: 10,
            borderCollapse: "collapse"
          }}
        >
          <tbody>
            {breakdown.map((p) => (
              <tr key={p.label}>
                <td
                  style={{
                    padding: "2px 0",
                    color: p.points > 0 ? "var(--text)" : "var(--text-dim)"
                  }}
                >
                  {p.label}
                </td>
                <td
                  style={{
                    padding: "2px 0",
                    textAlign: "right",
                    color:
                      p.points >= p.max
                        ? "var(--green)"
                        : p.points > 0
                        ? "var(--amber-bright)"
                        : "var(--text-dim)"
                  }}
                >
                  {p.points}/{p.max}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {nextStep && (
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid var(--border)",
              fontSize: 10.5,
              color: "var(--text-dim)"
            }}
          >
            <strong style={{ color: "var(--amber-bright)" }}>Next:</strong>{" "}
            {nextStep}
          </div>
        )}
      </span>
    </span>
  );
}

/**
 * SyncMeter v8 — variant X "clean caption".
 *
 * Uniform everyman silhouette: outlined head + outlined body + rainbow
 * gradient fill that rises from the feet up to the current sync level.
 * The percentage sits in a clean caption BELOW the body so nothing
 * overlays the silhouette. Reads well from nav-avatar (size 40) up to
 * dashboard size (240).
 *
 * The optional avatarUrl / userId props are kept for backward compat
 * with the v7 call signature but are no longer used — variant X uses a
 * plain outlined head circle to stay consistent with the icon-style of
 * the rest of the platform.
 */
export function SyncMeter({
  inputs,
  size = 240,
  // kept for backward-compat call sites; ignored in v8
  avatarUrl: _avatarUrl,
  userId: _userId
}: {
  inputs: SyncInputs;
  size?: number;
  avatarUrl?: string | null;
  userId?: string | null;
}) {
  const { total, parts, nextStep } = computeSyncScore(inputs);

  // Body spans y=50 (top of torso) to y=295 (feet bottom). Fill rises from
  // y=FILL_BOTTOM up to y=fillY where fillY = bottom - range * (pct/100).
  const FILL_TOP = 50;
  const FILL_BOTTOM = 295;
  const fillY = FILL_BOTTOM - (FILL_BOTTOM - FILL_TOP) * (total / 100);

  // Uniform-proportion human silhouette path (no head — head is a separate
  // circle). Shoulders 36 wide, waist 28, arms 10 wide, legs 14 wide.
  // Generated once; intentionally not parameterized — we want every render
  // identical down to the pixel for brand consistency.
  const bodyPath =
    "M 82 50 L 118 50 Q 132 52 138 64 L 138 168 Q 138 174 132 174 Q 126 174 126 168 L 126 78 L 124 86 Q 122 130 116 162 L 120 180 L 118 290 Q 118 295 113 295 Q 108 295 108 290 L 106 188 Q 100 184 94 188 L 92 290 Q 92 295 87 295 Q 82 295 82 290 L 80 180 L 84 162 Q 78 130 76 86 L 74 78 L 74 168 Q 74 174 68 174 Q 62 174 62 168 L 62 64 Q 68 52 82 50 Z";

  // viewBox: 200 wide × 340 tall (300 for body + 40 for caption underneath).
  const VB_W = 200;
  const VB_H = 340;

  // Outer container preserves aspect ratio at any `size`.
  const aspect = VB_H / VB_W;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size * aspect,
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
          <linearGradient
            id="syncRainbow"
            x1="0"
            y1={FILL_BOTTOM}
            x2="0"
            y2={FILL_TOP - 40}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="22%" stopColor="#3b82f6" />
            <stop offset="44%" stopColor="#22c55e" />
            <stop offset="66%" stopColor="#facc15" />
            <stop offset="86%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <clipPath id="syncBodyClip" clipPathUnits="userSpaceOnUse">
            <path d={bodyPath} />
          </clipPath>
        </defs>

        {/* Fill rises from the feet up to fillY. The unfilled portion above
            is left TRANSPARENT (no background rect) so the page surface
            shows through — important for dark mode, where the previous
            light-grey wash looked like a glaring opaque chest. */}
        <g clipPath="url(#syncBodyClip)">
          <rect
            x="0"
            y={fillY}
            width={VB_W}
            height={VB_H - fillY}
            fill="url(#syncRainbow)"
          />
        </g>

        {/* Head: simple outlined circle */}
        <circle
          cx="100"
          cy="24"
          r="18"
          fill="none"
          stroke="var(--text, #0a0d18)"
          strokeWidth="3"
        />

        {/* Body outline */}
        <path
          d={bodyPath}
          fill="none"
          stroke="var(--text, #0a0d18)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Caption — % SYNC, clean type below the body, never overlays */}
        <text
          x="100"
          y="325"
          textAnchor="middle"
          fill="var(--text, #0a0d18)"
          fontFamily='"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace'
          fontWeight={700}
          fontSize={20}
          letterSpacing="0.04em"
        >
          {total}%
          <tspan
            fill="var(--text-dim, #6c7385)"
            fontWeight={500}
            fontSize={13}
            dx="6"
            letterSpacing="0.24em"
          >
            SYNC
          </tspan>
        </text>
      </svg>

      {/* (i) hover badge — pinned to bottom-right of the meter box, next
          to the "% SYNC" caption. CSS-only tooltip with the full breakdown. */}
      <div
        style={{
          position: "absolute",
          right: "8%",
          bottom: 4,
          display: "flex",
          alignItems: "center"
        }}
      >
        <SyncInfoBadge breakdown={parts} nextStep={nextStep} />
      </div>
    </div>
  );
}
