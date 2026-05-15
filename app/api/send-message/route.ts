import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    conversation_id?: string;
    original_draft?: string;
    final_text?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { conversation_id, original_draft, final_text } = body;
  if (!conversation_id || !original_draft || !final_text) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!final_text.trim()) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
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

  const edited = original_draft !== final_text;

  // Snapshot conversation state at the time of edit (for delta log).
  const { data: priorMessages } = await service
    .from("messages")
    .select("id, sender_user_id, final_text, sent_at")
    .eq("conversation_id", conversation_id)
    .order("sent_at", { ascending: true });

  const { data: message, error } = await service
    .from("messages")
    .insert({
      conversation_id,
      sender_user_id: user.id,
      original_draft,
      final_text,
      edited
    })
    .select("*")
    .single();

  if (error || !message) {
    console.error("message insert failed", error);
    return NextResponse.json(
      { error: "insert_failed", detail: error?.message },
      { status: 500 }
    );
  }

  // Log the delta — this is the proprietary training corpus for the user's twin.
  if (edited) {
    const { error: deltaErr } = await service.from("edit_deltas").insert({
      message_id: message.id,
      user_id: user.id,
      original_draft,
      edited_text: final_text,
      conversation_snapshot: priorMessages ?? []
    });
    if (deltaErr) console.error("delta insert failed", deltaErr);
  }

  return NextResponse.json({ message });
}
