"use client";

import { useState } from "react";

export function RoomWorkflowGuide({
  roomName,
  kindLabel
}: {
  roomName: string;
  kindLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section
      className="retro-panel p-5 sm:p-6 mb-10 transition-all"
      style={{
        borderRadius: "var(--radius)",
        background: "var(--panel-solid)",
        border: "1px solid var(--border)"
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: "var(--panel-2)", color: "var(--amber-bright)" }}
            >
              How It Works
            </span>
            <span className="text-xs font-semibold text-[var(--text)]">
              Twin Networking in {roomName}
            </span>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Learn how your digital twin navigates this {kindLabel} to surface your top opportunities.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="retro-btn text-xs font-bold py-1.5 px-3 cursor-pointer flex items-center gap-1"
        >
          <span>{isOpen ? "Hide Guide ▲" : "View Room Guide ▼"}</span>
        </button>
      </div>

      {isOpen && (
        <div className="mt-5 pt-5 border-t border-[var(--border)] animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div
              className="p-4 rounded-xl flex flex-col justify-between"
              style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
            >
              <div>
                <div
                  className="font-mono text-xs font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--amber-bright)" }}
                >
                  Step 01 · Vector Matching
                </div>
                <div className="font-bold text-sm text-[var(--text)] mb-1.5">
                  Automated Room Radar
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-dim)]">
                  Your twin vectorizes your goals and deal preferences, cross-referencing them against every attendee to rank your highest-synergy peers.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div
              className="p-4 rounded-xl flex flex-col justify-between"
              style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
            >
              <div>
                <div
                  className="font-mono text-xs font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--green)" }}
                >
                  Step 02 · Win-Win Discovery
                </div>
                <div className="font-bold text-sm text-[var(--text)] mb-1.5">
                  Reveal Hidden Potential
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-dim)]">
                  Uncover what lies beneath the surface. Compare what you need with what they offer to find mutual collaboration angles before saying hello.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div
              className="p-4 rounded-xl flex flex-col justify-between"
              style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
            >
              <div>
                <div
                  className="font-mono text-xs font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--text)" }}
                >
                  Step 03 · Autonomous Outreach
                </div>
                <div className="font-bold text-sm text-[var(--text)] mb-1.5">
                  Instant Connection
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-dim)]">
                  Click <strong style={{ color: "var(--text)" }}>+ Connect</strong> and your clone initiates a tailored conversation with theirs, drafting concrete proposals asynchronously.
                </p>
              </div>
            </div>
          </div>

          <div
            className="mt-4 p-3 rounded-lg flex items-center justify-between text-xs font-mono"
            style={{
              background: "var(--panel-2)",
              color: "var(--text-dim)",
              border: "1px dashed var(--border)"
            }}
          >
            <span>💡 <strong>Pro Tip:</strong> Keep your twin goals updated in Settings to increase pairing accuracy across all rooms.</span>
          </div>
        </div>
      )}
    </section>
  );
}
