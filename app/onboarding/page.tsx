import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../Wordmark";
import { OnboardingWizard } from "./OnboardingWizard";
import { SelfMap } from "./SelfMap";
import { LiveSyncMeter } from "./LiveSyncMeter";
import { WelcomeSplash } from "./WelcomeSplash";
import { TypingParticles } from "./TypingParticles";
import { AiExportsPanel } from "./AiExportsPanel";
import { FilesPanel } from "./FilesPanel";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: {
    saved?: string;
    welcome?: string;
    fromInvite?: string;
    conv?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: twin } = await supabase
    .from("twin_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const service = createServiceClient();
  const { data: myMessageConvs } = await service
    .from("messages")
    .select("conversation_id")
    .eq("sender_user_id", user.id);
  const completedConversations = new Set(
    ((myMessageConvs ?? []) as Array<{ conversation_id: string }>).map(
      (m) => m.conversation_id
    )
  ).size;
  const { count: acceptedAgreementsCount } = await service
    .from("agreement_responses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("response", "accepted");
  const { count: editCount } = await service
    .from("edit_deltas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const initial = {
    display_name: profile?.display_name ?? "",
    goals: twin?.goals ?? "",
    deal_preferences: twin?.deal_preferences ?? "",
    communication_style: twin?.communication_style ?? "",
    deal_breakers: twin?.deal_breakers ?? "",
    ai_export_blob: twin?.ai_export_blob ?? "",
    avatar_url: profile?.avatar_url ?? "",
    hometown: (twin as any)?.hometown ?? "",
    current_city: (twin as any)?.current_city ?? "",
    achievements: (twin as any)?.achievements ?? ""
  };

  const showWelcome = searchParams.welcome === "1";
  let inviterName: string | null = null;
  if (showWelcome && searchParams.fromInvite) {
    const { data: invite } = await service
      .from("pending_invites")
      .select("inviter_user_id")
      .eq("slug", searchParams.fromInvite)
      .maybeSingle();
    if (invite?.inviter_user_id) {
      const { data: ip } = await service
        .from("profiles")
        .select("display_name, email")
        .eq("id", invite.inviter_user_id)
        .maybeSingle();
      inviterName =
        (ip as any)?.display_name ||
        ((ip as any)?.email ? (ip as any).email.split("@")[0] : null);
    }
  }
  const firstNameForWelcome = (initial.display_name || "").trim().split(/\s+/)[0] || "";

  return (
    <main className="min-h-screen bg-[#f6f5ff] text-slate-900 selection:bg-purple-600 selection:text-white pb-20">
      
      {/* Typing Particles */}
      <TypingParticles />

      {/* Sticky Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Wordmark size="lg" href="/" />
          
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
              60-sec Setup
            </span>
            <Link
              href="/dashboard"
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-purple-600 transition-colors"
            >
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        
        {showWelcome && (
          <WelcomeSplash
            firstName={firstNameForWelcome}
            avatarUrl={initial.avatar_url || null}
            inviterName={inviterName}
            conversationId={searchParams.conv || null}
          />
        )}

        {searchParams.saved === "1" && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            ✓ Your AI Twin settings have been saved!
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          <div className="min-w-0 space-y-6">
            <OnboardingWizard initial={initial} userId={user.id} />
            
            {/* AI Context Sources */}
            <div className="space-y-6 pt-4">
              <AiExportsPanel />
              <FilesPanel />
            </div>
          </div>

          {/* Right Rail: Sync Meter */}
          <div data-sync-meter className="sticky top-20">
            <LiveSyncMeter
              formSelector="#onboarding-form"
              size={150}
              completedConversations={completedConversations}
              acceptedAgreements={acceptedAgreementsCount ?? 0}
              editCount={editCount ?? 0}
            />
          </div>
        </div>

        {/* Bottom Psychometric Map */}
        <section className="mt-12">
          <SelfMap formSelector="#onboarding-form" />
        </section>

      </div>

    </main>
  );
}
