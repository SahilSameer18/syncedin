import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "../Wordmark";
import { OnboardingWizard } from "./OnboardingWizard";
import { SelfGraph } from "./SelfGraph";
import { LiveSyncMeter } from "./LiveSyncMeter";
import { WelcomeSplash } from "./WelcomeSplash";

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

  // Activity counts for the live sync meter — same fetches the dashboard
  // runs, so the % shown here matches the % shown on /dashboard exactly.
  // Without these the meter only saw form fields and was always lower.
  const service = createServiceClient();
  const { data: myConvs } = await service
    .from("conversations")
    .select("id, status, participant_a, participant_b")
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`);
  const completedConversations = (myConvs ?? []).filter(
    (c: any) => c.status === "closed"
  ).length;
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
    current_city: (twin as any)?.current_city ?? ""
  };

  // Welcome-splash data — only used when ?welcome=1 is in the URL (set
  // either by /auth/callback for brand-new signups or by /claim/<slug>
  // for invite-claimed users). Pulls the inviter display name from the
  // pending_invite if a slug was passed so we can show "Jack already has
  // a conversation waiting for you."
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
    <main className="max-w-6xl mx-auto px-6 pt-2 pb-8">
      {/* Top nav row — kept tight. The empty vertical band the user
          flagged was the Wordmark's natural baseline gap + the mt-6 on
          the H1 below; reduced both so step 1 ships above the fold. */}
      <div className="flex items-center justify-between" style={{ minHeight: 32 }}>
        <Wordmark />
        <Link href="/dashboard" className="retro-dim text-xs">
          dashboard &gt;
        </Link>
      </div>

      {showWelcome && (
        <WelcomeSplash
          firstName={firstNameForWelcome}
          avatarUrl={initial.avatar_url || null}
          inviterName={inviterName}
          conversationId={searchParams.conv || null}
        />
      )}

      <h1 className="retro-h1 text-2xl mt-3">Build your twin</h1>
      <p className="mt-1 retro-dim text-sm">
        Five quick steps. Each one sharpens how your clone shows up for you.
      </p>

      {searchParams.saved === "1" && (
        <p className="mt-3 text-sm retro-green">✓ Saved.</p>
      )}

      <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="min-w-0">
          <OnboardingWizard initial={initial} userId={user.id} />
        </div>

        {/* Right rail — live SyncMeter (sci-fi-upload power core). Fills
            in real time as the user adds context. Replaces the old
            SelfGraph here; the topographic visual now lives at the
            bottom of the page where it can render full-width. */}
        <div>
          <LiveSyncMeter
            formSelector="#onboarding-form"
            size={220}
            completedConversations={completedConversations}
            acceptedAgreements={acceptedAgreementsCount ?? 0}
            editCount={editCount ?? 0}
          />
        </div>
      </div>

      {/* Self-graph at the bottom — full-width, more breathing room for
          the constellation cards. Renders only when the user has some
          context; otherwise the placeholder lives inside SelfGraph itself. */}
      <section className="mt-12">
        <SelfGraph formSelector="#onboarding-form" />
      </section>
    </main>
  );
}
