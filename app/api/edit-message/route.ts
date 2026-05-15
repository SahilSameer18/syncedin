import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Edit any message in a conversation, then truncate everything after it so
 * the rest of the conversation can be regenerated from the edit point.
 *
 * - Either participant may edit any message (per product spec).
 * - If the editor is editing THEIR OWN twin's message, the change is logged
 *   as an edit_delta (voice training signal). Editing the other twin's
 *   message is a steering action and is not logged as voice training.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { message_id?: string; new_text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { message_id, new_text } = body;
  if (!message_id || !new_text || !new_text.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: msg } = await service
    .from("messages")
    .select("*")
    .eq("id", message_id)
    .single();
  if (!msg) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: conv } = await service
    .from("conversations")
    .select("*")
    .eq("id", msg.conversation_id)
    .single();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation_not_found" },
      { status: 404 }
    );
  }
  if (conv.participant_a !== user.id && conv.participant_b !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // You can only edit your OWN twin's messages, not the other person's.
  if (msg.sender_user_id !== user.id) {
    return NextResponse.json(
      {
        error: "not_your_message",
        detail: "You can only edit your own messages."
      },
      { status: 403 }
    );
  }

  const original = msg.final_text;

  // Snapshot the conversation up to and including this message for the delta log.
  const { data: priorMessages } = await service
    .from("messages")
    .select("id, sender_user_id, final_text, sent_at")
    .eq("conversation_id", msg.conversation_id)
    .lte("sent_at", msg.sent_at)
    .order("sent_at", { ascending: true });

  // Update the message text.
  const { error: updErr } = await service
    .from("messages")
    .update({ final_text: new_text, edited: true })
    .eq("id", message_id);
  if (updErr) {
    return NextResponse.json(
      { error: "update_failed", detail: updErr.message },
      { status: 500 }
    );
  }

  // Log a voice-training delta only when the editor edits their own twin.
  if (msg.sender_user_id === user.id && original !== new_text) {
    const { error: deltaErr } = await service.from("edit_deltas").insert({
      message_id,
      user_id: user.id,
      original_draft: msg.original_draft,
      edited_text: new_text,
      conversation_snapshot: priorMessages ?? []
    });
    if (deltaErr) console.error("edit_delta insert failed", deltaErr);
  }

  // Truncate everything after the edited message — it will be regenerated.
  const { error: delErr } = await service
    .from("messages")
    .delete()
    .eq("conversation_id", msg.conversation_id)
    .gt("sent_at", msg.sent_at);
  if (delErr) {
    return NextResponse.json(
      { error: "truncate_failed", detail: delErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
