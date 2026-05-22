"use client";

import { useState } from "react";

/**
 * Real working recommendation generator card — used for Movies + Books
 * on /personal-intelligence. Hits /api/personal-intelligence/recs with
 * the user's full twin context and returns 5 personalized picks with
 * a per-item "why this fits you" note.
 *
 * Replaces the "Shipping soon" placeholder for these cards. Demonstrates
 * the actual generation pipeline that future cards (merch, song, life
 * path, business projection) will use the same shape.
 */
type Item = { title: string; year: string; why: string };

export function RecGeneratorCard({
  kind,
  icon,
  eyebrow,
  title,
  blurb,
  accent
}: {
  kind: "movies" | "books" | "shows" | "albums" | "podcasts";
  icon: string;
  eyebrow: string;
  title: string;
  blurb: string;
  accent: string;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [why, setWhy] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/personal-intelligence/recs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, why_loved: why.trim() || undefined })
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      setItems(j.items ?? []);
    } catch (e: any) {
      setErr(
        e?.message ||
          "Couldn't generate. Make sure your twin has goals + bio set up."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className="pi-card pi-card-live"
      style={{ position: "relative" }}
    >
      <style>{`
        .pi-card-live {
          padding: 18px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--panel-solid);
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 200px;
        }
        .pi-card-live .icon { font-size: 28px; line-height: 1; }
        .pi-card-live .eyebrow {
          font-size: 10px; font-weight: 800; letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .pi-card-live h3 {
          font-size: 16px; font-weight: 800; letter-spacing: -0.005em;
          margin: 0; line-height: 1.25;
        }
        .pi-card-live p.blurb {
          font-size: 13px; line-height: 1.55; color: var(--text-dim); margin: 0;
        }
        .pi-gen-btn {
          margin-top: 10px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 10px;
          background: var(--text);
          color: var(--bg);
          border: 0;
          cursor: pointer;
          align-self: flex-start;
        }
        .pi-gen-btn:disabled { opacity: 0.6; cursor: wait; }
        .pi-why-toggle {
          background: transparent;
          border: 0;
          color: var(--text-dim);
          font-size: 11px;
          text-decoration: underline;
          padding: 0;
          margin-top: 6px;
          cursor: pointer;
          align-self: flex-start;
        }
        .pi-rec-list {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pi-rec {
          padding: 10px 12px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 10px;
        }
        .pi-rec .title-row {
          display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
        }
        .pi-rec .t { font-weight: 700; font-size: 13.5px; }
        .pi-rec .yr { font-size: 11px; color: var(--text-dim); }
        .pi-rec .why {
          margin-top: 4px;
          font-size: 12px;
          color: var(--text-dim);
          line-height: 1.5;
        }
      `}</style>

      <span className="icon" aria-hidden="true">{icon}</span>
      <span className="eyebrow" style={{ color: accent }}>{eyebrow}</span>
      <h3>{title}</h3>
      <p className="blurb">{blurb}</p>

      {items === null && (
        <>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="pi-gen-btn"
          >
            {busy ? "generating…" : `✨ generate ${kind} for me`}
          </button>
          <button
            type="button"
            onClick={() => setWhyOpen((v) => !v)}
            className="pi-why-toggle"
          >
            {whyOpen ? "hide context" : "add context: tell us one you loved"}
          </button>
          {whyOpen && (
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value.slice(0, 800))}
              rows={3}
              placeholder={`e.g. "Loved Severance because the corporate-existential dread hit way too close to home" — the more specific, the better the picks.`}
              className="retro-input"
              style={{
                marginTop: 6,
                fontSize: 13,
                padding: 8,
                minHeight: 72,
                width: "100%"
              }}
            />
          )}
        </>
      )}

      {err && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>
          {err}
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="pi-rec-list">
            {items.map((it, i) => (
              <div key={i} className="pi-rec">
                <div className="title-row">
                  <span className="t">{it.title}</span>
                  <span className="yr">{it.year}</span>
                </div>
                <div className="why">{it.why}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setItems(null);
              setWhy("");
            }}
            className="pi-why-toggle"
            style={{ alignSelf: "flex-start", marginTop: 8 }}
          >
            ↻ generate again with different context
          </button>
        </>
      )}

      {items && items.length === 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-dim)" }}>
          No picks came back. Try adding more context above.
        </div>
      )}
    </article>
  );
}
