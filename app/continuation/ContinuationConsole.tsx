"use client";

import { useRef, useState } from "react";

type ContinuationLine = { speaker: string; body: string };

type ApiResult = {
  ok?: boolean;
  format?: string;
  you_name?: string | null;
  other_name?: string | null;
  continuation?: ContinuationLine[];
  raw_text?: string;
  error?: string;
  detail?: string;
};

/**
 * Client UI for /continuation (#166). Three states: idle (file or paste),
 * generating (spinner), done (render the modeled next-N messages with
 * a Copy + Share affordance).
 */
export function ContinuationConsole() {
  const [yourName, setYourName] = useState("");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function run(blob: { file?: File; text?: string }) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const form = new FormData();
      if (yourName) form.set("your_name", yourName);
      if (blob.file) form.set("file", blob.file);
      if (blob.text) form.set("text", blob.text);
      const res = await fetch("/api/chat-continuation", {
        method: "POST",
        body: form
      });
      const j: ApiResult = await res.json();
      if (!res.ok || j.error) {
        setErr(j.detail || j.error || "Couldn't generate.");
      } else {
        setResult(j);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Network error.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setErr(null);
    setPasted("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // Copy the rendered continuation as plain text — useful for sharing
  // directly with the counterpart on whatever platform you talk on.
  async function copyAll() {
    if (!result?.continuation?.length) return;
    const head = `Where this is heading (${result.you_name ?? "you"} ↔ ${
      result.other_name ?? "them"
    }):\n\n`;
    const body = result.continuation
      .map((l) => `${l.speaker}: ${l.body}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(head + body);
    } catch {
      /* clipboard may be blocked — copy button just no-ops */
    }
  }

  if (busy) {
    return (
      <div
        className="retro-panel"
        style={{ padding: 20, textAlign: "center" }}
      >
        <div className="text-sm">Reading the thread…</div>
        <div className="retro-dim text-xs mt-2">
          Modeling both voices, projecting the next moves.
        </div>
      </div>
    );
  }

  if (result?.continuation?.length) {
    const isMe = (s: string) =>
      result.you_name && s.toLowerCase() === result.you_name.toLowerCase();
    return (
      <div className="retro-panel" style={{ padding: 16 }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="retro-label">where it goes next</div>
            <div className="text-sm font-semibold mt-1">
              {result.you_name ?? "you"} ↔ {result.other_name ?? "them"}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyAll}
              className="retro-btn text-xs"
            >
              Copy all
            </button>
            <button
              type="button"
              onClick={reset}
              className="retro-btn text-xs"
            >
              Start over
            </button>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: "62dvh",
            overflowY: "auto",
            padding: 4
          }}
        >
          {result.continuation.map((line, i) => {
            const mine = isMe(line.speaker);
            return (
              <div
                key={i}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "min(86%, 560px)"
                }}
              >
                <div
                  className="retro-dim text-[10px]"
                  style={{ textAlign: mine ? "right" : "left", marginBottom: 2 }}
                >
                  {line.speaker}
                </div>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 14,
                    background: mine
                      ? "var(--blue, #2358ff)"
                      : "var(--panel-solid)",
                    color: mine ? "#fff" : "var(--text)",
                    border: mine ? "none" : "1px solid var(--border)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 14,
                    lineHeight: 1.45
                  }}
                >
                  {line.body}
                </div>
              </div>
            );
          })}
        </div>
        <div className="retro-dim text-[11px] mt-3">
          Note: this is a model&apos;s best guess at trajectory based on the
          tone + topics of your real thread. Treat it as a probe — not a
          script — when you actually message them.
        </div>
      </div>
    );
  }

  return (
    <div className="retro-panel" style={{ padding: 16 }}>
      <label className="block">
        <div className="text-sm font-semibold">
          Your name in the conversation (optional but helps)
        </div>
        <input
          value={yourName}
          onChange={(e) => setYourName(e.target.value)}
          placeholder="e.g. Jack"
          className="retro-input mt-1"
        />
      </label>

      <div className="mt-4">
        <div className="text-sm font-semibold">Paste the conversation</div>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={8}
          placeholder={`[3/14/26, 10:14 AM] Jack: hey i had an idea\n[3/14/26, 10:18 AM] Alex: tell me…`}
          className="retro-input mt-1"
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => run({ text: pasted })}
            disabled={!pasted.trim()}
            className="retro-btn retro-btn-primary text-sm"
          >
            Continue from pasted text
          </button>
        </div>
      </div>

      <div
        className="mt-5 pt-4"
        style={{ borderTop: "1px dashed var(--border)" }}
      >
        <div className="text-sm font-semibold">…or upload an export file</div>
        <div className="retro-dim text-xs mt-1">
          iMessage / WhatsApp / Telegram / SMS — any .txt or .csv export will
          work. We never store the file; it&apos;s processed once and
          discarded.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,text/plain,text/csv,.json,application/json"
          className="mt-2 text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void run({ file: f });
          }}
        />
      </div>

      {err && (
        <div
          className="mt-3 text-xs"
          style={{ color: "var(--red, #d44)" }}
        >
          {err}
        </div>
      )}
    </div>
  );
}
