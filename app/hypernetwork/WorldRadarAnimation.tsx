"use client";

/**
 * Hypernetwork hero animation — "what if you could talk to the entire
 * world at once". Globe wireframe (meridians + parallels) with dozens
 * of peer nodes scattered across the surface. The central YOU node
 * pulses; connection lines fire continuously from center to random
 * peers around the globe, fading in and out so the network feels
 * alive — not just radar pings.
 *
 * Geometry is precomputed at module load so render is deterministic
 * and there's no layout shift. Nodes use Fibonacci-sphere distribution
 * (golden-angle increments) projected to 2D, which gives an even
 * spread without grid artifacts. A subtle z-tilt fakes 3D depth: nodes
 * "behind" the equator get a smaller radius + lower opacity so the
 * globe reads as spherical rather than flat.
 *
 * Pure CSS animations + inline SVG. No canvas, no JS frame loop,
 * no external libs. Respects prefers-reduced-motion.
 */

const CENTER_X = 250;
const CENTER_Y = 250;
const GLOBE_R = 200;

// 64 peer nodes on a Fibonacci sphere. Each node carries its projected
// (x, y), an apparent-depth-based opacity (back-of-globe nodes are
// dimmer), and a stagger delay so they don't all blink in unison.
type Node = { x: number; y: number; depth: number; r: number; delay: string };

const NODES: Node[] = (() => {
  const out: Node[] = [];
  const count = 64;
  // Slight Y-axis tilt so the globe looks 3D instead of flat-radial.
  const tilt = 0.18; // radians, ~10°
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  for (let i = 0; i < count; i++) {
    // Even sphere distribution via golden-angle Fibonacci spiral.
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count); // latitude
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;     // longitude

    // Unit sphere coordinates.
    let sx = Math.sin(phi) * Math.cos(theta);
    let sy = Math.cos(phi);
    let sz = Math.sin(phi) * Math.sin(theta);

    // Tilt around X axis so the poles aren't dead-on top/bottom.
    const ty = sy * cosT - sz * sinT;
    const tz = sy * sinT + sz * cosT;
    sy = ty;
    sz = tz;

    // Orthographic projection — discard sz for x/y position but use
    // it for depth shading. Front of sphere = sz > 0.
    out.push({
      x: CENTER_X + sx * GLOBE_R,
      y: CENTER_Y + sy * GLOBE_R,
      depth: sz,
      r: 2.5 + Math.max(0, sz) * 1.5, // bigger when in front
      delay: (((i * 0.183) % 4) + 0.2).toFixed(2)
    });
  }
  return out;
})();

// 36 connection lines, each ties center to a randomly chosen peer node.
// Each line has its own staggered keyframe delay so the page constantly
// has ~6-10 lines drawing/fading at any moment — not a synchronous
// pulse, more like sustained traffic.
const LINK_COUNT = 36;
const LINKS = Array.from({ length: LINK_COUNT }).map((_, i) => {
  // Deterministic pseudo-random pick — stable across renders.
  const nodeIdx = (i * 17 + 5) % NODES.length;
  return {
    target: NODES[nodeIdx],
    delay: ((i * 0.27) % 6).toFixed(2),
    duration: (5 + ((i * 0.41) % 3)).toFixed(2)
  };
});

export function WorldRadarAnimation() {
  return (
    <div className="wra-shell">
      <style>{`
        .wra-shell {
          position: relative;
          width: 100%;
          max-width: 420px;
          aspect-ratio: 1 / 1;
          margin: 0 auto;
        }
        .wra-svg {
          width: 100%;
          height: 100%;
          display: block;
          overflow: visible;
        }
        /* Globe shell rotates slowly around the vertical axis. The
           wireframe + ALL nodes share the same rotation so it actually
           reads as a sphere turning, not a 2D plane. Connection lines
           live in a separate group (no rotation) so they keep firing
           toward whatever's currently visible. */
        .wra-globe {
          transform-origin: 250px 250px;
          transform-box: fill-box;
          animation: wra-spin 36s linear infinite;
        }
        @keyframes wra-spin {
          from { transform: rotateZ(0deg); }
          to   { transform: rotateZ(360deg); }
        }
        @keyframes wra-pulse-center {
          0%, 100% {
            r: 9;
            filter: drop-shadow(0 0 8px rgba(31, 139, 255, 0.65));
          }
          50% {
            r: 11;
            filter: drop-shadow(0 0 18px rgba(31, 139, 255, 0.95));
          }
        }
        @keyframes wra-node-twinkle {
          0%, 70%, 100% {
            fill-opacity: var(--base-opacity);
          }
          75%, 85% {
            fill-opacity: 1;
            filter: drop-shadow(0 0 5px #1f8bff);
          }
        }
        @keyframes wra-link-fire {
          0% {
            stroke-opacity: 0;
            stroke-dasharray: 0 600;
          }
          25% {
            stroke-opacity: 0.85;
            stroke-dasharray: 200 600;
          }
          70% {
            stroke-opacity: 0.4;
            stroke-dasharray: 600 0;
          }
          100% {
            stroke-opacity: 0;
            stroke-dasharray: 600 0;
          }
        }
        .wra-meridian,
        .wra-parallel {
          fill: none;
          stroke: rgba(31, 139, 255, 0.18);
          stroke-width: 0.8;
        }
        .wra-equator {
          fill: none;
          stroke: rgba(31, 139, 255, 0.35);
          stroke-width: 1.1;
        }
        .wra-outline {
          fill: none;
          stroke: rgba(31, 139, 255, 0.55);
          stroke-width: 1.5;
        }
        .wra-glow {
          fill: url(#wra-glow-grad);
          opacity: 0.7;
        }
        .wra-node {
          fill: #1f8bff;
          animation: wra-node-twinkle 4.2s ease-in-out infinite;
        }
        .wra-link {
          stroke: #1f8bff;
          stroke-width: 0.9;
          stroke-linecap: round;
          stroke-opacity: 0;
          animation-name: wra-link-fire;
          animation-iteration-count: infinite;
          animation-timing-function: ease-out;
          filter: drop-shadow(0 0 2px rgba(31, 139, 255, 0.6));
        }
        .wra-center {
          fill: #1f8bff;
          animation: wra-pulse-center 2.6s ease-in-out infinite;
        }
        .wra-center-ring {
          fill: none;
          stroke: rgba(31, 139, 255, 0.55);
          stroke-width: 1.4;
        }
        @media (prefers-reduced-motion: reduce) {
          .wra-globe, .wra-node, .wra-link, .wra-center {
            animation: none;
          }
        }
      `}</style>
      <svg
        className="wra-svg"
        viewBox="0 0 500 500"
        role="img"
        aria-label="Your twin reaching every node in the network simultaneously"
      >
        <defs>
          <radialGradient id="wra-glow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(31, 139, 255, 0.18)" />
            <stop offset="55%" stopColor="rgba(31, 139, 255, 0.06)" />
            <stop offset="100%" stopColor="rgba(31, 139, 255, 0)" />
          </radialGradient>
        </defs>

        {/* Soft ambient glow behind the globe */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={GLOBE_R + 60}
          className="wra-glow"
        />

        {/* GLOBE GROUP — outline + wireframe + nodes, all rotate together */}
        <g className="wra-globe">
          {/* Sphere outline */}
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={GLOBE_R}
            className="wra-outline"
          />

          {/* Latitude rings (parallels) — 5 above + equator + 5 below.
              Drawn as ellipses, with vertical radius matching the
              cosine of the latitude so they look 3D. */}
          {[-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75].map((latFrac, i) => {
            const lat = (latFrac * Math.PI) / 2;
            const ry = GLOBE_R * Math.sin(Math.PI / 2 - Math.abs(lat));
            const offsetY = GLOBE_R * Math.sin(lat) * 0.6;
            const isEquator = latFrac === 0;
            return (
              <ellipse
                key={`lat-${i}`}
                cx={CENTER_X}
                cy={CENTER_Y + offsetY}
                rx={GLOBE_R * Math.cos(lat)}
                ry={ry * 0.18}
                className={isEquator ? "wra-equator" : "wra-parallel"}
              />
            );
          })}

          {/* Longitude lines (meridians) — 8 ellipses rotated around
              the center. Each is a thin vertical ellipse, which gives
              the standard "globe" curvature when viewed orthographically. */}
          {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5].map((deg, i) => (
            <ellipse
              key={`lon-${i}`}
              cx={CENTER_X}
              cy={CENTER_Y}
              rx={GLOBE_R * Math.abs(Math.cos((deg * Math.PI) / 180))}
              ry={GLOBE_R}
              className="wra-meridian"
              transform={`rotate(0 ${CENTER_X} ${CENTER_Y})`}
            />
          ))}

          {/* Nodes — 64 peer twins scattered on the sphere surface */}
          {NODES.map((n, i) => {
            const baseOpacity = 0.25 + Math.max(0, n.depth) * 0.55;
            return (
              <circle
                key={`n-${i}`}
                cx={n.x}
                cy={n.y}
                r={n.r}
                className="wra-node"
                style={
                  {
                    "--base-opacity": baseOpacity.toFixed(2),
                    fillOpacity: baseOpacity,
                    animationDelay: `${n.delay}s`
                  } as React.CSSProperties
                }
              />
            );
          })}
        </g>

        {/* CONNECTION LINES — outside the rotating group so they keep
            firing toward fresh targets as the globe turns. 36 lines
            each with its own stagger; result reads as 6-10 simultaneously
            visible at any moment. */}
        <g>
          {LINKS.map((l, i) => (
            <line
              key={`link-${i}`}
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={l.target.x}
              y2={l.target.y}
              className="wra-link"
              style={{
                animationDelay: `${l.delay}s`,
                animationDuration: `${l.duration}s`
              }}
            />
          ))}
        </g>

        {/* Center "YOU" — pulsing core + small label ring */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={20}
          className="wra-center-ring"
        />
        <circle cx={CENTER_X} cy={CENTER_Y} r={9} className="wra-center" />
        <text
          x={CENTER_X}
          y={CENTER_Y + 40}
          textAnchor="middle"
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            fill: "currentColor",
            opacity: 0.65
          }}
        >
          you
        </text>
      </svg>
    </div>
  );
}
