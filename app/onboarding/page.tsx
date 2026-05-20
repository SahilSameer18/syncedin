import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "../Wordmark";
import { OnboardingWizard } from "./OnboardingWizard";
import { SelfGraph } from "./SelfGraph";
import { LiveSyncMeter } from "./LiveSyncMeter";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: { saved?: string };
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

  return (
    <main className="max-w-6xl mx-auto px-6 pt-3 pb-8">
      <div className="flex items-center justify-between">
        <Wordmark />
        <Link href="/dashboard" className="retro-dim text-xs">
          dashboard &gt;
        </Link>
      </div>

      <h1 className="retro-h1 text-2xl mt-6">Build your twin</h1>
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
          <LiveSyncMeter formSelector="#onboarding-form" size={220} />
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
