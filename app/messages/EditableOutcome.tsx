"use client";

import { useRef, useState } from "react";

/**
 * EditableOutcome — the proposal outcome shown on each Messages row,
 * directly editable in place (Jack: "make this an editable text box … I
 * don't even need to click edit"). Auto-saves on blur via the same
 * change-proposal endpoint. Locks to read-only once the user has accepted
 * ("unless it's accepted").
 */
export function EditableOutcome({
  conversationId,
  initialText,
  accepted
}: {
  conversationId: string;
  initialText: string;
  accepted: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const saved = useRef(initialText);

  if (accepted) {
    return (
      <div style={{ marginTop: 6 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--green)"
          }}
        >
          ✓ accepted outcome
        </div>
        <div className="text-xs mt-0.5" style={{ lineHeight: 1.45 }}>
          {initialText}
        </div>
      </div>
    );
  }

  async function save() {
    const next = text.trim();
    if (!next || next === saved.current.trim()) return;
    setState("saving");
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/change-proposal`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: next })
        }
      );
      if (!res.ok) throw new Error();
      saved.current = next;
      setState("saved");
      setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("idle");
    }
  }

  return (
    <div
      style={{ marginTop: 6 }}
      // Keep clicks/typing here from triggering the row's navigation.
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--amber-bright)",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        ✎ editable outcome
        {state === "saving" && (
          <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>
            saving…
          </span>
        )}
        {state === "saved" && (
          <span style={{ color: "var(--green)", fontWeight: 700 }}>saved ✓</span>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={Math.min(6, Math.max(2, Math.ceil(text.length / 70)))}
        className="retro-input"
        style={{
          marginTop: 4,
          fontSize: 13,
          lineHeight: 1.45,
          width: "100%",
          resize: "vertical"
        }}
      />
    </div>
  );
}
