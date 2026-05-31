import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";
import { TwinChatUI } from "./TwinChatUI";

/**
 * Talk to your own twin (#159). A 1:1 chat surface where the user can
 * triage pending proposals, refine the twin's voice, or just think out
 * loud. The twin pulls live context from the user's twin_profiles row
 * + their pending proposals on every send.
 */
export const dynamic = "force-dynamic";

export default async function TwinPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/twin");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const selfName =
    ((profile as any)?.display_name as string) ||
    ((profile as any)?.email as string)?.split("@")[0] ||
    "you";

  return (
    <AppShell>
      <section className="mt-2">
        <div className="retro-label">chat</div>
        <h1 className="retro-h1 text-2xl sm:text-3xl mt-2 leading-tight">
          Chat with your twin.
        </h1>
        <p
          className="mt-2 text-sm sm:text-base leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          Your AI knows your goals, your voice, who's on the platform.
          Ask it who to reach out to, triage proposals, draft a message
          to send to anyone — this is your home base.
        </p>

        <div className="mt-6">
          <TwinChatUI selfName={selfName} />
        </div>
      </section>
    </AppShell>
  );
}
