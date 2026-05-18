"use client";

import { useState } from "react";

type Initial = {
  email_address: string;
  on_new_connection: boolean;
  on_new_message: boolean;
  on_agreement_accepted: boolean;
  on_call_scheduled: boolean;
};

type Toggle = {
  name: keyof Omit<Initial, "email_address">;
  label: string;
  blurb: string;
};

const TOGGLES: Toggle[] = [
  {
    name: "on_new_connection",
    label: "New connection",
    blurb:
      "Someone's twin starts a conversation with yours. (Recommended on — this is how you discover wins.)"
  },
  {
    name: "on_new_message",
    label: "New message",
    blurb:
      "Activity in an existing conversation. Debounced to one alert per 30 minutes so the twin-to-twin volleys don't flood your inbox."
  },
  {
    name: "on_agreement_accepted",
    label: "Agreement sealed",
    blurb:
      "Both sides accepted a proposed deal. Take it into the real world from there."
  },
  {
    name: "on_call_scheduled",
    label: "Call scheduled",
    blurb:
      "Your twin locked in a meeting time. We'll send you the calendar invite details."
  }
];

export function NotifPrefsForm({
  initial,
  action,
  defaultEmail
}: {
  initial: Initial;
  action: (formData: FormData) => void;
  defaultEmail: string;
}) {
  const [state, setState] = useState<Initial>(initial);

  return (
    <form action={action} className="mt-6 space-y-5">
      <div>
        <label className="retro-label">Send notifications to</label>
        <input
          type="email"
          name="email_address"
          defaultValue={state.email_address || defaultEmail}
          className="mt-2 w-full retro-input"
          placeholder={defaultEmail || "you@example.com"}
        />
        <p className="mt-1 retro-dim text-xs">
          Defaults to the email on your account. Override here if you want
          notifications to land in a different inbox.
        </p>
      </div>

      <div className="retro-panel divide-y" style={{ borderColor: "var(--border)" }}>
        {TOGGLES.map((t) => (
          <div
            key={t.name}
            className="flex items-start gap-4 p-4"
            style={{ borderColor: "var(--border)" }}
          >
            <label className="flex items-center cursor-pointer pt-1">
              <input
                type="checkbox"
                name={t.name}
                checked={state[t.name]}
                onChange={(e) =>
                  setState((s) => ({ ...s, [t.name]: e.target.checked }))
                }
                className="sr-only peer"
              />
              <span
                className="relative inline-block w-11 h-6 rounded-full transition-colors"
                style={{
                  background: state[t.name]
                    ? "var(--amber-bright)"
                    : "var(--border)"
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                  style={{
                    transform: state[t.name]
                      ? "translateX(20px)"
                      : "translateX(0)"
                  }}
                />
              </span>
            </label>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">{t.label}</div>
              <p className="mt-0.5 retro-dim text-xs">{t.blurb}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="retro-btn retro-btn-primary">
          Save settings
        </button>
        <span className="retro-dim text-xs">
          You can change these any time. Notifications are batched per recipient
          and never sent twice for the same event.
        </span>
      </div>
    </form>
  );
}
