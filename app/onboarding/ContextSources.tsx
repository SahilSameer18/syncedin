"use client";

import { useState } from "react";
import { DotsLoader } from "../DotsLoader";

type Extracted = {
  label: string;
  source: string;
  extracted_text: string;
};

const QUICK_TYPES = [
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/your-handle",
    icon: "💼"
  },
  {
    key: "x",
    label: "X / Twitter",
    placeholder: "https://x.com/your-handle",
    icon: "𝕏"
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/your-handle",
    icon: "📸"
  },
  {
    key: "url",
    label: "Any URL",
    placeholder: "https://anywhere.com/about-you",
    icon: "🌐"
  }
];

/**
 * Onboarding context-source picker.
 *
 * For each source the user can paste a URL, we fetch it via Exa, hand to
 * Claude for a clean first-person snippet, and append it to the value
 * controlled by the wizard. The wizard re-renders the SelfGraph automatically.
 */
export function ContextSources({
  value,
  onAppend
}: {
  value: string;
  onAppend: (snippet: string, label: string, source: string) => void;
}) {
  const [active, setActive] = useState<string>("linkedin");
  const [input, setInput] = useState("");
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Extracted[]>([]);

  const current = QUICK_TYPES.find((t) => t.key === active) ?? QUICK_TYPES[0];

  async function submitUrl() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/extract-context-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "url", value: input.trim() })
      });
      const j = await r.json();
      if (j.error) {
        setError(j.detail || j.error);
        return;
      }
      const ex = j as Extracted;
      setHistory((h) => [...h, ex]);
      onAppend(ex.extracted_text, ex.label, ex.source);
      setInput("");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRaw() {
    if (!pasted.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/extract-context-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "raw", value: pasted.trim() })
      });
      const j = await r.json();
      if (j.error) {
        setError(j.detail || j.error);
        return;
      }
      const ex = j as Extracted;
      setHistory((h) => [...h, ex]);
      onAppend(ex.extracted_text, ex.label, ex.source);
      setPasted("");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="retro-label">add context from anywhere</div>
      <p
        className="text-xs mt-1"
        style={{ color: "var(--text-dim)" }}
      >
        Paste a URL from a profile or page that describes you. We&apos;ll
        fetch it, clean it, and feed it to your twin.
      </p>

      {/* Source type tabs */}
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className="retro-btn text-xs"
            style={{
              padding: "8px 14px",
              borderColor:
                active === t.key
                  ? "var(--amber)"
                  : "var(--border-bright)",
              background:
                active === t.key
                  ? "var(--panel-solid)"
                  : "var(--panel-2)",
              boxShadow:
                active === t.key
                  ? "0 0 0 2px var(--accent-glow)"
                  : undefined
            }}
          >
            <span style={{ marginRight: 6 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* URL input row */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitUrl();
            }
          }}
          placeholder={current.placeholder}
          className="retro-input flex-1"
        />
        <button
          type="button"
          onClick={submitUrl}
          disabled={loading || !input.trim()}
          className="retro-btn retro-btn-primary shrink-0"
        >
          {loading ? <DotsLoader label="fetching" /> : "+ add"}
        </button>
      </div>

      {/* Or paste raw text */}
      <details className="mt-3">
        <summary
          className="text-xs cursor-pointer"
          style={{ color: "var(--text-dim)" }}
        >
          or paste text from a post, screenshot caption, anywhere
        </summary>
        <div className="mt-2">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={5}
            placeholder="Paste any text about you here. Tweets, captions, an article you wrote, OCR from a screenshot, anything."
            className="retro-input text-sm"
          />
          <button
            type="button"
            onClick={submitRaw}
            disabled={loading || !pasted.trim()}
            className="retro-btn mt-2"
          >
            {loading ? <DotsLoader label="processing" /> : "+ add this"}
          </button>
        </div>
      </details>

      {error && (
        <div
          className="mt-3 text-xs retro-panel p-3"
          style={{ borderColor: "var(--red)", color: "var(--red)" }}
        >
          {error}
        </div>
      )}

      {/* History of what was extracted */}
      {history.length > 0 && (
        <div className="mt-4">
          <div
            className="retro-label"
            style={{ color: "var(--amber-bright)" }}
          >
            added so far ({history.length})
          </div>
          <ul className="mt-2 space-y-2">
            {history.map((h, i) => (
              <li
                key={i}
                className="retro-panel p-3 text-xs"
              >
                <div
                  className="font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  {h.label}
                </div>
                <div
                  className="retro-dim mt-0.5"
                  style={{ wordBreak: "break-all" }}
                >
                  {h.source}
                </div>
                <div
                  className="mt-1"
                  style={{ color: "var(--text-dim)" }}
                >
                  {h.extracted_text.slice(0, 140)}
                  {h.extracted_text.length > 140 ? "…" : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
