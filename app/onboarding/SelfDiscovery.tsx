"use client";

import { useEffect, useRef, useState } from "react";
import { DotsLoader } from "../DotsLoader";

type Candidate = {
  title: string;
  url: string;
  highlights: string[];
};

/**
 * Step 1 helper. As the user types their name, we debounce and ask Exa for
 * candidates. The user picks "this is me" on the matching card and we pull
 * a clean first-person dossier for them, which the wizard appends to their
 * twin context blob and (optionally) pre-fills their avatar.
 */
export function SelfDiscovery({
  name,
  onConfirm,
  onAdvance
}: {
  name: string;
  onConfirm: (snippet: string, source: string) => void;
  onAdvance?: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearched = useRef<string>("");

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const trimmed = name.trim();
    if (trimmed.length < 4 || trimmed.split(/\s+/).length < 2 || dismissed) {
      setCandidates(null);
      return;
    }
    if (trimmed === lastSearched.current) return;
    debounce.current = setTimeout(() => {
      lastSearched.current = trimmed;
      runSearch(trimmed);
    }, 700);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, dismissed]);

  async function runSearch(q: string) {
    setSearching(true);
    setError(null);
    try {
      const r = await fetch("/api/exa-self-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: q })
      });
      const j = await r.json();
      if (j.candidates) {
        setCandidates(j.candidates.slice(0, 5));
      } else {
        setCandidates([]);
      }
    } catch {
      setError("Couldn't reach the web. You can keep going manually.");
    } finally {
      setSearching(false);
    }
  }

  async function confirmCandidate(c: Candidate) {
    setConfirming(c.url);
    setError(null);
    try {
      const r = await fetch("/api/exa-self-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          confirmed_url: c.url,
          confirmed_title: c.title,
          confirmed_highlights: c.highlights
        })
      });
      const j = await r.json();
      if (j.dossier) {
        onConfirm(j.dossier, c.url);
        setConfirmed(c.url);
        if (onAdvance) {
          // Brief visible confirmation before jumping forward.
          setTimeout(() => onAdvance(), 900);
        }
      } else {
        setError("That didn't pull a usable dossier. Try another card.");
      }
    } catch {
      setError("Couldn't pull the dossier. You can keep going manually.");
    } finally {
      setConfirming(null);
    }
  }

  if (dismissed || confirmed) {
    return confirmed ? (
      <div
        className="retro-panel p-3 text-sm"
        style={{
          borderColor: "var(--green)",
          color: "var(--text)",
          marginTop: 16
        }}
      >
        ✓ Pulled your public footprint. The dossier is in your context now —
        you can review and edit it on the next step.
      </div>
    ) : null;
  }

  if (name.trim().split(/\s+/).length < 2) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <div className="retro-label">is this you?</div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="retro-dim text-xs hover:text-white"
        >
          skip
        </button>
      </div>

      {searching && (
        <div
          className="retro-panel p-3 text-sm mt-2"
          style={{ color: "var(--text-dim)" }}
        >
          <DotsLoader label="Looking you up on the web" />
        </div>
      )}

      {!searching && candidates && candidates.length === 0 && (
        <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
          No public matches yet. That&apos;s fine — keep going and add
          context yourself.
        </p>
      )}

      {!searching && candidates && candidates.length > 0 && (
        <ul className="mt-2 space-y-2">
          {candidates.map((c) => {
            const preview = c.highlights?.[0]
              ? c.highlights[0].length > 130
                ? c.highlights[0].slice(0, 130) + "…"
                : c.highlights[0]
              : "";
            const isLoading = confirming === c.url;
            return (
              <li
                key={c.url}
                className="retro-panel retro-panel-hover p-3 flex items-start gap-3"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-semibold text-sm">{c.title}</div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="retro-dim text-xs underline mt-0.5 inline-block"
                    style={{ wordBreak: "break-all" }}
                  >
                    {c.url}
                  </a>
                  {preview && (
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {preview}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => confirmCandidate(c)}
                  disabled={!!confirming}
                  className="retro-btn retro-btn-primary text-sm shrink-0"
                >
                  {isLoading ? (
                    <DotsLoader label="pulling" />
                  ) : (
                    "✓ this is me"
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p
          className="text-xs mt-2 retro-panel p-2"
          style={{ borderColor: "var(--red)", color: "var(--red)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
