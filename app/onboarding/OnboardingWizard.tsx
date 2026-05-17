"use client";

import { useState } from "react";
import { AiDumpHero } from "./AiDumpHero";
import { Avatar } from "../Avatar";
import { AvatarUpload } from "./AvatarUpload";
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
  { key: "sources", label: "Sources" },
  { key: "ai_dump", label: "AI dump" },
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
      case "sources":
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
                value={state.ai_export_blob}
                onAppend={appendBlob}
              />
            </div>
          </div>
        )}

        {/* STEP 3 — AI dump: paste from ChatGPT/Claude/Gemini/Grok */}
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

            <div className="mt-5">
              <AiDumpHero />
            </div>

            <label className="block mt-5">
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                Paste the AI&apos;s full answer
              </div>
              <textarea
                value={state.ai_export_blob}
                onChange={(e) => set("ai_export_blob", e.target.value)}
                rows={10}
                placeholder="Paste here. Anything you added on the previous step is also in this blob."
                className="retro-input mt-1 font-mono text-sm"
                style={{ minHeight: 240 }}
              />
            </label>
          </div>
        )}

        {/* STEP 4 — Refine: optional fields */}
        {STEPS[step].key === "refine" && (
          <div>
            <div className="retro-label">step 4 of 4</div>
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
