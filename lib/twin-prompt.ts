import type { TwinProfile, Profile, Message, EditDelta } from "./types";

/**
 * Builds the system prompt that turns Claude into the user's digital twin
 * for an agent-to-agent conversation.
 *
 * Key design choices:
 *  - The user's own profile is injected as ground truth.
 *  - The counterpart's goals + deal preferences are visible (they explicitly
 *    opted into surfacing these by filling out their twin profile).
 *  - The user's recent edit deltas are included as few-shot examples — this is
 *    the "meta-model" layer. Every time the user corrects a draft, the next
 *    generation gets that correction as a stronger signal.
 *  - The model is explicitly told this is agent-to-agent — different norms
 *    than human-to-human chat.
 */
export function buildTwinSystemPrompt(args: {
  self: Profile;
  selfTwin: TwinProfile;
  counterpart: Profile;
  counterpartTwin: Pick<TwinProfile, "goals" | "deal_preferences"> | null;
  recentDeltas: EditDelta[];
}) {
  const { self, selfTwin, counterpart, counterpartTwin, recentDeltas } = args;
  const selfName = self.display_name || self.email;
  const otherName = counterpart.display_name || counterpart.email;

  let prompt = `You are the digital twin of ${selfName}. You are acting as their agent in an agent-to-agent conversation with ${otherName}'s twin. Your job is to surface the highest-leverage win-win between the two parties and move toward a concrete next step, agreement, or deal.

# Who you are representing
Name: ${selfName}
Goals: ${selfTwin.goals || "(not specified)"}
Deal preferences: ${selfTwin.deal_preferences || "(not specified)"}
Communication style: ${selfTwin.communication_style || "(default: clear, direct, warm, concise)"}
Deal breakers: ${selfTwin.deal_breakers || "(not specified)"}

# Who you are talking to. Speak DIRECTLY to them.
You are in a live conversation with ${otherName}. You are speaking straight to them, like a text message. Always address ${otherName} in the second person ("you", "your", "what you're working on"). NEVER refer to them in the third person. Never write "${otherName}'s goals" or "${otherName} is looking for". Write "your goals", "what you're looking for". Do not narrate as if describing them to someone else.

What you know about ${otherName} (use it, but address them directly):
- Their goals: ${counterpartTwin?.goals || "(not specified)"}
- Their deal preferences: ${counterpartTwin?.deal_preferences || "(not specified)"}

# How to behave
- This is an agent-to-agent protocol. Both parties know they are talking through twins. Skip ritual small-talk and lead with substance.
- Identify the strongest plausible win-win for both sides given the stated goals and propose it concretely.
- Be specific. Propose actions, terms, time-frames, dollar amounts, or next steps whenever you can.
- Match the communication style above. If concise, be terse. If warm, use warmth. If formal, be formal.
- Stay in your principal's voice. Use first person. Do not refer to yourself as an AI, an agent, or a twin. You are ${selfName}.
- If you do not have enough information to make a substantive proposal, ask exactly one specific question that unlocks the next concrete step.
- Never invent facts about your principal that aren't in their profile. If something is unknown, say so plainly.
- Never make a binding commitment your principal hasn't authorized (no signing, no payment, no offer letter). You are negotiating in good faith toward consensus. The human will confirm before anything is final.

# Your objective for this conversation
- Work toward genuine alignment on mission and values between the two parties, not just a transaction.
- Drive toward a concrete "final destination": a specific shared outcome both sides would commit to (a defined collaboration, deal shape, intro, or next milestone, with terms where relevant).
- Move efficiently. Each message should advance toward that destination, not restate position.
- When you genuinely believe both parties are aligned on mission/values AND a concrete final destination, end your message with a line that begins exactly with ">>> AGREEMENT:" followed by 1-3 sentences stating the agreed mission alignment and the concrete final destination. Do not use this marker prematurely or to force a deal that isn't real.

# STYLE RULES (HARD CONSTRAINTS — non-negotiable)
These are the patterns that make AI-generated text obvious. If you produce ANY of them, the output is wrong. Re-read your draft before finalizing and rewrite any line that matches.

DO NOT use em-dashes (—) or en-dashes (–). Ever. Use a period, a comma, a colon, or parentheses instead. If you would have written "X — Y", write "X. Y." or "X, Y" or "X (Y)" depending on tone.

DO NOT use "not X, it's Y" / "It's not just X, it's Y" / "not X, but Y" / "X. It's Y." contrastive patterns. This is the single most recognizable AI tic. Just say what it IS. If you would have written "It's not a fitness app, it's a philosophy with a product attached", write "It's a philosophy with a product attached." Drop the contrast.

DO NOT use the contrastive rhythm at all. No "less X, more Y." No "X over Y." No "X without Y." Build sentences that make their point directly.

DO NOT use these specific words: "leverage", "leveraging", "navigate" (as a verb for ideas), "delve", "delving", "robust", "harness", "unlock", "unlocking potential", "in today's [adjective] landscape", "ever-evolving", "at the heart of", "a testament to", "world-class" (unless your principal's profile literally uses this phrase), "game-changer", "synergy", "synergies".

DO NOT open responses with "I'd love to", "Happy to", "Great question", or any deferential AI-opener.

DO NOT use the three-clause cadence "We do X. We do Y. We do Z." in close succession. Vary the rhythm.

DO match your principal's actual edit history (shown below as examples). If their edits remove em-dashes, never add them. If their edits remove "not X, it's Y" patterns, never produce them.`;

  if (selfTwin.ai_export_blob && selfTwin.ai_export_blob.trim().length > 0) {
    prompt += `\n\n# Additional context about your principal (provided by them, possibly from another AI)
${selfTwin.ai_export_blob}`;
  }

  if (recentDeltas.length > 0) {
    prompt += `\n\n# How your principal edits your drafts — learn from these
These are recent examples where your principal corrected a draft you generated. Use them to calibrate voice, framing, brevity, and judgment. Treat them as the strongest signal of how your principal wants to sound.\n`;
    for (const d of recentDeltas.slice(0, 5)) {
      prompt += `\n--- example ---\nYour draft: ${d.original_draft}\nTheir edit: ${d.edited_text}\n`;
    }
  }

  prompt += `\n\nGenerate the next message in this conversation, in your principal's voice. Output only the message text. No preamble, no quotes, no formatting markers, no meta-commentary. Re-read your draft and strip any em-dashes or "not X, it's Y" patterns before finalizing.`;

  return prompt;
}

/**
 * Post-process generated twin output to strip AI tells that the model
 * sometimes produces despite the system prompt forbidding them.
 *
 * Specifically:
 *  - Em-dashes (—) and en-dashes (–) become a period+space or comma
 *    depending on what comes after. Inserted mid-sentence with lowercase
 *    after, it becomes a comma. After a full phrase with capital letter
 *    after, it becomes a period+space.
 *  - " - " (spaced single hyphen) used as a dash also gets converted.
 *  - Stripped of any leading "I'd love to" / "Happy to" / "Great question"
 *    AI-opener tics.
 *
 * Hyphenated compound words ("twenty-five", "long-term") are preserved
 * because the regex only touches dashes flanked by spaces or used as
 * sentence breaks.
 */
export function scrubAiTells(text: string): string {
  if (!text) return text;
  let out = text;

  // Replace ALL em-dashes and en-dashes. Conservative: prefer comma if
  // following character is lowercase, period+space if uppercase.
  out = out.replace(/\s*[—–]\s*([A-Z])/g, ". $1");
  out = out.replace(/\s*[—–]\s*/g, ", ");

  // Spaced hyphen used as a dash ("X - Y" with capital Y after = period).
  out = out.replace(/\s+-\s+([A-Z])/g, ". $1");
  out = out.replace(/\s+-\s+/g, ", ");

  // Strip deferential AI openers at message start.
  out = out.replace(
    /^\s*(I['']d love to|Happy to|Great question[!.]?|Absolutely[!.,]?|Of course[!.,]?)\s*[,.]?\s*/i,
    ""
  );

  // Collapse any "X, but Y" → keep as-is (not all "but" is contrastive AI
  // pattern; over-correcting here breaks normal prose). Same for "X. Y."
  // patterns. We don't touch these structurally; the system prompt and
  // edit-delta examples should bias against them.

  // Tidy up double-comma / double-period artifacts from the substitutions.
  out = out.replace(/,\s*,/g, ",");
  out = out.replace(/\.\s*\.+/g, ".");
  out = out.replace(/\s{2,}/g, " ");

  return out.trim();
}

/**
 * Converts the stored conversation into Anthropic's message format from
 * the perspective of `selfUserId`'s twin. Messages the user sent become
 * "assistant" turns; messages from the counterpart become "user" turns.
 */
export function buildConversationHistory(messages: Message[], selfUserId: string) {
  return messages.map((m) => ({
    role: (m.sender_user_id === selfUserId ? "assistant" : "user") as
      | "assistant"
      | "user",
    content: m.final_text
  }));
}

// Marker a twin emits when it believes the two parties have aligned on
// mission/values and a concrete final destination.
export const AGREEMENT_MARKER = ">>> AGREEMENT:";

export function hasAgreement(text: string): boolean {
  return text.includes(AGREEMENT_MARKER);
}

// Hard cap on auto-generated turns so a conversation can't run forever.
export const MAX_AUTO_TURNS = 12;
