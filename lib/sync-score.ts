/**
 * Sync % — how "complete" your twin/clone is.
 *
 * Caps at 99 by design. The last 1% is reserved as a north-star: a twin
 * can always get more aligned, never fully merged.
 *
 * Breakdown (sums to 99):
 *   name filled                 5
 *   goals filled               15   (required for twin to function at all)
 *   ai_export_blob length      30   (1 pt per 200 chars, up to 30)
 *   deal_preferences            5
 *   comm_style                  5
 *   deal_breakers               5
 *   1+ completed conversation  10
 *   3+ completed conversations +10
 *   1+ accepted agreement      14
 *   ─────────────────────────────
 *   total                      99
 */

export type SyncInputs = {
  name?: string | null;
  goals?: string | null;
  ai_export_blob?: string | null;
  deal_preferences?: string | null;
  comm_style?: string | null;
  deal_breakers?: string | null;
  completed_conversations?: number;
  accepted_agreements?: number;
};

export type SyncBreakdown = {
  total: number; // 0..99
  parts: { label: string; points: number; max: number; done: boolean }[];
  nextStep: string | null;
};

const filled = (s?: string | null) => !!(s && s.trim().length > 0);

export function computeSyncScore(inp: SyncInputs): SyncBreakdown {
  const blobLen = (inp.ai_export_blob ?? "").length;
  const blobPts = Math.min(30, Math.floor(blobLen / 200));

  const completed = inp.completed_conversations ?? 0;
  const accepted = inp.accepted_agreements ?? 0;

  const parts: SyncBreakdown["parts"] = [
    {
      label: "Name",
      points: filled(inp.name) ? 5 : 0,
      max: 5,
      done: filled(inp.name)
    },
    {
      label: "Goals",
      points: filled(inp.goals) ? 15 : 0,
      max: 15,
      done: filled(inp.goals)
    },
    {
      label: "AI context dump",
      points: blobPts,
      max: 30,
      done: blobPts >= 30
    },
    {
      label: "Deal preferences",
      points: filled(inp.deal_preferences) ? 5 : 0,
      max: 5,
      done: filled(inp.deal_preferences)
    },
    {
      label: "Communication style",
      points: filled(inp.comm_style) ? 5 : 0,
      max: 5,
      done: filled(inp.comm_style)
    },
    {
      label: "Deal breakers",
      points: filled(inp.deal_breakers) ? 5 : 0,
      max: 5,
      done: filled(inp.deal_breakers)
    },
    {
      label: "First conversation",
      points: completed >= 1 ? 10 : 0,
      max: 10,
      done: completed >= 1
    },
    {
      label: "3+ conversations",
      points: completed >= 3 ? 10 : 0,
      max: 10,
      done: completed >= 3
    },
    {
      label: "First accepted agreement",
      points: accepted >= 1 ? 14 : 0,
      max: 14,
      done: accepted >= 1
    }
  ];

  const total = Math.min(99, parts.reduce((acc, p) => acc + p.points, 0));

  // Suggest the single highest-leverage next step.
  let nextStep: string | null = null;
  const undone = parts.find((p) => !p.done);
  if (undone) {
    if (undone.label === "AI context dump") {
      nextStep =
        "Paste more personal context into your twin (every 200 chars = +1%)";
    } else if (undone.label === "First conversation") {
      nextStep = "Start your first conversation with another twin";
    } else if (undone.label === "3+ conversations") {
      nextStep = "Have 3 conversations to lock in your twin's voice";
    } else if (undone.label === "First accepted agreement") {
      nextStep = "Reach a win-win agreement with someone";
    } else {
      nextStep = `Fill in ${undone.label.toLowerCase()}`;
    }
  }

  return { total, parts, nextStep };
}
