import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasAgreement, MAX_AUTO_TURNS } from "@/lib/twin-prompt";
import { ChatUI } from "./ChatUI";
import type { Message, AgreementResponse } from "@/lib/types";

export default async function ConversationPage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!conv) notFound();
  if (conv.participant_a !== user.id && conv.participant_b !== user.id) {
    notFound();
  }

  const otherId =
    conv.participant_a === user.id ? conv.participant_b : conv.participant_a;

  const service = createServiceClient();
  const [{ data: otherProfile }, { data: selfProfile }] = await Promise.all([
    service
      .from("profiles")
      .select("id, display_name, email, is_test_persona")
      .eq("id", otherId)
      .single(),
    service
      .from("profiles")
      .select("id, display_name, email")
      .eq("id", user.id)
      .single()
  ]);

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", params.id)
    .order("sent_at", { ascending: true });

  const { data: responses } = await supabase
    .from("agreement_responses")
    .select("*")
    .eq("conversation_id", params.id);

  const msgs = (messages as Message[]) ?? [];
  const last = msgs[msgs.length - 1];
  const done =
    msgs.length >= MAX_AUTO_TURNS ||
    (Boolean(last) && hasAgreement(last.final_text));

  const resps = (responses as AgreementResponse[]) ?? [];
  const myResponse = resps.find((r) => r.user_id === user.id) ?? null;
  const otherResponse = resps.find((r) => r.user_id === otherId) ?? null;

  return (
    <ChatUI
      conversationId={params.id}
      selfUserId={user.id}
      selfName={selfProfile!.display_name ?? selfProfile!.email}
      other={{
        id: otherProfile!.id,
        name: otherProfile!.display_name ?? otherProfile!.email,
        isTestPersona: otherProfile!.is_test_persona
      }}
      initialMessages={msgs}
      initialDone={done}
      initialMyResponse={
        myResponse ? { response: myResponse.response } : null
      }
      initialOtherResponse={
        otherResponse
          ? { response: otherResponse.response, reason: otherResponse.reason }
          : null
      }
    />
  );
}
