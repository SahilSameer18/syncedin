/**
 * NetworkDensity — side-by-side animated SVGs showing the value SyncedIn
 * adds to a group of people.
 *
 * LEFT:  scattered, disconnected attendee nodes (the community / event today)
 *        — nodes drift slightly so the page feels alive even on the "before"
 *        side. No edges.
 *
 * RIGHT: same N nodes arranged in a clean ring, with twin-discovered
 *        "win-win" edges drawing themselves in sequence. Each edge animates
 *        a stroke-dashoffset from full to zero, so the user sees motion
 *        — connections forming, not a static diagram. Matched nodes pulse.
 *
 * Pure SMIL/SVG, no JS. Renders identically on server + client.
 */
export function NetworkDensity() {
  const N = 14;
  // Slightly jittered scatter for the "before" panel.
  const left: Array<{ x: number; y: number }> = [
    { x: 60, y: 50 },
    { x: 140, y: 30 },
    { x: 220, y: 70 },
    { x: 280, y: 40 },
    { x: 320, y: 110 },
    { x: 80, y: 130 },
    { x: 180, y: 160 },
    { x: 250, y: 200 },
    { x: 100, y: 200 },
    { x: 320, y: 220 },
    { x: 60, y: 260 },
    { x: 160, y: 280 },
    { x: 240, y: 270 },
    { x: 300, y: 290 }
  ];
  // Clean ring for the "after" panel.
  const cx = 190;
  const cy = 170;
  const r = 130;
  const right = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r };
  });
  // Twin-discovered "win-win" pairs (a curated 7 — not the full mesh, which
  // is the whole point: SyncedIn surfaces the high-leverage pairs, not noise).
  const edges: Array<[number, number]> = [
    [0, 6],
    [2, 9],
    [4, 11],
    [1, 8],
    [3, 12],
    [5, 13],
    [7, 10]
  ];

  // Each edge animates in sequentially. Total cycle length holds steady so
  // the loop feels natural — fast enough to feel alive, slow enough to read.
  const PER_EDGE = 0.7; // seconds an edge takes to draw
  const HOLD = 2.0; // seconds all edges stay drawn before fading
  const TOTAL = edges.length * PER_EDGE + HOLD + 1.0;

  return (
    <div
      className="retro-panel"
      style={{ padding: 16, background: "var(--panel-solid)" }}
    >
      <div className="grid sm:grid-cols-2 gap-4 items-stretch">
        {/* LEFT — disconnected */}
        <div>
          <div
            className="retro-label text-center"
            style={{ color: "var(--text-dim)" }}
          >
            Today · low density
          </div>
          <svg
            viewBox="0 0 380 340"
            width="100%"
            height="auto"
            role="img"
            aria-label="Scattered, disconnected community members"
          >
            {left.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={9}
                  fill="var(--panel-2)"
                  stroke="var(--border-bright)"
                  strokeWidth={1.5}
                >
                  {/* gentle drift so the "before" side is alive but uncoordinated */}
                  <animate
                    attributeName="cy"
                    values={`${p.y};${p.y + 3};${p.y - 2};${p.y}`}
                    dur={`${4 + (i % 3)}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx={p.x} cy={p.y - 3} r={3.5} fill="var(--text-dim)">
                  <animate
                    attributeName="cy"
                    values={`${p.y - 3};${p.y};${p.y - 5};${p.y - 3}`}
                    dur={`${4 + (i % 3)}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            ))}
          </svg>
          <p
            className="retro-dim text-xs mt-2 text-center"
            style={{ lineHeight: 1.5 }}
          >
            Brilliant people in the same group, mostly never finding the
            counterpart they should be working with.
          </p>
        </div>

        {/* RIGHT — connected via twins, animated */}
        <div>
          <div
            className="retro-label text-center"
            style={{ color: "var(--amber-bright)" }}
          >
            On SyncedIn · high density
          </div>
          <svg
            viewBox="0 0 380 340"
            width="100%"
            height="auto"
            role="img"
            aria-label="Twin-discovered connections forming between community members"
          >
            <defs>
              <linearGradient id="nd_edge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--amber)" />
                <stop offset="100%" stopColor="var(--amber-bright)" />
              </linearGradient>
              <radialGradient id="nd_glow" cx="0.5" cy="0.5" r="0.5">
                <stop
                  offset="0%"
                  stopColor="var(--amber-bright)"
                  stopOpacity="0.45"
                />
                <stop
                  offset="100%"
                  stopColor="var(--amber-bright)"
                  stopOpacity="0"
                />
              </radialGradient>
            </defs>

            {/* Pulsing halos behind matched nodes */}
            {Array.from(new Set(edges.flat())).map((idx) => {
              const p = right[idx];
              return (
                <circle
                  key={`g${idx}`}
                  cx={p.x}
                  cy={p.y}
                  r={20}
                  fill="url(#nd_glow)"
                >
                  <animate
                    attributeName="r"
                    values="16;26;16"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;1;0.6"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}

            {/* Edges — draw in sequence, hold, restart. Each edge has a
                stroke-dasharray of its length and animates dashoffset
                from length → 0 (drawing in), staggered by index. */}
            {edges.map(([a, b], i) => {
              const A = right[a];
              const B = right[b];
              const len = Math.hypot(B.x - A.x, B.y - A.y);
              const begin = i * PER_EDGE;
              return (
                <line
                  key={`e${i}`}
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  stroke="url(#nd_edge)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={len}
                  strokeDashoffset={len}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    values={`${len};0;0;${len}`}
                    keyTimes={`0;${(PER_EDGE / TOTAL).toFixed(3)};${((edges.length * PER_EDGE + HOLD - begin) / TOTAL).toFixed(3)};1`}
                    dur={`${TOTAL}s`}
                    begin={`${begin}s`}
                    repeatCount="indefinite"
                  />
                </line>
              );
            })}

            {/* Sparks that travel each edge while drawing — small white dots */}
            {edges.map(([a, b], i) => {
              const A = right[a];
              const B = right[b];
              const begin = i * PER_EDGE;
              return (
                <circle
                  key={`s${i}`}
                  r={2.5}
                  fill="#ffffff"
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0;0"
                    keyTimes="0;0.05;0.95;1;1"
                    dur={`${PER_EDGE}s`}
                    begin={`${begin}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cx"
                    values={`${A.x};${B.x}`}
                    dur={`${PER_EDGE}s`}
                    begin={`${begin}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy"
                    values={`${A.y};${B.y}`}
                    dur={`${PER_EDGE}s`}
                    begin={`${begin}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}

            {/* Nodes */}
            {right.map((p, i) => {
              const matched = edges.flat().includes(i);
              return (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={11}
                    fill={matched ? "var(--panel-solid)" : "var(--panel-2)"}
                    stroke={
                      matched ? "var(--amber-bright)" : "var(--border-bright)"
                    }
                    strokeWidth={matched ? 2 : 1.5}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y - 3}
                    r={4}
                    fill={matched ? "var(--amber)" : "var(--text-dim)"}
                  />
                  <path
                    d={`M ${p.x - 5} ${p.y + 5} Q ${p.x} ${p.y + 1} ${p.x + 5} ${p.y + 5}`}
                    fill="none"
                    stroke={matched ? "var(--amber)" : "var(--text-dim)"}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </svg>
          <p
            className="retro-dim text-xs mt-2 text-center"
            style={{ lineHeight: 1.5 }}
          >
            Twins find the high-leverage pairings ahead of time. Each member
            gets a ranked shortlist of who to talk to and what to talk about.
          </p>
        </div>
      </div>
    </div>
  );
}
