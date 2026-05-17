"use client";

import { useState } from "react";
import { AiDumpHero } from "./AiDumpHero";
import { Avatar } from "../Avatar";
import { ContextSources } from "./ContextSources";
import { SelfDiscovery } from "./SelfDiscovery";
import { saveTwin } from "./actions";

type Initial = {
  display_name: string;
  goals: string;
  deal_preferences: string;
  communication_style: string;
  deal_breakers: string;
  ai_export_blob: string;
  avatar_url: string;
};

const STEPS = [
  { key: "you", label: "You" },
  { key: "context", label: "Context" },
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

  // Append a snippet from ContextSources to the running blob.
  function appendBlob(snippet: string, label: string, source: string) {
    const stamp = `\n\n# ${label} (${source})\n${snippet}`.trim();
    setState((s) => ({
      ...s,
      ai_export_blob: (s.ai_export_blob + "\n\n" + stamp).trim()
    }));
  }

  const canAdvance = (() => {
    switch (STEPS[step].key) {
      case "you":
        return state.display_name.trim().length > 0;
      case "context":
        return state.goals.trim().length > 0;
      default:
        return true;
    }
  })();

  return (
    <form action={saveTwin} id="onboarding-form">
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

      {/* Progress strip */}
      <div className="flex items-center gap-2 mb-6">
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

            <div className="mt-6 grid sm:grid-cols-[auto_1fr] gap-6 items-start">
              <div className="flex flex-col items-center gap-2">
                <Avatar
                  id={userId}
                  name={state.display_name || "you"}
                  avatarUrl={state.avatar_url || null}
                  size={120}
                />
                <div
                  className="retro-dim text-[11px] text-center"
                  style={{ color: "var(--text-dim)" }}
                >
                  preview
                </div>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
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
                <label className="block">
                  <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    Photo URL (optional)
                  </div>
                  <input
                    value={state.avatar_url}
                    onChange={(e) => set("avatar_url", e.target.value)}
                    placeholder="https://...   or skip and use the gradient placeholder"
                    className="retro-input mt-1"
                  />
                  <div
                    className="text-xs mt-1"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Tip: open your LinkedIn profile photo, right-click → Copy
                    Image Address.
                  </div>
                </label>
              </div>
            </div>

            {/* Intelligent auto-discovery — finds you on the web and pulls
                a clean dossier into your context if you confirm. */}
            <SelfDiscovery
              name={state.display_name}
              onConfirm={(snippet, source) =>
                appendBlob(snippet, "Public footprint", source)
              }
            />
          </div>
        )}

        {/* STEP 2 — Context: goals + multiple ways to feed context in */}
        {STEPS[step].key === "context" && (
          <div>
            <div className="retro-label">step 2 of 3</div>
            <h2 className="retro-h1 text-2xl mt-2">
              Hand your twin everything it needs to be you.
            </h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
              The more you give, the sharper it gets. Your goals are required.
              Everything else is optional but powerful.
            </p>

            <div className="mt-6 space-y-6">
              {/* Required: goals */}
              <label className="block">
                <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
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

              {/* Easy paths to add context */}
              <ContextSources
                value={state.ai_export_blob}
                onAppend={appendBlob}
              />

              {/* AI export — original fast path */}
              <details>
                <summary
                  className="text-sm cursor-pointer"
                  style={{ color: "var(--text-dim)" }}
                >
                  or paste the answer from ChatGPT / Claude / Gemini / Grok
                </summary>
                <div className="mt-3">
                  <AiDumpHero />
                  <textarea
                    value={state.ai_export_blob}
                    onChange={(e) => set("ai_export_blob", e.target.value)}
                    rows={10}
                    placeholder="Paste the AI's full answer here. Anything you've added from sources above will also show up here."
                    className="retro-input mt-4 font-mono text-sm"
                    style={{ minHeight: 200 }}
                  />
                </div>
              </details>
            </div>
          </div>
        )}

        {/* STEP 3 — Refine: optional fields */}
        {STEPS[step].key === "refine" && (
          <div>
            <div className="retro-label">step 3 of 3</div>
            <h2 className="retro-h1 text-2xl mt-2">Sharpen your twin (optional).</h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
              These three fields make your twin a better negotiator on your
              behalf. Skip any and you can come back later.
            </p>
            <div className="mt-5 space-y-4">
              <Field
                label="Deal preferences — what partnerships, deals, or intros do you want?"
                value={state.deal_preferences}
                onChange={(v) => set("deal_preferences", v)}
              />
              <Field
                label="Communication style — concise / warm / direct / formal?"
                value={state.communication_style}
                onChange={(v) => set("communication_style", v)}
              />
              <Field
                label="Deal breakers — what won't you do?"
                value={state.deal_breakers}
                onChange={(v) => set("deal_breakers", v)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Nav row */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="retro-btn"
          style={{ visibility: step === 0 ? "hidden" : "visible" }}
        >
          ← back
        </button>
        <div className="retro-dim text-xs" style={{ color: "var(--text-dim)" }}>
          {step + 1} / {STEPS.length}
        </div>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canAdvance}
            className="retro-btn retro-btn-primary"
          >
            continue →
          </button>
        ) : (
          <button
            type="submit"
            disabled={!state.display_name.trim() || !state.goals.trim()}
            className="retro-btn retro-btn-primary"
          >
            Save twin &amp; go to dashboard
          </button>
        )}
      </div>
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
