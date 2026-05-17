"use client";

import { useEffect, useRef, useState } from "react";

type Item = { id: string; label: string };
type Cluster = { category: string; label: string; items: Item[] };
type Graph = {
  center: { id: string; label: string };
  clusters: Cluster[];
};

const CATEGORY_COLORS: Record<string, string> = {
  goals: "#3a4dff",
  projects: "#1f8bff",
  people: "#ff6b6b",
  deal_preferences: "#3cd870",
  deal_breakers: "#ff8a3d",
  style: "#a060ff",
  skills: "#ffd54d"
};
const colorFor = (cat: string) => CATEGORY_COLORS[cat] || "#3a4dff";
const trunc = (s: string, n: number) =>
  s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

/**
 * Live self-graph. Re-renders as the onboarding form changes. Layout:
 * central "you" node with each cluster radiating out to its own column,
 * items stacked vertically inside each cluster column. No overlap because
 * each cluster owns a dedicated vertical strip.
 */
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
      /* keep last graph */
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
      className="retro-panel retro-shadow"
      style={{ position: "sticky", top: 24, padding: 20 }}
    >
      <div className="flex items-center justify-between">
        <div className="retro-label">self graph</div>
        {loading && <div className="retro-dim text-xs">regenerating…</div>}
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
        Live map of what makes you, you. Every time you add context, this
        regenerates.
      </p>

      <div className="mt-4">
        {empty ? (
          <p
            className="text-sm"
            style={{ color: "var(--text-dim)", padding: "40px 8px" }}
          >
            Add goals or paste context. Your self graph will form here.
          </p>
        ) : graph ? (
          <GraphSvg graph={graph} />
        ) : (
          <p
            className="text-sm"
            style={{ color: "var(--text-dim)", padding: "40px 8px" }}
          >
            Forming…
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Column-based mind-map layout:
 *   ┌─────────────────────────────────────┐
 *   │   ┌─ Goals ───┐    ┌─ Projects ─┐   │
 *   │   │ • item    │    │ • item     │   │
 *   │   │ • item    │    │ • item     │   │
 *   │   └───────────┘    └────────────┘   │
 *   │              [ YOU ]                 │
 *   │   ┌─ People ──┐    ┌─ Skills ───┐   │
 *   │   │ • item    │    │ • item     │   │
 *   │   └───────────┘    └────────────┘   │
 *   └─────────────────────────────────────┘
 *
 * Clusters wrap to 2 columns × N rows depending on count. The center "you"
 * node sits in the middle. Lines connect center to each cluster header.
 */
function GraphSvg({ graph }: { graph: Graph }) {
  const clusters = graph.clusters.slice(0, 6); // cap at 6 to keep it readable
  // Grid: 2 columns × up to 3 rows, with center node in the middle.
  const COLS = 2;
  const rows = Math.ceil(clusters.length / COLS);

  const COL_W = 200;
  const COL_GAP = 24;
  const ROW_H = 180;
  const ROW_GAP = 18;
  const CENTER_W = 100;
  const W = COLS * COL_W + (COLS - 1) * COL_GAP + CENTER_W * 2;
  const H = Math.max(360, rows * ROW_H + (rows - 1) * ROW_GAP + 40);

  const CX = W / 2;
  const CY = H / 2;

  // Place each cluster in a grid slot. The grid sits BEHIND the center
  // node; the center node visually overlaps the middle column.
  const slotFor = (i: number) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    // x: left half clusters go left of center, right half right of center
    const x = col === 0
      ? CX - CENTER_W - COL_GAP - COL_W / 2
      : CX + CENTER_W + COL_GAP + COL_W / 2;
    const y = 20 + row * (ROW_H + ROW_GAP) + ROW_H / 2;
    return { x, y, side: col === 0 ? "left" : "right" } as const;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", maxHeight: 540 }}
    >
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3a4dff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#3a4dff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Connectors from center to each cluster */}
      {clusters.map((c, i) => {
        const s = slotFor(i);
        const color = colorFor(c.category);
        const cx = s.side === "left" ? s.x + COL_W / 2 : s.x - COL_W / 2;
        return (
          <line
            key={`conn-${i}`}
            x1={CX}
            y1={CY}
            x2={cx}
            y2={s.y}
            stroke={color}
            strokeOpacity={0.5}
            strokeWidth={1.5}
          />
        );
      })}

      {/* Center "you" */}
      <circle cx={CX} cy={CY} r={62} fill="url(#centerGlow)" />
      <circle
        cx={CX}
        cy={CY}
        r={36}
        fill="#0a0d18"
        stroke="#3a4dff"
        strokeWidth={2}
      />
      <text
        x={CX}
        y={CY + 5}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill="#ffffff"
        fontFamily="'IBM Plex Mono', monospace"
      >
        {trunc(graph.center?.label || "you", 10)}
      </text>

      {/* Cluster cards */}
      {clusters.map((c, i) => {
        const s = slotFor(i);
        const color = colorFor(c.category);
        const cardX = s.x - COL_W / 2;
        const cardY = s.y - ROW_H / 2;
        const itemRows = Math.min(c.items.length, 5);
        const headerH = 30;
        const itemH = 18;
        const cardH = headerH + itemRows * itemH + 14;
        return (
          <g key={`card-${i}`}>
            {/* card background */}
            <rect
              x={cardX}
              y={cardY}
              width={COL_W}
              height={cardH}
              rx={10}
              fill="#ffffff"
              stroke={color}
              strokeWidth={1.5}
              opacity={0.98}
            />
            {/* category label */}
            <text
              x={cardX + 12}
              y={cardY + 20}
              fontSize={11}
              fontWeight={700}
              fill={color}
              fontFamily="'IBM Plex Mono', monospace"
              style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              {trunc(c.label || c.category, 26)}
            </text>
            {/* divider */}
            <line
              x1={cardX + 10}
              y1={cardY + headerH}
              x2={cardX + COL_W - 10}
              y2={cardY + headerH}
              stroke={color}
              strokeOpacity={0.25}
              strokeWidth={1}
            />
            {/* items */}
            {c.items.slice(0, itemRows).map((it, j) => {
              const ix = cardX + 14;
              const iy = cardY + headerH + 8 + (j + 1) * itemH - 4;
              return (
                <g key={`item-${i}-${j}`}>
                  <circle cx={ix} cy={iy - 4} r={3} fill={color} />
                  <text
                    x={ix + 10}
                    y={iy}
                    fontSize={11}
                    fill="#0a0d18"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {trunc(it.label || "", 28)}
                  </text>
                </g>
              );
            })}
            {c.items.length > itemRows && (
              <text
                x={cardX + 14}
                y={cardY + cardH - 8}
                fontSize={10}
                fill={color}
                fontFamily="Inter, system-ui, sans-serif"
                opacity={0.75}
              >
                + {c.items.length - itemRows} more
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
