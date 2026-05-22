"use client";

import { useEffect, useState } from "react";
import { BrandLogo, type BrandKey } from "../BrandLogo";

/**
 * Multi-source AI export uploader. Per Jack: "I use Claude AND ChatGPT
 * every day for months — both have huge depth on me, integrating BOTH
 * (not just one) is a massive twin-quality unlock. This integration
 * is king."
 *
 * Each user gets one row per source so they can paste a deep self-
 * description from each AI tool. Each section has its own platform-
 * tuned prompt (what to ASK that tool that it'd uniquely know about
 * them).
 *
 * Persists to /api/ai-exports (one row per user+source, upsert).
 * Mounted on /onboarding so it shows up as part of the twin-build flow.
 */

type Source = {
  key: "chatgpt" | "claude" | "gemini" | "perplexity";
  label: string;
  brand: BrandKey;
  prompt: string;
};

const SOURCES: Source[] = [
  {
    key: "chatgpt",
    label: "ChatGPT",
    brand: "chatgpt",
    prompt: `Based on EVERYTHING we've ever talked about, write a deep 200-word self-description of me that captures: (1) what I'm working on right now, (2) the recurring problems I'm trying to solve, (3) my communication style and what I find funny, (4) what kinds of intros/deals/collabs would actually help me, (5) dealbreakers and things I'd rather NOT be pitched, (6) recent wins or specifics that prove what I'm credible at. Be specific. First-person. No fluff. This is going into a digital twin agent that will represent me in conversations on my behalf.`
  },
  {
    key: "claude",
    label: "Claude",
    brand: "claude",
    prompt: `Across all our conversations, write a deep 200-word self-description of me capturing: (1) my current focus, (2) the problems I'm trying to solve next 90 days, (3) my communication style + dealbreakers, (4) what intros/deals/collaborations would help me, (5) specific recent wins. Be concrete and first-person. This is for a digital twin agent that will represent me in conversations.`
  },
  {
    key: "gemini",
    label: "Gemini",
    brand: "gemini",
    prompt: `Based on our chat history, write a 200-word first-person self-description of me covering: who I am day-to-day, top problems I'm solving, communication style, what kinds of intros would help, dealbreakers, recent wins. For a digital twin agent that represents me.`
  },
  {
    key: "perplexity",
    label: "Perplexity",
    brand: "perplexity",
    prompt: `From our conversations and any research I've done with you, write a 200-word self-description: my role/focus, current problems, comm style, ideal intros, dealbreakers, recent wins. First-person, specific, for a digital twin agent.`
  }
];

export function AiExportsPanel() {
  const [openKey, setOpenKey] = useState<Source["key"] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai-exports");
        const j = await res.json();
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const e of (j.exports ?? []) as any[]) {
          if (typeof e.source === "string" && typeof e.content === "string") {
            next[e.source] = e.content;
          }
        }
        setValues(next);
      } catch {
        /* offline / unauthed — start empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyPrompt(source: Source) {
    try {
      await navigator.clipboard.writeText(source.prompt);
      setCopied(source.key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt("Copy this prompt:", source.prompt);
    }
  }

  async function save(key: Source["key"], content: string) {
    if (!content.trim()) return;
    try {
      const res = await fetch("/api/ai-exports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: key, content })
      });
      if (res.ok) {
        setSavedAt((s) => ({ ...s, [key]: Date.now() }));
      }
    } catch {
      /* non-fatal — user can retry */
    }
  }

  const totalConnected = Object.values(values).filter(
    (v) => v && v.trim().length > 0
  ).length;

  return (
    <section
      style={{
        padding: 18,
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--panel-solid)"
      }}
    >
      <style>{`
        .aiex-tile {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 14px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: border-color 0.15s ease;
        }
        .aiex-tile:hover { border-color: #1f8bff; }
        .aiex-tile.has-data { border-color: rgba(34, 197, 94, 0.45); }
        .aiex-tile-left {
          display: flex; align-items: center; gap: 10px;
          font-weight: 700; font-size: 14px;
        }
        .aiex-tile-right {
          font-size: 11px; color: var(--text-dim); letter-spacing: 0.04em;
        }
        .aiex-tile.has-data .aiex-tile-right {
          color: #15803d; font-weight: 700;
        }
        .aiex-panel {
          padding: 14px;
          margin-top: -2px;
          margin-bottom: 10px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 10px;
        }
        .aiex-prompt {
          padding: 10px 12px;
          background: var(--panel-solid);
          border: 1px dashed var(--border-bright);
          border-radius: 8px;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 12px;
          line-height: 1.5;
          color: var(--text);
          max-height: 160px;
          overflow-y: auto;
          white-space: pre-wrap;
        }
        .aiex-copy {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 12px; font-size: 12px; font-weight: 700;
          border-radius: 8px;
          background: rgba(31, 139, 255, 0.10);
          color: #1f8bff;
          border: 1px solid rgba(31, 139, 255, 0.30);
          cursor: pointer; margin-top: 8px;
        }
        .aiex-copy.copied {
          background: rgba(34, 197, 94, 0.10);
          color: #15803d;
          border-color: rgba(34, 197, 94, 0.30);
        }
      `}</style>

      <header style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#1f8bff"
          }}
        >
          king-level twin context
        </div>
        <h3
          style={{
            margin: "4px 0 6px",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.005em"
          }}
        >
          Connect your AI tools — each one knows you differently
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            lineHeight: 1.5,
            margin: 0
          }}
        >
          You probably use ChatGPT, Claude, and others daily. Each has
          a different slice of who you are. Pull that depth into your
          twin so it can actually represent you.{" "}
          <strong style={{ color: "var(--text)" }}>
            {totalConnected} of {SOURCES.length} connected.
          </strong>
        </p>
      </header>

      {SOURCES.map((source) => {
        const isOpen = openKey === source.key;
        const value = values[source.key] || "";
        const hasData = value.trim().length > 0;
        return (
          <div key={source.key}>
            <div
              className={`aiex-tile ${hasData ? "has-data" : ""}`}
              onClick={() =>
                setOpenKey((k) => (k === source.key ? null : source.key))
              }
            >
              <div className="aiex-tile-left">
                <BrandLogo brand={source.brand} size={18} />
                <span>{source.label}</span>
              </div>
              <span className="aiex-tile-right">
                {hasData
                  ? `✓ ${value.length.toLocaleString()} chars`
                  : isOpen
                    ? "open"
                    : "add"}
              </span>
            </div>
            {isOpen && (
              <div className="aiex-panel">
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    marginBottom: 6,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontWeight: 700
                  }}
                >
                  Step 1 — copy this prompt into {source.label}
                </div>
                <div className="aiex-prompt">{source.prompt}</div>
                <button
                  type="button"
                  onClick={() => copyPrompt(source)}
                  className={`aiex-copy ${copied === source.key ? "copied" : ""}`}
                >
                  {copied === source.key ? "✓ copied" : "⧉ copy prompt"}
                </button>

                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    marginTop: 14,
                    marginBottom: 6,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontWeight: 700
                  }}
                >
                  Step 2 — paste {source.label}&apos;s response here
                </div>
                <textarea
                  value={value}
                  onChange={(e) => {
                    const next = e.target.value.slice(0, 60_000);
                    setValues((s) => ({ ...s, [source.key]: next }));
                  }}
                  onBlur={() => save(source.key, value)}
                  rows={8}
                  placeholder={`Paste ${source.label}'s response here. Auto-saves on blur.`}
                  className="retro-input"
                  style={{
                    width: "100%",
                    fontSize: 13.5,
                    padding: 10,
                    minHeight: 140
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 6
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)"
                    }}
                  >
                    {value.length.toLocaleString()} / 60,000
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: savedAt[source.key] ? "#15803d" : "var(--text-dim)"
                    }}
                  >
                    {savedAt[source.key] ? "saved ✓" : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {loading && (
        <p
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "var(--text-dim)"
          }}
        >
          Loading saved exports…
        </p>
      )}
    </section>
  );
}
