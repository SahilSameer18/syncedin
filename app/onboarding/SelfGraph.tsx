"use client";

import { useEffect, useRef, useState } from "react";

type Item = { id: string; label: string };
type Cluster = { category: string; label: string; items: Item[] };
type Graph = {
  center: { id: string; label: string };
  clusters: Cluster[];
};

const CATEGORY_META: Record<
  string,
  { color: string; gradient: string; icon: string }
> = {
  goals: {
    color: "#3a4dff",
    gradient: "linear-gradient(135deg, #3a4dff, #6f7bff)",
    icon: "🎯"
  },
  projects: {
    color: "#1f8bff",
    gradient: "linear-gradient(135deg, #1f8bff, #5ec5ff)",
    icon: "🚀"
  },
  people: {
    color: "#ff6b6b",
    gradient: "linear-gradient(135deg, #ff6b6b, #ff8a3d)",
    icon: "👥"
  },
  deal_preferences: {
    color: "#3cd870",
    gradient: "linear-gradient(135deg, #3cd870, #5ee5b2)",
    icon: "🤝"
  },
  deal_breakers: {
    color: "#ff8a3d",
    gradient: "linear-gradient(135deg, #ff8a3d, #ff4d6d)",
    icon: "🚫"
  },
  style: {
    color: "#a060ff",
    gradient: "linear-gradient(135deg, #a060ff, #ff77ee)",
    icon: "🎨"
  },
  skills: {
    color: "#ffd54d",
    gradient: "linear-gradient(135deg, #ffd54d, #ff8a3d)",
    icon: "⚡"
  }
};
const metaFor = (cat: string) =>
  CATEGORY_META[cat] || CATEGORY_META.goals;

export function SelfGraph({ formSelector = "form" }: { formSelector?: string }) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function readForm(): Record<string, string> {
    if (typeof document === "undefined") return {};
    const form = document.querySelector(formSelector) as HTMLFormElement | null;
    if (!form) return {};
    const out: Record<string, string> = {};
    form
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input[name], textarea[name]"
      )
      .forEach((el) => {
        out[el.name] = el.value;
      });
    return out;
  }

  async function refresh() {
    const f = readForm();
    const blob = [
      f.goals,
      f.deal_preferences,
      f.communication_style,
      f.deal_breakers,
      f.ai_export_blob
    ]
      .filter(Boolean)
      .join("");
    if (!blob.trim()) {
      setGraph(null);
      setEmpty(true);
      return;
    }
    setEmpty(false);
    setLoading(true);
    try {
      const r = await fetch("/api/extract-knowledge-graph", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: f.display_name,
          goals: f.goals,
          deal_preferences: f.deal_preferences,
          communication_style: f.communication_style,
          deal_breakers: f.deal_breakers,
          ai_export_blob: f.ai_export_blob
        })
      });
      const j = (await r.json()) as Graph;
      if (j?.clusters) setGraph(j);
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const form = document.querySelector(formSelector) as HTMLFormElement | null;
    if (!form) return;
    const handler = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(refresh, 900);
    };
    form.addEventListener("input", handler);
    handler();
    return () => {
      form.removeEventListener("input", handler);
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="retro-shadow"
      style={{
        position: "sticky",
        top: 24,
        padding: 20,
        borderRadius: 16,
        background:
          "radial-gradient(900px 600px at 30% 0%, rgba(58, 77, 255, 0.08), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(160, 96, 255, 0.08), transparent 60%), linear-gradient(180deg, #0a0d1e 0%, #11132a 100%)",
        border: "1px solid rgba(120, 130, 220, 0.35)",
        overflow: "hidden"
      }}
    >
      {/* Subtle animated grid behind everything */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(120, 130, 220, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(120, 130, 220, 0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(closest-side at 50% 50%, black, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(closest-side at 50% 50%, black, transparent 85%)",
          pointerEvents: "none"
        }}
      />

      <div
        className="flex items-center justify-between"
        style={{ position: "relative" }}
      >
        <div
          className="retro-label"
          style={{ color: "#9aa6ff" }}
        >
          self graph
        </div>
        {loading && (
          <div
            className="text-xs flex items-center gap-1.5"
            style={{ color: "#9aa6ff" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#5ee5b2",
                boxShadow: "0 0 8px #5ee5b2",
                animation: "sg-pulse 1.2s ease-in-out infinite"
              }}
            />
            regenerating
          </div>
        )}
      </div>
      <p
        className="mt-1 text-xs"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Live constellation of what makes you, you. Each cluster blooms as
        you add more context.
      </p>

      <div className="mt-4" style={{ position: "relative" }}>
        {empty ? (
          <div
            style={{
              padding: "60px 16px",
              textAlign: "center",
              color: "rgba(255,255,255,0.45)",
              fontSize: 14
            }}
          >
            Your constellation forms here.
            <br />
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              Add goals or paste context to start.
            </span>
          </div>
        ) : graph ? (
          <ZoomPanBox>
            <ConstellationView graph={graph} />
          </ZoomPanBox>
        ) : (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "rgba(255,255,255,0.45)",
              fontSize: 14
            }}
          >
            Forming…
          </div>
        )}
      </div>

      <style>{`
        @keyframes sg-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes sg-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes sg-orbit-rev {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes sg-flow {
          0% { stroke-dashoffset: 60; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes sg-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes sg-fade-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * ZoomPanBox — gives the constellation its own zoom + pan surface so the
 * graph never has to overflow into the rest of the page. Starts at 0.7×
 * (zoomed out) so every cluster card is visible without overlap, and lets
 * the user scroll-wheel to zoom in OR drag to pan.
 */
function ZoomPanBox({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((s) => {
      const next = s * (e.deltaY > 0 ? 0.92 : 1.08);
      return Math.max(0.3, Math.min(1.6, next));
    });
  }
  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return;
    setPan({
      x: e.clientX - dragRef.current.x,
      y: e.clientY - dragRef.current.y
    });
  }
  function onMouseUp() {
    dragRef.current = null;
  }

  const ctrlBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid rgba(120, 130, 220, 0.4)",
    background: "rgba(20, 24, 50, 0.85)",
    color: "#cfd5ff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
  };

  return (
    <div
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        position: "relative",
        width: "100%",
        height: 520,
        overflow: "hidden",
        borderRadius: 10,
        cursor: dragRef.current ? "grabbing" : "grab"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: dragRef.current
            ? "none"
            : "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)"
        }}
      >
        <div style={{ width: 760, pointerEvents: "auto" }}>{children}</div>
      </div>

      {/* Zoom controls — sit in the bottom-right of the panel */}
      <div
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          display: "flex",
          gap: 4,
          background: "rgba(10, 13, 30, 0.55)",
          padding: 4,
          borderRadius: 8,
          backdropFilter: "blur(6px)"
        }}
      >
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.3, s * 0.85))}
          style={ctrlBtn}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => {
            setScale(0.55);
            setPan({ x: 0, y: 0 });
          }}
          style={{ ...ctrlBtn, width: 44, fontSize: 10, letterSpacing: 1 }}
          aria-label="Reset view"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(1.6, s * 1.15))}
          style={ctrlBtn}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      {/* Drag hint, fades after first interaction */}
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
          pointerEvents: "none"
        }}
      >
        scroll to zoom · drag to pan
      </div>
    </div>
  );
}

function ConstellationView({ graph }: { graph: Graph }) {
  const clusters = graph.clusters.slice(0, 6);
  const rows = Math.max(2, Math.ceil(clusters.length / 2));
  const COL_W = 230;
  const COL_GAP = 28;
  const ROW_H = 150;
  const ROW_GAP = 22;
  const CENTER_W = 140;
  const W = 2 * COL_W + 2 * COL_GAP + CENTER_W;
  const H = rows * ROW_H + (rows - 1) * ROW_GAP + 60;
  const CX = W / 2;
  const CY = H / 2;

  // Position each cluster card in the 2-column grid AROUND the center.
  const slotFor = (i: number) => {
    const col = i % 2; // 0 = left, 1 = right
    const row = Math.floor(i / 2);
    const x = col === 0
      ? COL_W / 2
      : W - COL_W / 2;
    const y = 30 + row * (ROW_H + ROW_GAP) + ROW_H / 2;
    return { x, y, side: col === 0 ? "left" : "right" } as const;
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${W} / ${H}`,
        maxHeight: 620
      }}
    >
      {/* SVG layer: connectors with flowing gradient pulse */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none"
        }}
      >
        <defs>
          {clusters.map((c, i) => {
            const m = metaFor(c.category);
            return (
              <linearGradient
                key={`grad-${i}`}
                id={`sg-grad-${i}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#3a4dff" stopOpacity="0.85" />
                <stop offset="100%" stopColor={m.color} stopOpacity="0.85" />
              </linearGradient>
            );
          })}
          <radialGradient id="sg-center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3a4dff" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#8b3dff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8b3dff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer glow halo behind center */}
        <circle cx={CX} cy={CY} r={100} fill="url(#sg-center-glow)" />

        {/* Curved bezier connectors with animated flow */}
        {clusters.map((c, i) => {
          const s = slotFor(i);
          const tx = s.side === "left" ? s.x + COL_W / 2 - 10 : s.x - COL_W / 2 + 10;
          const ty = s.y;
          // Smooth curve from center to card edge
          const cx1 = (CX + tx) / 2;
          const cy1 = CY;
          const cx2 = (CX + tx) / 2;
          const cy2 = ty;
          return (
            <g key={`line-${i}`}>
              {/* Outline (faint) */}
              <path
                d={`M ${CX} ${CY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`}
                fill="none"
                stroke={`url(#sg-grad-${i})`}
                strokeWidth={1.5}
                strokeOpacity={0.55}
              />
              {/* Flowing pulse */}
              <path
                d={`M ${CX} ${CY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`}
                fill="none"
                stroke={metaFor(c.category).color}
                strokeWidth={2.2}
                strokeOpacity={0.95}
                strokeDasharray="6 54"
                style={{
                  animation: `sg-flow ${3 + i * 0.4}s linear infinite`
                }}
              />
            </g>
          );
        })}

        {/* Orbiting accent rings */}
        <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: "sg-orbit 22s linear infinite" }}>
          <circle
            cx={CX}
            cy={CY}
            r={76}
            fill="none"
            stroke="rgba(160, 96, 255, 0.25)"
            strokeWidth={1}
            strokeDasharray="4 8"
          />
        </g>
        <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: "sg-orbit-rev 30s linear infinite" }}>
          <circle
            cx={CX}
            cy={CY}
            r={56}
            fill="none"
            stroke="rgba(58, 77, 255, 0.35)"
            strokeWidth={1}
            strokeDasharray="2 10"
          />
        </g>

        {/* Center solid */}
        <circle
          cx={CX}
          cy={CY}
          r={40}
          fill="#0a0d1e"
          stroke="#5e6eff"
          strokeWidth={1.5}
        />
      </svg>

      {/* Center label */}
      <div
        style={{
          position: "absolute",
          left: `${(CX / W) * 100}%`,
          top: `${(CY / H) * 100}%`,
          transform: "translate(-50%, -50%)",
          color: "#ffffff",
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.04em",
          pointerEvents: "none",
          textShadow: "0 0 12px rgba(94,110,255,0.7)"
        }}
      >
        {(graph.center?.label || "you").slice(0, 12)}
      </div>

      {/* Cluster cards (HTML for richer styling) */}
      {clusters.map((c, i) => {
        const s = slotFor(i);
        const m = metaFor(c.category);
        const leftPct = ((s.x - COL_W / 2) / W) * 100;
        const topPct = ((s.y - ROW_H / 2) / H) * 100;
        const widthPct = (COL_W / W) * 100;
        const maxH = ROW_H;
        const visibleItems = c.items.slice(0, 5);
        return (
          <div
            key={`card-${i}`}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              maxHeight: maxH,
              padding: 12,
              borderRadius: 12,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              border: `1px solid ${m.color}55`,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow: `0 8px 32px -10px ${m.color}55, inset 0 1px 0 rgba(255,255,255,0.05)`,
              animation: `sg-fade-in 0.4s ease ${i * 80}ms both, sg-float ${4 + i * 0.3}s ease-in-out infinite ${i * 0.2}s`,
              overflow: "hidden"
            }}
          >
            {/* gradient header strip */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: m.gradient
              }}
            />

            {/* category title */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: m.color,
                textShadow: `0 0 12px ${m.color}66`
              }}
            >
              <span style={{ fontSize: 14 }}>{m.icon}</span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {c.label || c.category}
              </span>
            </div>

            {/* divider */}
            <div
              style={{
                margin: "8px 0 6px",
                height: 1,
                background: `linear-gradient(90deg, ${m.color}88, transparent)`
              }}
            />

            {/* items */}
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontFamily: "Inter, system-ui, sans-serif"
              }}
            >
              {visibleItems.map((it, j) => (
                <li
                  key={j}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "3px 0",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.92)",
                    animation: `sg-fade-in 0.4s ease ${i * 80 + j * 70 + 120}ms both`
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: m.color,
                      boxShadow: `0 0 8px ${m.color}`,
                      flexShrink: 0
                    }}
                  />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {it.label}
                  </span>
                </li>
              ))}
              {c.items.length > visibleItems.length && (
                <li
                  style={{
                    paddingTop: 4,
                    fontSize: 10,
                    fontFamily: '"IBM Plex Mono", monospace',
                    color: m.color,
                    opacity: 0.75
                  }}
                >
                  + {c.items.length - visibleItems.length} more
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
