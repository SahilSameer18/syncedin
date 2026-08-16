import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";
import { TwinChatUI } from "./TwinChatUI";
import { PendingProposalsRail } from "./PendingProposalsRail";
import { pickBestFirstMatch } from "@/lib/matchmaking";

export const dynamic = "force-dynamic";

export default async function TwinPage({
  searchParams
}: {
  searchParams?: { welcome?: string };
}) {
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

  const isWelcome = (searchParams?.welcome ?? "") === "1";
  let welcomeMatch: string | null = null;
  if (isWelcome) {
    try {
      const m = await pickBestFirstMatch(user.id);
      if ((m as any)?.counterpartId) {
        const { data: cp } = await service
          .from("profiles")
          .select("display_name, handle")
          .eq("id", (m as any).counterpartId)
          .maybeSingle();
        welcomeMatch =
          ((cp as any)?.display_name as string) ||
          ((cp as any)?.handle as string) ||
          null;
      }
    } catch {
      /* greeting falls back to a generic match offer */
    }
  }

  return (
    <AppShell>
      <section className="space-y-4">
        {/* Modern Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-purple-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                Live Twin Dojo
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Chat with your AI Twin
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Your private command home. Ask who to reach out to, test its responses, or triage proposals.
            </p>
          </div>

          {/* Sub-Nav Tabs */}
          <div className="flex items-center gap-2 bg-purple-100/60 p-1.5 rounded-2xl border border-purple-200/80 shrink-0 self-start sm:self-auto">
            <Link
              href="/twin"
              className="px-4 py-2 rounded-xl text-xs font-black bg-white text-purple-900 shadow-sm transition-all"
            >
              💬 Chat Dojo
            </Link>
            <Link
              href="/twin/knowledge"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-purple-900 transition-all"
            >
              🧠 Knowledge & Files
            </Link>
          </div>
        </div>

        {/* 2-Column Grid: Chat on Left, Proposals Rail on Right */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
          <div className="min-w-0">
            <TwinChatUI
              selfName={selfName}
              welcome={isWelcome}
              welcomeMatch={welcomeMatch}
            />
          </div>
          <div className="hidden lg:block lg:sticky lg:top-20">
            <PendingProposalsRail />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
