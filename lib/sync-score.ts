/**
 * Sync % — how "complete" your twin/clone is.
 *
 * Caps at 99 by design. The last 1% is reserved as a north-star: a twin
 * can always get more aligned, never fully merged.
 *
 * The score is elastic: every meaningful action (adding context, having
 * a conversation, getting an edit captured, sealing an agreement) moves
 * the needle. No single input caps the meter prematurely — pasting one
 * more paragraph or holding one more conversation always nudges it up.
 *
 * Bucket maxes (sums to >99 so cap kicks in for highly active twins):
 *   name filled                  3
 *   goals filled                10
 *   hometown + current city      4   (2 each)
 *   deal_preferences             4
 *   comm_style                   4
 *   deal_breakers                4
 *   ai_export_blob length       30   (1 pt per 80 chars, capped)
 *   context snippets             8   (1 pt per "# X (source)" block, max 8)
 *   conversations               15   (3 pts each, max 5 — i.e. 15)
 *   accepted agreements         18   (6 pts each, max 3 — i.e. 18)
 *   edits captured               6   (1 pt per 4 edits, max 6)
 *   ─────────────────────────────
 *   max total                  106   → clamped to 99
 */

export type SyncInputs = {
  name?: string | null;
  goals?: string | null;
  ai_export_blob?: string | null;
  deal_preferences?: string | null;
  comm_style?: string | null;
  deal_breakers?: string | null;
  hometown?: string | null;
  current_city?: string | null;
  completed_conversations?: number;
  accepted_agreements?: number;
  edit_count?: number;
};

export type SyncBreakdown = {
  total: number; // 0..99
  parts: { label: string; points: number; max: number; done: boolean }[];
  nextStep: string | null;
};

const filled = (s?: string | null) => !!(s && s.trim().length > 0);

export function computeSyncScore(inp: SyncInputs): SyncBreakdown {
  const blob = inp.ai_export_blob ?? "";
  const blobLen = blob.length;
  // Lower threshold (80 chars per pt) so each added paragraph visibly moves
  // the meter. Caps at 30.
  const blobPts = Math.min(30, Math.floor(blobLen / 80));

  // Count "# Label (source)" snippet headers in the blob — every added
  // source (LinkedIn / X / IG / Any URL) is a discrete +1.
  const snippetMatches = blob.match(/^#\s+.+?\s+\(.+?\)\s*$/gm);
  const snippetCount = snippetMatches ? snippetMatches.length : 0;
  const snippetPts = Math.min(8, snippetCount);

  const completed = inp.completed_conversations ?? 0;
  const accepted = inp.accepted_agreements ?? 0;
  const edits = inp.edit_count ?? 0;

  // 3 pts per conversation, max 15. So #1 = 3, #2 = 6, ... #5+ = 15.
  const convPts = Math.min(15, completed * 3);
  // 6 pts per accepted agreement, max 18.
  const agrPts = Math.min(18, accepted * 6);
  // 1 pt per 4 edits captured, max 6 — small but always nudges the meter.
  const editPts = Math.min(6, Math.floor(edits / 4));

  const parts: SyncBreakdown["parts"] = [
    {
      label: "Name",
      points: filled(inp.name) ? 3 : 0,
      max: 3,
      done: filled(inp.name)
    },
    {
      label: "Goals",
      points: filled(inp.goals) ? 10 : 0,
      max: 10,
      done: filled(inp.goals)
    },
    {
      label: "Where you live",
      points: filled(inp.current_city) ? 2 : 0,
      max: 2,
      done: filled(inp.current_city)
    },
    {
      label: "Where you're from",
      points: filled(inp.hometown) ? 2 : 0,
      max: 2,
      done: filled(inp.hometown)
    },
    {
      label: "Deal preferences",
      points: filled(inp.deal_preferences) ? 4 : 0,
      max: 4,
      done: filled(inp.deal_preferences)
    },
    {
      label: "Communication style",
      points: filled(inp.comm_style) ? 4 : 0,
      max: 4,
      done: filled(inp.comm_style)
    },
    {
      label: "Deal breakers",
      points: filled(inp.deal_breakers) ? 4 : 0,
      max: 4,
      done: filled(inp.deal_breakers)
    },
    {
      label: "Voice / context blob",
      points: blobPts,
      max: 30,
      done: blobPts >= 30
    },
    {
      label: "Context sources",
      points: snippetPts,
      max: 8,
      done: snippetPts >= 8
    },
    {
      label: "Conversations had",
      points: convPts,
      max: 15,
      done: convPts >= 15
    },
    {
      label: "Sealed agreements",
      points: agrPts,
      max: 18,
      done: agrPts >= 18
    },
    {
      label: "Edits captured",
      points: editPts,
      max: 6,
      done: editPts >= 6
    }
  ];

  const total = Math.min(99, parts.reduce((acc, p) => acc + p.points, 0));

  // Suggest the single highest-leverage next step.
  let nextStep: string | null = null;
  const undone = parts.find((p) => !p.done);
  if (undone) {
    switch (undone.label) {
      case "Voice / context blob":
        nextStep =
          "Paste more personal context (~80 chars per +1%)";
        break;
      case "Context sources":
        nextStep =
          "Connect another source (LinkedIn / X / Instagram / any URL)";
        break;
      case "Conversations had":
        nextStep = "Have another conversation with someone's twin";
        break;
      case "Sealed agreements":
        nextStep = "Reach a win-win agreement with someone";
        break;
      case "Edits captured":
        nextStep = "Edit a draft your twin proposes — every 4 edits = +1%";
        break;
      default:
        nextStep = `Fill in ${undone.label.toLowerCase()}`;
    }
  }

  return { total, parts, nextStep };
}
