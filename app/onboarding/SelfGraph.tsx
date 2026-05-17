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
  deal_preferences: "#5ee5b2",
  deal_breakers: "#ff8a3d",
  style: "#a060ff",
  skills: "#ffd54d"
};

const colorFor = (cat: string) => CATEGORY_COLORS[cat] || "#3a4dff";

/**
 * Live self-graph that listens to the onboarding form. Every time the user
 * edits a field or pastes context, we debounce, call the extract endpoint,
 * and morph the graph.
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
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input[name], textarea[name]"
    ).forEach((el) => {
      out[el.name] = el.value;
    });
    return out;
  }

  async function refresh() {
    const fields = readForm();
    const blob = [
      fields.goals,
      fields.deal_preferences,
      fields.communication_style,
      fields.deal_breakers,
      fields.ai_export_blob
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
          name: fields.display_name,
          goals: fields.goals,
          deal_preferences: fields.deal_preferences,
          communication_style: fields.communication_style,
          deal_breakers: fields.deal_breakers,
          ai_export_blob: fields.ai_export_blob
        })
      });
      const j = (await r.json()) as Graph;
      if (j?.clusters) setGraph(j);
    } catch {
      /* ignore — keep last graph */
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
    // Initial pass: pre-fill state if the form already has values from server.
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
      style={{
        position: "sticky",
        top: 24,
        padding: 20,
        minHeight: 520
      }}
    >
      <div className="flex items-center justify-between">
        <div className="retro-label">self graph</div>
        {loading && (
          <div className="retro-dim text-xs">regenerating…</div>
        )}
      </div>
      <p
        className="mt-1 text-xs"
        style={{ color: "var(--text-dim)" }}
      >
        Live map of what makes you, you. Every time you add context, this
        regenerates.
      </p>

      <div className="mt-4">
        {empty ? (
          <p
            className="text-sm"
            style={{ color: "var(--text-dim)", padding: "60px 8px" }}
          >
            Add goals or paste context on the left. Your self graph will start
            forming here, evolving as you describe more of who you are.
          </p>
        ) : graph ? (
          <GraphSvg graph={graph} />
        ) : (
          <p
            className="text-sm"
            style={{ color: "var(--text-dim)", padding: "60px 8px" }}
          >
            Forming…
          </p>
        )}
      </div>
    </div>
  );
}

function GraphSvg({ graph }: { graph: Graph }) {
  // Radial layout: center node in the middle, clusters arranged around it.
  // Each cluster has its parent node at one ring, and its items in an arc
  // around that parent.
  const SIZE = 520;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const CLUSTER_RADIUS = 160;
  const ITEM_RADIUS = 78;

  const clusters = graph.clusters.slice(0, 7);
  const angles = clusters.map((_, i) =>
    (i / clusters.length) * Math.PI * 2 - Math.PI / 2
  );

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      height={SIZE}
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3a4dff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#3a4dff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Connection lines from center to each cluster */}
      {clusters.map((c, i) => {
        const a = angles[i];
        const x = CX + Math.cos(a) * CLUSTER_RADIUS;
        const y = CY + Math.sin(a) * CLUSTER_RADIUS;
        const color = colorFor(c.category);
        return (
          <g key={`line-${i}`}>
            <line
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke={color}
              strokeOpacity={0.45}
              strokeWidth={1.5}
            />
          </g>
        );
      })}

      {/* Connection lines from each cluster parent to its items */}
      {clusters.map((c, i) => {
        const a = angles[i];
        const px = CX + Math.cos(a) * CLUSTER_RADIUS;
        const py = CY + Math.sin(a) * CLUSTER_RADIUS;
        const color = colorFor(c.category);
        const itemCount = Math.min(c.items.length, 6);
        return c.items.slice(0, itemCount).map((it, j) => {
          // Spread items in a small arc on the OUTSIDE of the parent.
          const spread = Math.min(1.2, 0.4 + itemCount * 0.12);
          const baseAngle = a;
          const itemAngle =
            baseAngle + (j - (itemCount - 1) / 2) * (spread / itemCount);
          const ix = px + Math.cos(itemAngle) * ITEM_RADIUS;
          const iy = py + Math.sin(itemAngle) * ITEM_RADIUS;
          return (
            <line
              key={`line-${i}-${j}`}
              x1={px}
              y1={py}
              x2={ix}
              y2={iy}
              stroke={color}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          );
        });
      })}

      {/* Center glow halo */}
      <circle cx={CX} cy={CY} r={70} fill="url(#centerGlow)" />

      {/* Center node */}
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
        y={CY + 4}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill="#ffffff"
        fontFamily="'IBM Plex Mono', monospace"
      >
        {(graph.center?.label || "you").slice(0, 10)}
      </text>

      {/* Cluster parent nodes + labels */}
      {clusters.map((c, i) => {
        const a = angles[i];
        const x = CX + Math.cos(a) * CLUSTER_RADIUS;
        const y = CY + Math.sin(a) * CLUSTER_RADIUS;
        const color = colorFor(c.category);
        return (
          <g key={`cluster-${i}`}>
            <circle
              cx={x}
              cy={y}
              r={22}
              fill={color}
              fillOpacity={0.15}
              stroke={color}
              strokeWidth={1.5}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill={color}
              fontFamily="'IBM Plex Mono', monospace"
              style={{ letterSpacing: "0.05em" }}
            >
              {(c.label || c.category).slice(0, 12)}
            </text>
          </g>
        );
      })}

      {/* Item leaf nodes */}
      {clusters.map((c, i) => {
        const a = angles[i];
        const px = CX + Math.cos(a) * CLUSTER_RADIUS;
        const py = CY + Math.sin(a) * CLUSTER_RADIUS;
        const color = colorFor(c.category);
        const itemCount = Math.min(c.items.length, 6);
        return c.items.slice(0, itemCount).map((it, j) => {
          const spread = Math.min(1.2, 0.4 + itemCount * 0.12);
          const baseAngle = a;
          const itemAngle =
            baseAngle + (j - (itemCount - 1) / 2) * (spread / itemCount);
          const ix = px + Math.cos(itemAngle) * ITEM_RADIUS;
          const iy = py + Math.sin(itemAngle) * ITEM_RADIUS;
          const labelOffset = Math.cos(itemAngle) >= 0 ? 8 : -8;
          const anchor =
            Math.cos(itemAngle) >= 0 ? "start" : "end";
          return (
            <g key={`item-${i}-${j}`}>
              <circle
                cx={ix}
                cy={iy}
                r={5}
                fill={color}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              <text
                x={ix + labelOffset}
                y={iy + 3}
                textAnchor={anchor}
                fontSize={9}
                fill="#0a0d18"
                fontFamily="Inter, system-ui, sans-serif"
                fontWeight={500}
              >
                {(it.label || "").slice(0, 22)}
              </text>
            </g>
          );
        });
      })}
    </svg>
  );
}
