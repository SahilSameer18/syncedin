import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import {
  buildTwinSystemPrompt,
  buildConversationHistory,
  hasAgreement,
  MAX_AUTO_TURNS,
  scrubAiTells
} from "@/lib/twin-prompt";
import type { Profile, TwinProfile, Message, EditDelta } from "@/lib/types";

/**
 * Generate the NEXT turn in a conversation and insert it.
 *
 * Works for any conversation — real-vs-real or real-vs-test-persona. It
 * generates for whichever participant did NOT send the last message, so the
 * client can call it in a loop to auto-run the whole conversation between
 * both twins until they reach agreement or hit the turn cap.
 *
 * Returns { message, done, agreement } or { done: true, reason } when there's
 * nothing left to generate.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { conversation_id?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const conversation_id = body.conversation_id;
  const force = !!body.force;
  if (!conversation_id) {
    return NextResponse.json(
      { error: "missing_conversation_id" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("*")
    .eq("id", conversation_id)
    .single();
  if (!conv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (conv.participant_a !== user.id && conv.participant_b !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: messages } = await service
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation_id)
    .order("sent_at", { ascending: true });
  const msgs = (messages as Message[]) ?? [];

  // Stop conditions — skipped when the client passes force=true. The
  // re-run button uses force when the conversation is already done, so
  // adding a per-conv goal mid-flight actually fires one fresh turn that
  // picks up the new goal_override.
  if (!force) {
    if (msgs.length >= MAX_AUTO_TURNS) {
      return NextResponse.json({ done: true, reason: "turn_cap" });
    }
    if (msgs.length > 0 && hasAgreement(msgs[msgs.length - 1].final_text)) {
      return NextResponse.json({ done: true, reason: "agreement" });
    }
  }

  // Whose turn? Whoever did NOT send the last message. Empty → participant_a.
  const lastSender =
    msgs.length > 0 ? msgs[msgs.length - 1].sender_user_id : null;
  const turnUserId = lastSender
    ? lastSender === conv.participant_a
      ? conv.participant_b
      : conv.participant_a
    : conv.participant_a;
  const counterpartId =
    turnUserId === conv.participant_a
      ? conv.participant_b
      : conv.participant_a;

  const [
    { data: selfProfile },
    { data: selfTwin },
    { data: otherProfile },
    { data: otherTwin },
    { data: deltas }
  ] = await Promise.all([
    service.from("profiles").select("*").eq("id", turnUserId).single(),
    service
      .from("twin_profiles")
      .select("*")
      .eq("user_id", turnUserId)
      .maybeSingle(),
    service.from("profiles").select("*").eq("id", counterpartId).single(),
    service
      .from("twin_profiles")
      .select("goals, deal_preferences")
      .eq("user_id", counterpartId)
      .maybeSingle(),
    service
      .from("edit_deltas")
      .select("*")
      .eq("user_id", turnUserId)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  if (!selfTwin) {
    const who =
      (selfProfile as Profile | null)?.display_name ||
      (selfProfile as Profile | null)?.email ||
      "A participant";
    return NextResponse.json(
      {
        error: "twin_not_set_up",
        detail: `${who} hasn't finished building their twin yet — the conversation can't continue until they do.`
      },
      { status: 400 }
    );
  }

  const systemPrompt = buildTwinSystemPrompt({
    self: selfProfile as Profile,
    selfTwin: selfTwin as TwinProfile,
    counterpart: otherProfile as Profile,
    counterpartTwin:
      (otherTwin as Pick<TwinProfile, "goals" | "deal_preferences">) ?? null,
    recentDeltas: (deltas as EditDelta[]) ?? [],
    goalOverride: (conv as any)?.goal_override ?? null
  });

  const history = buildConversationHistory(msgs, turnUserId);
  if (history.length === 0) {
    history.push({
      role: "user",
      content:
        "(No prior messages. Open the conversation with a substantive first message that moves toward a mission-aligned win-win.)"
    });
  }

  let text: string;
  try {
    const response = await anthropic.messages.create({
      model: TWIN_MODEL,
      // Twin chat turns are 2-4 sentences. 1024 was a leftover from when
      // the model was also writing the agreement block at the end; that
      // moved to a separate path. Dropping to 500 cuts the worst-case
      // latency on a long turn by ~30% with no quality regression on the
      // shorter typical turn.
      max_tokens: 500,
      system: systemPrompt,
      messages: history
    });
    text = scrubAiTells(
      response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim()
    );
  } catch (e: any) {
    console.error("run-conversation generation error", e);
    return NextResponse.json(
      { error: "generation_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  const { data: message, error } = await service
    .from("messages")
    .insert({
      conversation_id,
      sender_user_id: turnUserId,
      original_draft: text,
      final_text: text,
      edited: false
    })
    .select("*")
    .single();

  if (error || !message) {
    console.error("run-conversation insert failed", error);
    return NextResponse.json(
      { error: "insert_failed", detail: error?.message },
      { status: 500 }
    );
  }

  const agreement = hasAgreement(text);
  const done = agreement || msgs.length + 1 >= MAX_AUTO_TURNS;
  // Tell the client who's about to type next so it can render an
  // iMessage-style typing indicator on the right side with the right name.
  // When the run loop is done, next_turn_user_id is null.
  const nextTurnUserId = done
    ? null
    : turnUserId === conv.participant_a
      ? conv.participant_b
      : conv.participant_a;
  return NextResponse.json({
    message,
    done,
    agreement,
    turn_user_id: turnUserId,
    next_turn_user_id: nextTurnUserId
  });
}
