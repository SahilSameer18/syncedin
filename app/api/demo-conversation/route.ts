import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";

/**
 * Demo conversation generator — drives the pre-auth invite landing page.
 *
 * Given an invite slug, produces a simulated 5-6 turn conversation between
 * the inviter's twin (real twin_profile + ai_export_blob) and a Claude-
 * imagined "guess at the recipient's twin" built from the LinkedIn scrape
 * we've already stored on pending_invites.person_highlights.
 *
 * The recipient can then refine — paste more context, edit any line, and
 * regenerate — without signing up. Sign-in is only required when they want
 * to "open the final deal proposal" or accept an agreement.
 *
 * Body:
 *   { slug: string, extra_context?: string, edits?: { index: number, text: string }[] }
 *
 * Returns:
 *   { messages: { sender: "inviter" | "recipient", text: string }[],
 *     inviterName: string, recipientName: string }
 *
 * No auth required — this is the unauthenticated demo surface. RLS on
 * pending_invites already allows public read by slug.
 */
export async function POST(req: Request) {
  let body: {
    slug?: string;
    extra_context?: string;
    edits?: Array<{ index: number; text: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const slug = (body.slug ?? "").toLowerCase().trim();
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }
  // Bumped from 2000 → 8000 to accommodate the merged-blob the client
  // now sends: LinkedIn About (3000) + IG/X handles + extra paragraph
  // (2000) + headroom for tags. Claude handles 8k of context with ease.
  const extraContext = (body.extra_context ?? "").toString().slice(0, 8000);
  const edits = Array.isArray(body.edits) ? body.edits.slice(0, 12) : [];

  const service = createServiceClient();
  const { data: invite } = await service
    .from("pending_invites")
    .select(
      "slug, inviter_user_id, person_title, person_highlights, conversation_starter"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!invite) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [{ data: inviterProfile }, { data: inviterTwin }] = await Promise.all([
    service
      .from("profiles")
      .select("display_name, email, avatar_url")
      .eq("id", invite.inviter_user_id)
      .maybeSingle(),
    service
      .from("twin_profiles")
      .select(
        "goals, deal_preferences, communication_style, deal_breakers, ai_export_blob"
      )
      .eq("user_id", invite.inviter_user_id)
      .maybeSingle()
  ]);

  const inviterName =
    (inviterProfile as any)?.display_name ||
    (inviterProfile as any)?.email ||
    "the sender";
  const recipientName =
    ((invite as any).person_title || "").split(/[-|,(·]/)[0]?.trim() ||
    "the recipient";

  const inviterTwinBlock = `
${inviterName}'s goals: ${(inviterTwin as any)?.goals || "(not specified)"}
${inviterName}'s deal preferences: ${
    (inviterTwin as any)?.deal_preferences || "(not specified)"
  }
${inviterName}'s comm style: ${
    (inviterTwin as any)?.communication_style || "(not specified)"
  }
${inviterName}'s deal breakers: ${
    (inviterTwin as any)?.deal_breakers || "(not specified)"
  }
${inviterName}'s context blob (excerpts):
${((inviterTwin as any)?.ai_export_blob || "").slice(0, 1500)}
  `.trim();

  const highlights = Array.isArray((invite as any).person_highlights)
    ? ((invite as any).person_highlights as string[])
    : [];
  const recipientGuessBlock = `
Public footprint we have for ${recipientName} (from their LinkedIn / Twitter / web):
${highlights.join("\n\n").slice(0, 2500)}
${
  extraContext
    ? `\n\nAdditional context ${recipientName} just added themselves (treat as the most-recent truth, override the scrape where they conflict):\n${extraContext}`
    : ""
}
  `.trim();

  // If the user has edited specific lines, fold those edits into the
  // prompt so the regeneration respects their corrections.
  const editsBlock =
    edits.length > 0
      ? `\n\nThe user already manually edited these specific lines in the prior draft — preserve the SPIRIT of each edit when regenerating. Edits (0-indexed message position → new text):\n${edits
          .map((e) => `  [${e.index}] "${(e.text || "").slice(0, 240)}"`)
          .join("\n")}`
      : "";

  const systemPrompt = `You're generating a SIMULATED conversation between two people's digital twins to show a recipient what a real twin-to-twin negotiation on SyncedIn would look like. The recipient is reading this BEFORE signing up — your job is to make them think "wow, that's exactly the conversation I'd want to have."

Hard rules:
- Generate EXACTLY 6 messages, alternating senders. Message 1 = "${inviterName}'s twin" (sender: "inviter"). Message 2 = "${recipientName}'s twin" (sender: "recipient"). Continue alternating through 6 messages total.
- Each message: 2-4 sentences, conversational, specific. NO em-dashes, NO emojis, NO markdown.
- Every message must reference concrete details from the profile blocks below — names of products, companies, specific projects. Generic chat is wrong.
- The conversation should progress: opener → context exchange → identify overlap → propose a specific next step. Message 6 should propose a concrete win-win.
- ${recipientName}'s twin should sound like ${recipientName} would sound — pulled from the public footprint + any added context. If the footprint is thin, infer cautiously and hedge claims.
- It's a CONVERSATION, not pitches at each other. Each side should ask things or react to what the other just said.

Return ONLY valid JSON. Shape:
{
  "messages": [
    { "sender": "inviter", "text": "..." },
    { "sender": "recipient", "text": "..." },
    { "sender": "inviter", "text": "..." },
    { "sender": "recipient", "text": "..." },
    { "sender": "inviter", "text": "..." },
    { "sender": "recipient", "text": "..." }
  ]
}`;

  const userContent = `${inviterTwinBlock}

---

${recipientGuessBlock}${editsBlock}

Generate the JSON now. ${
    extraContext
      ? `Bias toward the new context ${recipientName} just added.`
      : ""
  }`;

  let parsed: { messages?: Array<{ sender: string; text: string }> } = {};
  try {
    const response = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 1400,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }]
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      parsed = JSON.parse(text.slice(start, end + 1));
    }
  } catch (e: any) {
    console.error("[demo-conversation] gen error", e);
    return NextResponse.json(
      { error: "generation_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  const cleaned = (parsed.messages ?? [])
    .map((m) => ({
      sender:
        (m.sender || "").toLowerCase() === "recipient"
          ? ("recipient" as const)
          : ("inviter" as const),
      text: (m.text || "").toString().trim()
    }))
    .filter((m) => m.text.length > 0)
    .slice(0, 6);

  return NextResponse.json({
    messages: cleaned,
    inviterName,
    recipientName
  });
}
