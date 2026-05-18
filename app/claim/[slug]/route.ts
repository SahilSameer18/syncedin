import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Atomic invite claim.
 *
 * Hit by `/auth/callback?next=/claim/<slug>` immediately after a new user
 * finishes magic-link / OAuth / password signup. We:
 *   1. Look up pending_invites by slug.
 *   2. If a conversation between (inviter, claimer) already exists, jump to it.
 *   3. Otherwise create that conversation, inject the inviter's twin's
 *      conversation_starter as message 1, and mark the invite claimed.
 *   4. Redirect into /conversations/<conversationId>.
 *
 * Idempotent: re-running with the same slug/user reuses the same conversation.
 * Skips claiming if the visitor is the same person as the inviter (treats it
 * as "preview your own invite" and just sends them to the dashboard).
 */
export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const url = new URL(req.url);
  const slug = (params.slug || "").toLowerCase();
  if (!slug) return NextResponse.redirect(`${url.origin}/dashboard`);

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    // Not signed in — bounce back through login carrying the invite slug.
    return NextResponse.redirect(`${url.origin}/login?invite=${slug}`);
  }

  const service = createServiceClient();
  const { data: invite } = await service
    .from("pending_invites")
    .select(
      "slug, inviter_user_id, conversation_starter, claimed_by_user_id, claimed_conversation_id"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!invite) {
    return NextResponse.redirect(`${url.origin}/dashboard?error=invite_not_found`);
  }

  // Inviter previewing their own invite — just go home.
  if (invite.inviter_user_id === user.id) {
    return NextResponse.redirect(`${url.origin}/${slug}`);
  }

  // Already claimed by someone ELSE — don't let a second visitor steal it.
  if (
    invite.claimed_by_user_id &&
    invite.claimed_by_user_id !== user.id
  ) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?error=invite_already_claimed`
    );
  }

  // Already claimed by THIS user previously — jump to the existing conversation.
  if (
    invite.claimed_by_user_id === user.id &&
    invite.claimed_conversation_id
  ) {
    return NextResponse.redirect(
      `${url.origin}/conversations/${invite.claimed_conversation_id}`
    );
  }

  // Find or create the conversation between inviter and claimer.
  const inviterId = invite.inviter_user_id as string;
  let conversationId: string | null = null;

  const { data: existing } = await service
    .from("conversations")
    .select("id")
    .or(
      `and(participant_a.eq.${inviterId},participant_b.eq.${user.id}),and(participant_a.eq.${user.id},participant_b.eq.${inviterId})`
    )
    .maybeSingle();

  if (existing) {
    conversationId = existing.id as string;
  } else {
    const { data: conv, error: convErr } = await service
      .from("conversations")
      .insert({
        participant_a: inviterId,
        participant_b: user.id
      })
      .select("id")
      .single();
    if (convErr || !conv) {
      console.error("[claim] conv insert failed", convErr);
      return NextResponse.redirect(
        `${url.origin}/dashboard?error=claim_create_failed`
      );
    }
    conversationId = conv.id as string;

    // Seed it with the conversation_starter as message 1 — sent FROM the
    // inviter's twin so the new user lands in a real, populated thread.
    const starter = (invite.conversation_starter || "").trim();
    if (starter) {
      await service.from("messages").insert({
        conversation_id: conversationId,
        sender_user_id: inviterId,
        original_draft: starter,
        final_text: starter,
        edited: false
      });
    }
  }

  // Mark the invite as claimed.
  await service
    .from("pending_invites")
    .update({
      claimed_by_user_id: user.id,
      claimed_conversation_id: conversationId
    })
    .eq("slug", slug);

  return NextResponse.redirect(
    `${url.origin}/conversations/${conversationId}`
  );
}
