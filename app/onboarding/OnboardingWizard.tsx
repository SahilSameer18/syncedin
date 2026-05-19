"use client";

import { useEffect, useRef, useState } from "react";
import { AiDumpHero } from "./AiDumpHero";
import { Avatar } from "../Avatar";
import { AvatarUpload } from "./AvatarUpload";
import { ContextSources, type Snippet } from "./ContextSources";
import { SelfDiscovery } from "./SelfDiscovery";
import { saveTwin } from "./actions";

// Parse existing ai_export_blob back into structured snippets so the wizard
// can rehydrate URL-sourced context across page reloads. Snippets were
// originally appended as `# {label} ({source})\n{text}` blocks.
function parseSnippets(blob: string): {
  snippets: Snippet[];
  aiDump: string;
} {
  if (!blob.trim()) return { snippets: [], aiDump: "" };
  const sections = blob.split(/\n\n+(?=#\s+)/g);
  const snippets: Snippet[] = [];
  let aiDump = "";
  for (const raw of sections) {
    const m = raw.match(/^#\s+(.+?)\s+\((.+?)\)\s*\n([\s\S]+)$/);
    if (m) {
      snippets.push({
        id: Math.random().toString(36).slice(2, 10),
        label: m[1].trim(),
        source: m[2].trim(),
        text: m[3].trim()
      });
    } else {
      // Anything that doesn't match the header pattern is the AI dump.
      aiDump = aiDump
        ? `${aiDump}\n\n${raw.trim()}`
        : raw.trim();
    }
  }
  return { snippets, aiDump };
}

// Serialize back to the blob shape on save.
function serializeBlob(snippets: Snippet[], aiDump: string): string {
  const parts: string[] = [];
  for (const s of snippets) {
    if (s.text.trim())
      parts.push(`# ${s.label} (${s.source})\n${s.text.trim()}`);
  }
  if (aiDump.trim()) parts.push(aiDump.trim());
  return parts.join("\n\n");
}

type Initial = {
  display_name: string;
  goals: string;
  deal_preferences: string;
  communication_style: string;
  deal_breakers: string;
  ai_export_blob: string;
  avatar_url: string;
  hometown: string;
  current_city: string;
};

const STEPS = [
  { key: "you", label: "You" },
  { key: "sources", label: "Sources" },
  { key: "ai_dump", label: "AI memory" },
  { key: "refine", label: "Refine" }
] as const;

export function OnboardingWizard({
  initial,
  userId
}: {
  initial: Initial;
  userId: string;
}) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<Initial>(initial);
  const set = <K extends keyof Initial>(k: K, v: Initial[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  // Hydrate URL snippets + AI dump from the existing blob on first mount.
  const initialParsed = useRef(parseSnippets(initial.ai_export_blob || ""));
  const [snippets, setSnippets] = useState<Snippet[]>(
    initialParsed.current.snippets
  );
  const [aiDump, setAiDump] = useState<string>(
    initialParsed.current.aiDump
  );

  // Keep ai_export_blob in state synchronized with snippets + aiDump
  // so the hidden form input always submits the latest combined blob.
  useEffect(() => {
    setState((s) => ({
      ...s,
      ai_export_blob: serializeBlob(snippets, aiDump)
    }));
  }, [snippets, aiDump]);

  // Persistent draft save.
  //
  // Two layers so paste-and-navigate never drops the AI memory blob:
  //  1. Debounced fetch on every state change (700ms). Catches the common
  //     "user types, pauses, keeps typing" case.
  //  2. navigator.sendBeacon on pagehide + visibilitychange + beforeunload.
  //     sendBeacon is fire-and-forget and the browser GUARANTEES delivery
  //     even when the page is unloading — which is exactly when fetch()
  //     gets cancelled.
  //
  // The ref always holds the latest serialized payload so the beacon
  // handlers can read it synchronously without stale-closure issues.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayload = useRef<string>("");
  useEffect(() => {
    const payload = JSON.stringify({
      display_name: state.display_name,
      avatar_url: state.avatar_url,
      goals: state.goals,
      deal_preferences: state.deal_preferences,
      communication_style: state.communication_style,
      deal_breakers: state.deal_breakers,
      ai_export_blob: state.ai_export_blob,
      hometown: state.hometown,
      current_city: state.current_city
    });
    latestPayload.current = payload;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/save-twin-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: payload
      }).catch(() => {
        /* fire-and-forget; the beacon below also covers us */
      });
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  // Beacon-on-unload — guarantees the latest draft hits the server even when
  // fetch() would be cancelled mid-flight by navigation.
  useEffect(() => {
    function flush() {
      const payload = latestPayload.current;
      if (!payload) return;
      try {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon("/api/save-twin-draft", blob);
        } else {
          fetch("/api/save-twin-draft", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload,
            keepalive: true
          }).catch(() => {});
        }
      } catch {
        /* never throw during unload */
      }
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Append a snippet (used by SelfDiscovery after "this is me" confirm)
  function appendBlob(text: string, label: string, source: string) {
    setSnippets((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 10),
        label,
        source,
        text
      }
    ]);
  }

  const canAdvance = (() => {
    switch (STEPS[step].key) {
      case "you":
        return state.display_name.trim().length > 0;
      case "sources":
        return state.goals.trim().length > 0;
      default:
        return true;
    }
  })();

  // Reusable nav row — small + sticky-friendly version goes at the top,
  // full version at the bottom. Kept in a function so they stay in lockstep.
  const NavRow = ({ compact = false }: { compact?: boolean }) => (
    <div
      className={`flex items-center justify-between ${
        compact ? "mb-3" : "mt-5"
      }`}
    >
      <button
        type="button"
        onClick={() => setStep((s) => Math.max(0, s - 1))}
        disabled={step === 0}
        className={compact ? "retro-btn text-xs" : "retro-btn"}
        style={{ visibility: step === 0 ? "hidden" : "visible" }}
      >
        ← back
      </button>
      <div
        className={compact ? "retro-dim text-[10px]" : "retro-dim text-xs"}
        style={{ color: "var(--text-dim)" }}
      >
        {step + 1} / {STEPS.length}
      </div>
      {step < STEPS.length - 1 ? (
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={!canAdvance}
          className={
            compact
              ? "retro-btn retro-btn-primary text-xs"
              : "retro-btn retro-btn-primary"
          }
        >
          continue →
        </button>
      ) : (
        <button
          type="submit"
          disabled={!state.display_name.trim() || !state.goals.trim()}
          className={
            compact
              ? "retro-btn retro-btn-primary text-xs"
              : "retro-btn retro-btn-primary"
          }
        >
          {compact ? "save twin →" : "Save twin & go to dashboard"}
        </button>
      )}
    </div>
  );

  return (
    <form
      action={saveTwin}
      id="onboarding-form"
      // Hard guard: Enter inside a single-line input must NOT submit the form
      // and bounce the user to /dashboard mid-refine. Textareas keep Enter
      // (it's a newline), explicit submit click still works.
      onKeyDown={(e) => {
        const t = e.target as HTMLElement;
        if (
          e.key === "Enter" &&
          t.tagName !== "TEXTAREA" &&
          !(t.tagName === "BUTTON" && (t as HTMLButtonElement).type === "submit")
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="display_name" value={state.display_name} />
      <input type="hidden" name="goals" value={state.goals} />
      <input
        type="hidden"
        name="deal_preferences"
        value={state.deal_preferences}
      />
      <input
        type="hidden"
        name="communication_style"
        value={state.communication_style}
      />
      <input type="hidden" name="deal_breakers" value={state.deal_breakers} />
      <input
        type="hidden"
        name="ai_export_blob"
        value={state.ai_export_blob}
      />
      <input type="hidden" name="avatar_url" value={state.avatar_url} />
      <input type="hidden" name="hometown" value={state.hometown} />
      <input type="hidden" name="current_city" value={state.current_city} />

      {/* Progress strip — step pills LEFT, continue/back nav RIGHT, all in
          a single row so the user never has to look around for "what next".
          We deliberately drop flex-wrap on the outer row + collapse the
          back button to a single arrow on the inline strip, so the row
          stays one line and Continue sits flush-right of the last pill. */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div
          className="flex items-center gap-2 flex-wrap"
          style={{ minWidth: 0, flex: "1 1 auto" }}
        >
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i <= step && setStep(i)}
                className="flex items-center gap-2"
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  cursor: i <= step ? "pointer" : "default",
                  opacity: i > step ? 0.55 : 1
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: `2px solid ${
                      current || done
                        ? "var(--amber)"
                        : "var(--border-bright)"
                    }`,
                    background: done
                      ? "var(--amber)"
                      : current
                      ? "var(--panel-solid)"
                      : "transparent",
                    color: done ? "#fff" : "var(--text)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className="text-sm"
                  style={{
                    color: current
                      ? "var(--text)"
                      : "var(--text-dim)",
                    fontWeight: current ? 700 : 500
                  }}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  style={{
                    width: 28,
                    height: 1,
                    background: "var(--border-bright)"
                  }}
                />
              )}
            </div>
          );
        })}
        </div>
        <div
          className="flex items-center gap-2 shrink-0"
          style={{ marginLeft: 8 }}
        >
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="retro-btn text-xs"
            style={{
              visibility: step === 0 ? "hidden" : "visible",
              padding: "6px 10px"
            }}
            aria-label="Back"
          >
            ←
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                setStep((s) => Math.min(STEPS.length - 1, s + 1))
              }
              disabled={!canAdvance}
              className="retro-btn retro-btn-primary text-xs"
              style={{ padding: "6px 14px" }}
            >
              continue →
            </button>
          ) : (
            <button
              type="submit"
              disabled={!state.display_name.trim() || !state.goals.trim()}
              className="retro-btn retro-btn-primary text-xs"
              style={{ padding: "6px 14px" }}
            >
              save twin →
            </button>
          )}
        </div>
      </div>

      <div className="retro-panel retro-shadow p-6">
        {/* STEP 1 — You: name + photo together */}
        {STEPS[step].key === "you" && (
          <div>
            <div className="retro-label">step 1 of 3</div>
            <h2 className="retro-h1 text-2xl mt-2">Let&apos;s start with you.</h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
              Two fields. Both used to make your twin recognizable to other
              people on SyncedIn.
            </p>

            <div className="mt-6 space-y-5">
              <label className="block">
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Your name
                </div>
                <input
                  autoFocus
                  value={state.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  placeholder="Jane Doe"
                  className="retro-input mt-1"
                />
              </label>
              <div>
                <div
                  className="text-sm font-semibold mb-2"
                  style={{ color: "var(--text)" }}
                >
                  Your photo (optional)
                </div>
                <AvatarUpload
                  id={userId}
                  name={state.display_name}
                  value={state.avatar_url}
                  onChange={(next) => set("avatar_url", next)}
                />
              </div>
            </div>

            {/* Location signals — used to bias web search toward people in
                your geographic orbit (hometown roots + current city). */}
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <label className="block">
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Where do you live now?
                </div>
                <input
                  value={state.current_city}
                  onChange={(e) => set("current_city", e.target.value)}
                  placeholder="San Francisco, CA"
                  className="retro-input mt-1"
                />
                <p className="text-xs mt-1 retro-dim">
                  We&apos;ll prioritize people near you in discovery.
                </p>
              </label>
              <label className="block">
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Where are you from?
                </div>
                <input
                  value={state.hometown}
                  onChange={(e) => set("hometown", e.target.value)}
                  placeholder="Detroit, MI"
                  className="retro-input mt-1"
                />
                <p className="text-xs mt-1 retro-dim">
                  Hometown context for finding people from your roots.
                </p>
              </label>
            </div>

            {/* Intelligent auto-discovery — finds you on the web and pulls
                a clean dossier into your context if you confirm. Auto-jumps
                to the next step after a successful "this is me" pick. */}
            <SelfDiscovery
              name={state.display_name}
              onConfirm={(snippet, source) =>
                appendBlob(snippet, "Public footprint", source)
              }
              onAdvance={() =>
                setStep((s) => Math.min(STEPS.length - 1, s + 1))
              }
            />
          </div>
        )}

        {/* STEP 2 — Sources: goals + URL-based context */}
        {STEPS[step].key === "sources" && (
          <div>
            <div className="retro-label">step 2 of 4</div>
            <h2 className="retro-h1 text-2xl mt-2">
              Where can your twin learn about you?
            </h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
              Your goals are required. Add LinkedIn, X, Instagram, or any
              URL that describes you — paste a handle or full link, we&apos;ll
              normalize it.
            </p>

            <div className="mt-6 space-y-6">
              <label className="block">
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Goals — what are you trying to accomplish right now? *
                </div>
                <textarea
                  value={state.goals}
                  onChange={(e) => set("goals", e.target.value)}
                  rows={4}
                  placeholder="e.g. Raising my Series A. Hiring a Head of Design. Finding builders to take over my open-source projects."
                  className="retro-input mt-1"
                  style={{ minHeight: 110 }}
                />
              </label>

              <ContextSources
                snippets={snippets}
                onChange={setSnippets}
              />
            </div>
          </div>
        )}

        {/* STEP 3 — AI memory: paste from ChatGPT/Claude/Gemini/Grok */}
        {STEPS[step].key === "ai_dump" && (
          <div>
            <div className="retro-label">step 3 of 4</div>
            <h2 className="retro-h1 text-2xl mt-2">
              Let the AI you already use describe you.
            </h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
              The AI you already talk to knows your goals, voice, and how
              you think. Copy the prompt, open your AI, paste the answer
              below. Skip if you already added enough from sources.
            </p>

            {/* If they've already pasted something in a prior session, don't
                blast them with the full "how to do this" hero on re-entry —
                show a tiny "redo it" chip and put the textarea front-and-
                center. New users (empty dump) still see the full hero. */}
            {aiDump.trim().length > 0 ? (
              <div className="mt-5">
                <details>
                  <summary
                    className="text-xs cursor-pointer inline-flex items-center gap-2 retro-panel"
                    style={{
                      padding: "8px 12px",
                      color: "var(--text-dim)",
                      listStyle: "none"
                    }}
                  >
                    <span style={{ color: "var(--green)" }}>✓</span>
                    <span>
                      AI memory saved ({aiDump.trim().length.toLocaleString()}{" "}
                      chars). Click to redo with a fresh prompt.
                    </span>
                  </summary>
                  <div className="mt-3">
                    <AiDumpHero />
                  </div>
                </details>
              </div>
            ) : (
              <div className="mt-5">
                <AiDumpHero />
              </div>
            )}

            <label className="block mt-5">
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                {aiDump.trim().length > 0
                  ? "Your AI memory (edit anytime)"
                  : "Paste the AI's full answer"}
              </div>
              <textarea
                value={aiDump}
                onChange={(e) => setAiDump(e.target.value)}
                onBlur={() => {
                  // Force-flush the latest draft immediately when the
                  // textarea loses focus — guards against losing a fresh
                  // paste if the user navigates within the 700ms debounce.
                  try {
                    const payload = latestPayload.current;
                    if (!payload) return;
                    if (
                      typeof navigator !== "undefined" &&
                      navigator.sendBeacon
                    ) {
                      navigator.sendBeacon(
                        "/api/save-twin-draft",
                        new Blob([payload], { type: "application/json" })
                      );
                    }
                  } catch {
                    /* never throw */
                  }
                }}
                rows={10}
                placeholder="Paste here. Snippets you added on the Sources step are kept separately and remain editable there."
                className="retro-input mt-1 font-mono text-sm"
                style={{ minHeight: 240 }}
              />
            </label>
          </div>
        )}

        {/* STEP 4 — Refine: deeper questions for twin-to-twin negotiation */}
        {STEPS[step].key === "refine" && (
          <div>
            <div className="retro-label">step 4 of 4</div>
            <h2 className="retro-h1 text-2xl mt-2">
              Calibrate the negotiator inside your twin.
            </h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
              All optional, all extremely useful. The more honest you are
              here, the better your twin filters opportunities you&apos;ll
              actually say yes to, and protects you from the ones you
              won&apos;t. Write as much or as little as you want.
            </p>
            <div className="mt-5 space-y-5">
              <DeepField
                label="What kind of person, opportunity, or conversation makes you say YES instantly?"
                helper="Past collaborations that worked, founders or builders you admire, the texture of an intro that feels right. What's the kindest signal someone can send that they're worth your time?"
                placeholder={`e.g. Operators who've already shipped something hard. People who lead with a specific problem they're stuck on rather than a generic intro request. Anyone working in [your domain] who actually built rather than just opined.`}
                rows={5}
                value={state.deal_preferences}
                onChange={(v) => set("deal_preferences", v)}
              />
              <DeepField
                label="How do you want to be approached, talked to, and pushed back on?"
                helper="Length, tone, formality, frequency. Do you want your twin to be sharp or warm, fast or considered? When someone disagrees with you, what's the version of pushback that lands? What's the version that makes you withdraw?"
                placeholder={`e.g. Short and direct. Lead with the point, not the warm-up. Push back hard if my reasoning is weak; don't be polite about it. Avoid em-dashes and corporate hedging.`}
                rows={4}
                value={state.communication_style}
                onChange={(v) => set("communication_style", v)}
              />
              <DeepField
                label="What makes you walk away from a conversation? What lines won't you cross?"
                helper="The categorical no-gos AND the soft no-gos. Topics, behaviors, value mismatches, time-wasters. What does a 'great' bad-fit person look like, so your twin can decline gracefully?"
                placeholder={`e.g. Anyone trying to sell me their service in the first message. Pitch decks before a conversation. People who can't name a specific thing they're working on. Long Zoom asks from strangers.`}
                rows={4}
                value={state.deal_breakers}
                onChange={(v) => set("deal_breakers", v)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav row */}
      <NavRow />
    </form>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="retro-input mt-1"
      />
    </label>
  );
}

function DeepField({
  label,
  helper,
  placeholder,
  rows,
  value,
  onChange
}: {
  label: string;
  helper: string;
  placeholder: string;
  rows: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div
        className="text-base font-semibold"
        style={{ color: "var(--text)" }}
      >
        {label}
      </div>
      <div
        className="text-xs mt-1.5 leading-relaxed"
        style={{ color: "var(--text-dim)" }}
      >
        {helper}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="retro-input mt-2"
        style={{ minHeight: rows * 24 }}
      />
    </label>
  );
}
