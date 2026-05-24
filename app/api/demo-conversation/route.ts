import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";

/**
 * Demo conversation generator — drives the pre-auth invite landing page.
 *
 * Two modes:
 *   1. STREAMING (default, ?stream=1 or Accept: text/event-stream):
 *      Emits each complete message as an SSE event as soon as it's
 *      generated. UI shows bubbles progressively instead of waiting
 *      for the whole 6-turn block.
 *      Events:
 *        data: {"type":"meta","inviterName":"…","recipientName":"…"}\n\n
 *        data: {"type":"message","sender":"inviter","text":"…"}\n\n
 *        data: {"type":"message","sender":"recipient","text":"…"}\n\n
 *        data: {"type":"done"}\n\n
 *
 *   2. JSON (back-compat): returns the full {messages:[…]} payload
 *      after the entire generation completes. Kept for any caller
 *      that doesn't want the stream.
 *
 * The streaming path uses Claude's native message-stream API and
 * watches the accumulating text for complete `{"sender":...,"text":...}`
 * objects, emitting each as soon as the closing brace + comma (or end-
 * of-array) lands. The model is prompted to emit ONE message per line
 * inside the JSON array so the parsing stays simple.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const wantsStream =
    url.searchParams.get("stream") === "1" ||
    req.headers.get("accept")?.includes("text/event-stream");

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

  const editsBlock =
    edits.length > 0
      ? `\n\nThe user already manually edited these specific lines in the prior draft — preserve the SPIRIT of each edit when regenerating. Edits (0-indexed message position → new text):\n${edits
          .map((e) => `  [${e.index}] "${(e.text || "").slice(0, 240)}"`)
          .join("\n")}`
      : "";

  // Prompt asks for one JSON object per line inside the array so we can
  // detect a completed message as soon as a newline lands during
  // streaming. Length is UNBOUNDED — the conversation runs until one
  // side floats a concrete win-win proposal and the other accepts (or
  // counter-proposes a specific tweak). Jack: "not limit the amount
  // of messages between the two parties but go all the way until a
  // proposal is reached."
  const systemPrompt = `You're generating a SIMULATED conversation between two people's digital twins to show a recipient what a real twin-to-twin negotiation on SyncedIn would look like. The recipient is reading this BEFORE signing up — your job is to make them think "wow, that's exactly the conversation I'd want to have."

Hard rules:
- Alternate senders strictly. Message 1 = "${inviterName}'s twin" (sender: "inviter"). Message 2 = "${recipientName}'s twin" (sender: "recipient"). Keep alternating.
- Do NOT cap the conversation at a fixed length. Keep going until one side puts a CONCRETE win-win proposal on the table (specific deliverable, specific channel, specific timing) and the other side either accepts it cleanly or counter-proposes one specific tweak the first side then accepts. Most realistic conversations land in 6–14 messages; some need more — let it run as long as needed. Never stop short of a proposal.
- The FINAL message must be the one that accepts the proposal, and it must END with the literal marker line "PROPOSAL:" followed by a one-sentence restatement of the agreed-on next step (who does what, when, on what channel). Example final-message ending: "Sounds great, I'll send the calendar invite tonight. PROPOSAL: 30-min Zoom Tuesday at 10am PT to review the cohort metrics, ${inviterName} to send the deck the night before."
- Each message: 2-4 sentences, conversational, specific. NO em-dashes, NO emojis, NO markdown.
- Every message must reference concrete details from the profile blocks below — names of products, companies, specific projects. Generic chat is wrong.
- The conversation should progress: opener → context exchange → identify the overlap → put a specific next step on the table → resolve any pushback → land the proposal.
- ${recipientName}'s twin should sound like ${recipientName} would sound — pulled from the public footprint + any added context. If the footprint is thin, infer cautiously and hedge claims.
- It's a CONVERSATION, not pitches at each other. Each side should ask things or react to what the other just said.

Output format — return ONLY valid JSON in this EXACT shape, with each message object on its own line (newline-separated inside the array). This formatting matters for streaming. Continue the array for as many messages as it takes to land the proposal:
{
"messages": [
{"sender": "inviter", "text": "..."},
{"sender": "recipient", "text": "..."},
{"sender": "inviter", "text": "..."}
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

  // ============ STREAMING PATH ============
  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(payload: object) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        }

        try {
          // Send meta event first so the UI can render name/header before
          // any bubbles arrive.
          send({ type: "meta", inviterName, recipientName });

          // Use the Anthropic SDK streaming API. We accumulate raw text
          // and watch for completed message objects in the stream.
          const stream = anthropic.messages.stream({
            model: TWIN_MODEL,
            // Was 1400 when capped at 6 messages. Bumped to leave room
            // for the conversation to actually reach a proposal — 14
            // 2-4-sentence turns + JSON scaffolding fits comfortably
            // inside ~3500 tokens.
            max_tokens: 3500,
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }]
          });

          let acc = "";
          // Regex finds one complete {"sender":"...","text":"..."} object.
          // We anchor on the closing `}` so we only emit once a message
          // is fully written by the model.
          const objRegex =
            /\{\s*"sender"\s*:\s*"(inviter|recipient)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
          let lastEmittedEnd = 0;

          stream.on("text", (delta: string) => {
            acc += delta;
            objRegex.lastIndex = lastEmittedEnd;
            let m: RegExpExecArray | null;
            while ((m = objRegex.exec(acc))) {
              const sender = m[1] as "inviter" | "recipient";
              // Unescape the JSON-string content so emoji / quotes /
              // newlines come through correctly.
              let text: string;
              try {
                text = JSON.parse(`"${m[2]}"`);
              } catch {
                text = m[2];
              }
              text = text.trim();
              if (text.length > 0) {
                send({ type: "message", sender, text });
              }
              lastEmittedEnd = m.index + m[0].length;
            }
          });

          await stream.finalMessage();
          send({ type: "done" });
          controller.close();
        } catch (e: any) {
          send({
            type: "error",
            detail: e?.message ?? String(e)
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        // X-Accel-Buffering disables nginx buffering on Vercel's edge
        // so events arrive in real time instead of being held until the
        // entire response is ready.
        "x-accel-buffering": "no"
      }
    });
  }

  // ============ NON-STREAMING PATH (back-compat) ============
  let parsed: { messages?: Array<{ sender: string; text: string }> } = {};
  try {
    const response = await anthropic.messages.create({
      model: TWIN_MODEL,
      // Matches the streaming path — room for a full proposal-lands
      // conversation (was 1400 when capped at 6 messages).
      max_tokens: 3500,
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

  // No hard cap on message count — the conversation runs until a
  // proposal lands. We still defensively clamp to a generous upper
  // bound (40) to prevent a runaway model from blowing out the UI.
  const cleaned = (parsed.messages ?? [])
    .map((m) => ({
      sender:
        (m.sender || "").toLowerCase() === "recipient"
          ? ("recipient" as const)
          : ("inviter" as const),
      text: (m.text || "").toString().trim()
    }))
    .filter((m) => m.text.length > 0)
    .slice(0, 40);

  return NextResponse.json({
    messages: cleaned,
    inviterName,
    recipientName
  });
}
