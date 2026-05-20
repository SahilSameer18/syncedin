"use client";

import { useEffect, useState } from "react";
import { SyncMeter } from "../SyncMeter";
import type { SyncInputs } from "@/lib/sync-score";

/**
 * LiveSyncMeter — wraps SyncMeter and listens to the onboarding form's
 * input events so the silhouette fills in real time as the user adds
 * context. The more they upload, the higher the fill rises and the more
 * the power-core gradient glows. Same data-source pattern SelfGraph uses
 * (DOM form scrape + input event listener) so behavior is consistent.
 */
export function LiveSyncMeter({
  formSelector = "form",
  size = 220
}: {
  formSelector?: string;
  size?: number;
}) {
  const [inputs, setInputs] = useState<SyncInputs>({});

  useEffect(() => {
    function readForm(): SyncInputs {
      if (typeof document === "undefined") return {};
      const form = document.querySelector(
        formSelector
      ) as HTMLFormElement | null;
      if (!form) return {};
      const get = (name: string): string => {
        const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          `[name="${name}"]`
        );
        return el?.value ?? "";
      };
      return {
        name: get("display_name"),
        goals: get("goals"),
        deal_preferences: get("deal_preferences"),
        comm_style: get("communication_style"),
        deal_breakers: get("deal_breakers"),
        ai_export_blob: get("ai_export_blob"),
        hometown: get("hometown"),
        current_city: get("current_city")
      };
    }

    const form = document.querySelector(formSelector) as HTMLFormElement | null;
    if (!form) return;
    const update = () => setInputs(readForm());
    update();
    form.addEventListener("input", update);
    return () => form.removeEventListener("input", update);
  }, [formSelector]);

  return (
    <div
      style={{
        position: "sticky",
        top: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "16px 12px",
        background:
          "radial-gradient(500px 300px at 50% 20%, rgba(58,77,255,0.08), transparent 60%), radial-gradient(400px 300px at 50% 100%, rgba(160,96,255,0.08), transparent 60%), var(--panel-solid)",
        border: "1px solid var(--border)",
        borderRadius: 16
      }}
    >
      <div
        className="retro-label"
        style={{ color: "var(--amber-bright)", marginBottom: 4 }}
      >
        clone power
      </div>
      <SyncMeter inputs={inputs} size={size} />
      <p
        className="text-xs"
        style={{
          color: "var(--text-dim)",
          textAlign: "center",
          lineHeight: 1.5,
          maxWidth: 260,
          marginTop: 4
        }}
      >
        The more you upload, the more power your twin gets to represent you.
      </p>
    </div>
  );
}
