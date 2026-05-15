"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function openConversationBetween(userId: string, otherId: string) {
  const supabase = createClient();
  // If a conversation between these two already exists, jump to it.
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(participant_a.eq.${userId},participant_b.eq.${otherId}),and(participant_a.eq.${otherId},participant_b.eq.${userId})`
    )
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ participant_a: userId, participant_b: otherId })
    .select("id")
    .single();
  if (error || !conv) {
    console.error("conversation insert failed", error);
    return null;
  }
  return conv.id as string;
}

/**
 * Start a conversation by email (kept for backwards compatibility — the new
 * UI uses startConversationByUserId).
 */
export async function startConversation(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/conversations/new?error=email");

  const service = createServiceClient();
  const { data: other } = await service
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!other) redirect("/conversations/new?error=not_found");
  if (other.id === user.id) redirect("/conversations/new?error=self");

  const convId = await openConversationBetween(user.id, other.id);
  if (!convId) redirect("/conversations/new?error=create");
  redirect(`/conversations/${convId}`);
}

/**
 * Start a conversation by user_id — used by the name-search + Exa picker UI.
 */
export async function startConversationByUserId(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const otherId = String(formData.get("user_id") ?? "").trim();
  if (!otherId) redirect("/conversations/new?error=not_found");
  if (otherId === user.id) redirect("/conversations/new?error=self");

  const convId = await openConversationBetween(user.id, otherId);
  if (!convId) redirect("/conversations/new?error=create");
  redirect(`/conversations/${convId}`);
}
