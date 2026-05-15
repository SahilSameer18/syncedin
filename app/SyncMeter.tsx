import fs from "fs";
import path from "path";
import { computeSyncScore, type SyncInputs } from "@/lib/sync-score";

/**
 * SyncMeter — gamified clone-body visual.
 *
 * If `public/twin-silhouette.png` is present (Jack's actual rainbow-aura
 * image), use it. Lower-than-100% sync desaturates a strip across the top
 * (from the head down) so the body literally fills with rainbow as you sync.
 *
 * If the file is not present, fall back to a hand-drawn SVG silhouette so
 * the dashboard never breaks.
 *
 * Caps at 99 — the last 1% is unreachable on purpose.
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

  // Check for the user-supplied PNG. Runs at request time, server-side.
  const pngPath = path.join(process.cwd(), "public", "twin-silhouette.png");
  const hasPng = (() => {
    try {
      return fs.existsSync(pngPath);
    } catch {
      return false;
    }
  })();

  if (hasPng) {
    // The image IS the rainbow-aura clone. We show it twice, stacked:
    //   - bottom layer: desaturated/dim — represents "unsynced" portion
    //   - top layer: full color, clip-path revealing only the bottom fillPct%
    const revealTop = 100 - fillPct; // % from top that stays desaturated
    return (
      <div
        style={{
          position: "relative",
          width: size,
          height: size * 1.4
        }}
      >
        {/* Dim/desaturated full image — the "not yet synced" baseline */}
        <img
          src="/twin-silhouette.png"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "grayscale(85%) brightness(0.55) opacity(0.55)"
          }}
        />
        {/* Full-color image revealed from the bottom up */}
        <img
          src="/twin-silhouette.png"
          alt="Your twin"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            clipPath: `inset(${revealTop}% 0 0 0)`,
            filter: `drop-shadow(0 0 ${10 + (total / 99) * 28}px var(--accent-glow))`
          }}
        />
        {/* % readout floats in front */}
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
              color: "#ffffff",
              textShadow:
                "0 0 14px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.95)"
            }}
          >
            {total}%
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              letterSpacing: "0.2em",
              fontWeight: 700,
              color: "#ffffff",
              textShadow: "0 0 8px rgba(0,0,0,0.9)",
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

  // ── Fallback SVG silhouette ──────────────────────────────────────────
  const HEAD_CX = 100;
  const HEAD_CY = 42;
  const HEAD_R = 24;
  const bodyPath =
    "M70 90 C70 78 80 74 100 74 C120 74 130 78 130 90 " +
    "L156 102 C172 110 184 122 192 140 L196 158 " +
    "C198 168 192 174 184 170 L182 164 L172 162 L176 172 L168 168 L170 178 L162 170 L160 176 L154 166 " +
    "L142 156 C132 150 130 138 132 124 L132 152 L142 200 L140 250 L138 296 " +
    "C138 302 134 304 130 304 C124 304 122 300 122 296 L120 250 L114 200 L108 200 L106 250 L100 296 " +
    "C100 302 96 304 92 304 C88 304 86 302 86 296 L82 250 L78 200 L68 152 L68 124 " +
    "C70 138 68 150 58 156 L46 166 L40 176 L38 170 L30 178 L32 168 L24 172 L28 162 L18 164 L16 170 " +
    "C8 174 2 168 4 158 L8 140 C16 122 28 110 44 102 L70 90 Z";
  const headPath = `M ${HEAD_CX - HEAD_R} ${HEAD_CY} a ${HEAD_R} ${HEAD_R} 0 1 0 ${HEAD_R * 2} 0 a ${HEAD_R} ${HEAD_R} 0 1 0 ${-HEAD_R * 2} 0 Z`;
  const silhouette = `${headPath} ${bodyPath}`;
  const fillY = 18 + (320 - 18) * (1 - fillPct / 100);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size * 1.4,
        filter: `drop-shadow(0 0 ${14 + (total / 99) * 40}px var(--accent-glow))`
      }}
    >
      <svg
        viewBox="0 0 200 320"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="syncRainbow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff77ee" />
            <stop offset="14%" stopColor="#ff4d6d" />
            <stop offset="30%" stopColor="#ff8a3d" />
            <stop offset="46%" stopColor="#ffe14d" />
            <stop offset="62%" stopColor="#3cd870" />
            <stop offset="80%" stopColor="#3aa8ff" />
            <stop offset="100%" stopColor="#a060ff" />
          </linearGradient>
          <filter id="syncHalo" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <clipPath id="syncClip">
            <path d={silhouette} fillRule="evenodd" />
          </clipPath>
        </defs>
        <g filter="url(#syncHalo)" opacity={0.3 + (total / 99) * 0.7}>
          <path
            d={silhouette}
            fill="none"
            stroke="url(#syncRainbow)"
            strokeWidth="22"
            strokeLinejoin="round"
            strokeLinecap="round"
            fillRule="evenodd"
          />
        </g>
        <g clipPath="url(#syncClip)">
          <rect x="0" y="0" width="200" height="320" fill="#0e1322" />
          <rect
            x="0"
            y={fillY}
            width="200"
            height={320 - fillY}
            fill="url(#syncRainbow)"
            opacity="0.78"
          />
        </g>
        <path
          d={silhouette}
          fill="none"
          stroke="#0a0d18"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          fillRule="evenodd"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: "26%",
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
            color: "#ffffff",
            textShadow:
              "0 0 14px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.95)"
          }}
        >
          {total}%
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            letterSpacing: "0.2em",
            fontWeight: 700,
            color: "#ffffff",
            textShadow: "0 0 8px rgba(0,0,0,0.9)",
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
