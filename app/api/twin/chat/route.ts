import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";

/**
 * Talk-to-your-twin chat (#159). A single 1:1 thread per user where
 * the user converses with their own digital twin to:
 *   - get triage on pending proposals
 *   - think out loud about goals
 *   - refine the twin's voice (the twin learns from the convo as it
 *     goes via the existing edit-delta pattern — TBD)
 *
 * GET   → returns the user's full thread (chronological, max 200)
 * POST  { body } → appends user message, calls Claude, persists +
 *                  returns the assistant reply
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_HISTORY_FOR_PROMPT = 30;

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  try {
    const { data, error } = await service
      .from("twin_chat_messages")
      .select("id, role, body, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ messages: data ?? [] });
  } catch (e: any) {
    // If schema not yet migrated, surface the friendly hint so the UI
    // can prompt Jack to run the SQL block.
    if (/relation .* does not exist|schema cache/i.test(e?.message ?? "")) {
      return NextResponse.json(
        {
          messages: [],
          _err: "schema_missing",
          _detail:
            "Run the twin_chat_messages migration in Supabase → SQL Editor."
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ messages: [], _err: e?.message ?? null });
  }
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const userText = (body.body ?? "").trim();
  if (!userText) {
    return NextResponse.json({ error: "missing_body" }, { status: 400 });
  }
  if (userText.length > 4000) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const service = createServiceClient();

  // Pull the user's twin profile so the assistant can speak in their
  // voice. Soft-fail: if twin isn't fully built yet we still respond,
  // just with a thinner system prompt.
  const [{ data: profile }, { data: twin }] = await Promise.all([
    service
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle(),
    service
      .from("twin_profiles")
      .select(
        "goals, deal_preferences, communication_style, deal_breakers, ai_export_blob, hometown, current_city"
      )
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  // Pull pending proposals so the twin can give specific triage when
  // asked. Pending = conversation has summary but no agreement_response
  // from this user. Limit to 5 most recent to keep context cheap.
  let proposalContext = "";
  try {
    const { data: convs } = await service
      .from("conversations")
      .select(
        "id, participant_a, participant_b, summary, counterpart_summary, created_at"
      )
      .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
      .not("summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    const convIds = (convs ?? []).map((c: any) => c.id);
    if (convIds.length) {
      const { data: resps } = await service
        .from("agreement_responses")
        .select("conversation_id")
        .eq("user_id", user.id)
        .in("conversation_id", convIds);
      const respondedSet = new Set(
        (resps ?? []).map((r: any) => r.conversation_id)
      );
      const pending = (convs ?? [])
        .filter((c: any) => !respondedSet.has(c.id))
        .slice(0, 5);
      if (pending.length) {
        proposalContext =
          "\n\n# Pending proposals waiting on the user:\n" +
          pending
            .map(
              (p: any, i: number) =>
                `${i + 1}. ${(p.counterpart_summary ?? "Counterpart").slice(
                  0,
                  120
                )} — proposal: ${(p.summary ?? "").slice(0, 200)}`
            )
            .join("\n");
      }
    }
  } catch {
    /* non-fatal */
  }

  // Load recent thread for context (last 30 turns).
  const { data: priorRows } = await service
    .from("twin_chat_messages")
    .select("role, body, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_FOR_PROMPT);
  const priorMessages = ((priorRows ?? []) as any[])
    .reverse()
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.body as string
    }));

  // Persist the new user turn BEFORE generating so a crash mid-gen
  // doesn't lose the user's input.
  const { data: userMsg } = await service
    .from("twin_chat_messages")
    .insert({ user_id: user.id, role: "user", body: userText })
    .select("id")
    .single();

  const selfName =
    (profile as any)?.display_name ||
    ((profile as any)?.email as string)?.split("@")[0] ||
    "you";

  const system = `You are ${selfName}'s digital twin. They are talking to you directly — this is NOT a twin-to-twin networking conversation. They came here to think out loud with you, get advice on pending proposals, or refine your voice.

You know them intimately:
- Goals: ${(twin as any)?.goals || "(not set yet)"}
- Deal preferences: ${(twin as any)?.deal_preferences || "(not set)"}
- Communication style: ${(twin as any)?.communication_style || "(not set)"}
- Deal-breakers: ${(twin as any)?.deal_breakers || "(not set)"}
- Hometown / current city: ${(twin as any)?.hometown || "?"} → ${
    (twin as any)?.current_city || "?"
  }

Speak in first-person as their twin, but stay aware that you ARE the AI and they ARE the human. Be candid. Push back when their thinking is off. Offer specific moves they can take next. Keep replies under 200 words unless they explicitly ask for more depth.
${proposalContext}`;

  try {
    const conversationTurns = [
      ...priorMessages,
      { role: "user" as const, content: userText }
    ];
    const resp = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 800,
      system,
      messages: conversationTurns
    });
    const out =
      resp.content
        .map((b: any) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim() || "(no reply)";

    const { data: asstMsg } = await service
      .from("twin_chat_messages")
      .insert({ user_id: user.id, role: "assistant", body: out })
      .select("id, created_at")
      .single();

    return NextResponse.json({
      ok: true,
      user_message_id: (userMsg as any)?.id ?? null,
      assistant: {
        id: (asstMsg as any)?.id ?? null,
        role: "assistant",
        body: out,
        created_at: (asstMsg as any)?.created_at ?? null
      }
    });
  } catch (e: any) {
    console.error("[twin/chat] generation failed", e);
    return NextResponse.json(
      {
        error: "generation_failed",
        detail: e?.message ?? "Couldn't reach Claude."
      },
      { status: 500 }
    );
  }
}
