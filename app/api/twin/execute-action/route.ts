import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/twin/execute-action
 *
 * Called when the user taps Approve on an inline ActionCard in the
 * twin chat. The twin chat NEVER mutates the DB itself — the model
 * only stages actions; this endpoint is the only place writes happen.
 *
 * Body: { type, payload }
 *
 * Validates that the authenticated user actually participates in the
 * conversation referenced by payload, then dispatches to the right
 * underlying mutation (mirrors the same writes that /api/respond-
 * agreement, /api/conversations/[id]/change-proposal, and /api/send-
 * message already do — same shape, same RLS-equivalent ownership
 * check, just driven by the twin instead of UI buttons).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  type:
    | "update_proposal_text"
    | "accept_proposal"
    | "deny_proposal"
    | "send_message_to_conversation";
  payload: Record<string, any>;
};

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { type, payload } = body;
  if (!type || !payload) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const service = createServiceClient();

  // All four write actions need ownership of a conversation_id, so
  // do that check once up front.
  const conversation_id = String(payload.conversation_id || "").trim();
  if (!conversation_id) {
    return NextResponse.json(
      { error: "missing_conversation_id" },
      { status: 400 }
    );
  }
  const { data: conv } = await service
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("id", conversation_id)
    .maybeSingle();
  if (!conv) {
    return NextResponse.json(
      { error: "conversation_not_found" },
      { status: 404 }
    );
  }
  if (
    (conv as any).participant_a !== user.id &&
    (conv as any).participant_b !== user.id
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ── ACCEPT / DENY (writes agreement_responses) ───────────────────
  if (type === "accept_proposal" || type === "deny_proposal") {
    if (type === "accept_proposal") {
      const { error } = await service
        .from("agreement_responses")
        .upsert(
          {
            conversation_id,
            user_id: user.id,
            response: "accepted",
            reason: null
          },
          { onConflict: "conversation_id,user_id" }
        );
      if (error) {
        return NextResponse.json(
          { error: "save_failed", detail: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, action: "accepted" });
    }

    const reason = String(payload.reason || "").trim() || null;
    // Mirror the rejection pattern from /api/respond-agreement: reset
    // both sides' responses so the twins can renegotiate cleanly.
    await service
      .from("agreement_responses")
      .delete()
      .eq("conversation_id", conversation_id);
    const { error } = await service
      .from("agreement_responses")
      .insert({
        conversation_id,
        user_id: user.id,
        response: "rejected",
        reason
      });
    if (error) {
      return NextResponse.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, action: "rejected" });
  }

  // ── UPDATE PROPOSAL TEXT (rewrites conversation.summary + clears
  //    stale agreement_responses so both sides see the new proposal) ──
  if (type === "update_proposal_text") {
    const new_text = String(payload.new_text || "").trim();
    if (!new_text) {
      return NextResponse.json(
        { error: "missing_new_text" },
        { status: 400 }
      );
    }
    // Update the conversation summary itself — this is what the
    // conversation page + proposals page both read. (updated_at
    // column doesn't exist on this schema, so only set summary.)
    const { error: upErr } = await service
      .from("conversations")
      .update({ summary: new_text })
      .eq("id", conversation_id);
    if (upErr) {
      return NextResponse.json(
        { error: "save_failed", detail: upErr.message },
        { status: 500 }
      );
    }
    // Clear stale agreement_responses — the proposal changed so
    // existing accept/deny clicks no longer apply.
    await service
      .from("agreement_responses")
      .delete()
      .eq("conversation_id", conversation_id);
    return NextResponse.json({ ok: true, action: "updated" });
  }

  // ── SEND MESSAGE INTO CONVERSATION ──────────────────────────────
  if (type === "send_message_to_conversation") {
    const text = String(payload.text || "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "missing_text" },
        { status: 400 }
      );
    }
    const { error } = await service.from("messages").insert({
      conversation_id,
      sender_user_id: user.id,
      original_draft: text,
      final_text: text,
      edited: false,
      sent_at: new Date().toISOString()
    });
    if (error) {
      return NextResponse.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, action: "sent" });
  }

  return NextResponse.json(
    { error: `unknown action type: ${type}` },
    { status: 400 }
  );
}
