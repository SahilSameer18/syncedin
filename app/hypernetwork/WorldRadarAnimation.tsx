"use client";

/**
 * Hypernetwork hero animation — visualizes "what if you could talk to
 * the entire world at once". A central node (you) pulses, signals
 * radiate outward, and dozens of peer nodes light up in sequence as
 * the signal sweeps the globe. Each peer that lights up briefly draws
 * a connection line back to the center — the "amazing collaboration
 * born" moment.
 *
 * Pure CSS animations + a small fixed set of inline SVG circles.
 * No external libs, no canvas, no JS frame loop. Respects
 * prefers-reduced-motion: replaces the sweep with a static layout.
 */
export function WorldRadarAnimation() {
  // 24 peer nodes laid out in 2 concentric rings around the center.
  // The exact coordinates are precomputed so render is deterministic
  // and there's no layout shift.
  const RING_1 = 80;
  const RING_2 = 130;
  const center = { x: 175, y: 175 };
  const inner = Array.from({ length: 10 }).map((_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    return {
      x: center.x + Math.cos(a) * RING_1,
      y: center.y + Math.sin(a) * RING_1,
      delay: (i * 0.35).toFixed(2)
    };
  });
  const outer = Array.from({ length: 14 }).map((_, i) => {
    const a = (i / 14) * Math.PI * 2 - Math.PI / 2 + 0.18;
    return {
      x: center.x + Math.cos(a) * RING_2,
      y: center.y + Math.sin(a) * RING_2,
      delay: (1.4 + i * 0.32).toFixed(2)
    };
  });

  return (
    <div className="wra-shell">
      <style>{`
        .wra-shell {
          position: relative;
          width: 100%;
          max-width: 360px;
          aspect-ratio: 1 / 1;
          margin: 0 auto;
        }
        .wra-svg { width: 100%; height: 100%; display: block; }
        @keyframes wra-pulse-out {
          0%   { transform: scale(0.4); opacity: 0.6; }
          80%  { opacity: 0.05; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes wra-node-on {
          0%, 60%   { fill: rgba(31, 139, 255, 0.25); r: 4; }
          70%       { fill: #1f8bff; r: 6; filter: drop-shadow(0 0 6px #1f8bff); }
          100%      { fill: rgba(31, 139, 255, 0.55); r: 4; filter: none; }
        }
        @keyframes wra-link-draw {
          0%, 60% { stroke-opacity: 0; stroke-dasharray: 0 200; }
          75%     { stroke-opacity: 0.8; stroke-dasharray: 200 0; }
          100%    { stroke-opacity: 0; }
        }
        @keyframes wra-center {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(31, 139, 255, 0.5)); }
          50%      { filter: drop-shadow(0 0 12px rgba(31, 139, 255, 0.85)); }
        }
        .wra-ring {
          transform-origin: center;
          transform-box: fill-box;
          animation: wra-pulse-out 4.5s ease-out infinite;
          fill: none;
          stroke: rgba(31, 139, 255, 0.45);
          stroke-width: 1;
        }
        .wra-node {
          fill: rgba(31, 139, 255, 0.25);
          animation: wra-node-on 4.5s ease-in-out infinite;
        }
        .wra-link {
          stroke: rgba(31, 139, 255, 0.6);
          stroke-width: 0.8;
          stroke-opacity: 0;
          animation: wra-link-draw 4.5s ease-in-out infinite;
        }
        .wra-center {
          fill: #1f8bff;
          animation: wra-center 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .wra-ring, .wra-node, .wra-link, .wra-center { animation: none; }
        }
      `}</style>
      <svg
        className="wra-svg"
        viewBox="0 0 350 350"
        role="img"
        aria-label="Your twin reaching the entire network in parallel"
      >
        {/* Outward radar rings — three with staggered delays */}
        {[0, 1.5, 3].map((d, i) => (
          <circle
            key={`ring-${i}`}
            className="wra-ring"
            cx={center.x}
            cy={center.y}
            r={60}
            style={{ animationDelay: `${d}s` }}
          />
        ))}
        {/* Peer-node connection lines (drawn briefly when each lights) */}
        {[...inner, ...outer].map((p, i) => (
          <line
            key={`link-${i}`}
            className="wra-link"
            x1={center.x}
            y1={center.y}
            x2={p.x}
            y2={p.y}
            style={{ animationDelay: `${p.delay}s` }}
          />
        ))}
        {/* Inner ring nodes */}
        {inner.map((p, i) => (
          <circle
            key={`in-${i}`}
            className="wra-node"
            cx={p.x}
            cy={p.y}
            r={4}
            style={{ animationDelay: `${p.delay}s` }}
          />
        ))}
        {/* Outer ring nodes */}
        {outer.map((p, i) => (
          <circle
            key={`out-${i}`}
            className="wra-node"
            cx={p.x}
            cy={p.y}
            r={3.4}
            style={{ animationDelay: `${p.delay}s` }}
          />
        ))}
        {/* Center node = you. Slightly larger, glow pulse. */}
        <circle
          className="wra-center"
          cx={center.x}
          cy={center.y}
          r={8}
        />
        <text
          x={center.x}
          y={center.y + 30}
          textAnchor="middle"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fill: "currentColor",
            opacity: 0.6
          }}
        >
          you
        </text>
      </svg>
    </div>
  );
}
