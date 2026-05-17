"use client";

import { useState } from "react";
import { AiDumpHero } from "./AiDumpHero";
import { Avatar } from "../Avatar";
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
  { key: "name", label: "Name" },
  { key: "context", label: "Context" },
  { key: "goals", label: "Goals" },
  { key: "avatar", label: "Photo" },
  { key: "details", label: "Detail" }
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

  const canAdvance = (() => {
    switch (STEPS[step].key) {
      case "name":
        return state.display_name.trim().length > 0;
      case "goals":
        return state.goals.trim().length > 0;
      default:
        return true; // context, avatar, details are all optional past name+goals
    }
  })();

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
  }
  function back() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <form action={saveTwin} id="onboarding-form">
      {/* Hidden inputs carry the entire state forward on submit. We use the
          real form action `saveTwin` via server action below the form button. */}
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

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(i)}
                disabled={i > step && !canAdvance && i !== step}
                className="flex items-center gap-2"
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  cursor: i <= step ? "pointer" : "not-allowed",
                  opacity: i > step ? 0.55 : 1
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
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
                  className="text-xs"
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
                    width: 18,
                    height: 1,
                    background: "var(--border-bright)"
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step body */}
      <div className="retro-panel retro-shadow p-6 min-h-[320px]">
        {STEPS[step].key === "name" && (
          <div>
            <div className="retro-label">step 1 of 5</div>
            <h2 className="retro-h1 text-2xl mt-2">
              What should your twin call itself?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--text-dim)" }}
            >
              This is the name other people see when your clone shows up in
              their inbox. Your real name is usually best.
            </p>
            <input
              autoFocus
              value={state.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              placeholder="Jane Doe"
              className="retro-input mt-5"
            />
          </div>
        )}

        {STEPS[step].key === "context" && (
          <div>
            <div className="retro-label">step 2 of 5</div>
            <h2 className="retro-h1 text-2xl mt-2">
              Hand your twin everything it needs to be you.
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--text-dim)" }}
            >
              The AI you already use knows your goals, voice, and how you
              think. Copy the prompt below, paste it into your favorite AI,
              then paste its answer here. More context = sharper twin.
            </p>
            <div className="mt-4">
              <AiDumpHero />
            </div>
            <textarea
              value={state.ai_export_blob}
              onChange={(e) => set("ai_export_blob", e.target.value)}
              rows={10}
              placeholder="Paste the AI's full answer here. No length limit, more is better."
              className="retro-input mt-4 font-mono text-sm"
              style={{ minHeight: 200 }}
            />
            <div
              className="retro-dim text-xs mt-2"
              style={{ color: "var(--text-dim)" }}
            >
              Optional. You can skip this and your twin will still work using
              the goals on the next step.
            </div>
          </div>
        )}

        {STEPS[step].key === "goals" && (
          <div>
            <div className="retro-label">step 3 of 5</div>
            <h2 className="retro-h1 text-2xl mt-2">
              What are you trying to accomplish right now?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--text-dim)" }}
            >
              The single most important field. Your twin uses this to know
              what conversations to pursue and what to skip.
            </p>
            <textarea
              autoFocus
              value={state.goals}
              onChange={(e) => set("goals", e.target.value)}
              rows={6}
              placeholder="e.g. Raising my Series A. Looking for biotech CEOs interested in… etc."
              className="retro-input mt-5"
              style={{ minHeight: 160 }}
            />
          </div>
        )}

        {STEPS[step].key === "avatar" && (
          <div>
            <div className="retro-label">step 4 of 5</div>
            <h2 className="retro-h1 text-2xl mt-2">
              How should your twin look?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--text-dim)" }}
            >
              Paste a public image URL (LinkedIn photo, headshot, etc) or
              skip and your twin keeps its gradient placeholder.
            </p>
            <div className="mt-5 flex items-center gap-5">
              <Avatar
                id={userId}
                name={state.display_name || "you"}
                avatarUrl={state.avatar_url || null}
                size={96}
              />
              <div className="flex-1">
                <input
                  value={state.avatar_url}
                  onChange={(e) => set("avatar_url", e.target.value)}
                  placeholder="https://..."
                  className="retro-input"
                />
                <div
                  className="retro-dim text-xs mt-2"
                  style={{ color: "var(--text-dim)" }}
                >
                  Tip: open your LinkedIn profile photo, right-click → Copy
                  Image Address.
                </div>
              </div>
            </div>
          </div>
        )}

        {STEPS[step].key === "details" && (
          <div>
            <div className="retro-label">step 5 of 5</div>
            <h2 className="retro-h1 text-2xl mt-2">
              Sharpen your twin (optional).
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--text-dim)" }}
            >
              Three optional fields. Each one makes your twin a better
              negotiator on your behalf. Skip any and you can come back to
              edit later.
            </p>
            <div className="mt-5 space-y-4">
              <Field
                label="Deal preferences — what partnerships, deals, or intros do you want?"
                value={state.deal_preferences}
                onChange={(v) => set("deal_preferences", v)}
              />
              <Field
                label="Communication style — how do you write? (concise / warm / direct / formal)"
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

      {/* Nav buttons */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="retro-btn"
          style={{ visibility: step === 0 ? "hidden" : "visible" }}
        >
          ← back
        </button>
        <div
          className="retro-dim text-xs"
          style={{ color: "var(--text-dim)" }}
        >
          {step + 1} / {STEPS.length}
        </div>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
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
            formAction={undefined}
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
      <div className="text-sm" style={{ color: "var(--text)" }}>
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
