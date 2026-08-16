import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "../../AppShell";
import { FilesPanel } from "../../onboarding/FilesPanel";
import { AiExportsPanel } from "../../onboarding/AiExportsPanel";

export const dynamic = "force-dynamic";

export default async function TwinKnowledgePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/twin/knowledge");

  const service = createServiceClient();
  const [{ data: twin }, { count: fileCount }] = await Promise.all([
    service
      .from("twin_profiles")
      .select("goals, deal_preferences, ai_export_blob, deal_breakers, communication_style")
      .eq("user_id", user.id)
      .maybeSingle(),
    service
      .from("twin_files")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
  ]);

  // Compute Twin Precision dimensions
  const hasGoals = ((twin as any)?.goals || "").trim().length > 10;
  const hasDeals = ((twin as any)?.deal_preferences || "").trim().length > 10;
  const hasMemory = ((twin as any)?.ai_export_blob || "").trim().length > 50;
  const hasFiles = (fileCount ?? 0) > 0;

  const score =
    (hasGoals ? 25 : 0) +
    (hasDeals ? 25 : 0) +
    (hasMemory ? 25 : 0) +
    (hasFiles ? 25 : 0);

  return (
    <AppShell>
      <section className="space-y-6">
        {/* Header & Sub-Nav */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-purple-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
                🧠 Knowledge Vault
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Twin Knowledge & Files
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Feed your AI Twin pitch decks, resumes, and deep conversational memory from ChatGPT, Claude, and Gemini.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-2 bg-purple-100/60 p-1.5 rounded-2xl border border-purple-200/80 shrink-0 self-start sm:self-auto">
            <Link
              href="/twin"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-purple-900 transition-all"
            >
              💬 Chat Dojo
            </Link>
            <Link
              href="/twin/knowledge"
              className="px-4 py-2 rounded-xl text-xs font-black bg-white text-purple-900 shadow-sm transition-all"
            >
              🧠 Knowledge & Files
            </Link>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid gap-8 lg:grid-cols-[1fr_320px] items-start">
          {/* Main Column: Files & AI Exports */}
          <div className="space-y-8 min-w-0">
            {/* 1. Pitch Decks & Documents */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📎</span>
                <h2 className="text-lg font-black text-slate-900">
                  Documents & Pitch Decks
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Upload PDFs, one-pagers, or pitch decks (up to 50MB). Your Twin references these in high-synergy negotiations.
              </p>
              <FilesPanel />
            </div>

            {/* 2. Multi-Source AI Memory Exports */}
            <div className="space-y-3 pt-4 border-t border-purple-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h2 className="text-lg font-black text-slate-900">
                  Multi-Source AI Memory
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Import your depth from ChatGPT, Claude, Gemini, and Grok so your Twin inherits your authentic voice and projects.
              </p>
              <AiExportsPanel />
            </div>
          </div>

          {/* Right Rail: Precision Breakdown */}
          <div className="space-y-6 lg:sticky lg:top-20">
            {/* Readiness Card */}
            <div className="glass-card-elevated p-6 space-y-4 border border-purple-100 bg-white/95 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-purple-900 tracking-wider">
                  Twin Readiness
                </span>
                <span className="text-sm font-black text-purple-700">
                  {score}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-purple-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${score}%` }}
                />
              </div>

              {/* Checklist */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className={hasGoals ? "text-emerald-600" : "text-slate-300"}>
                      {hasGoals ? "✓" : "○"}
                    </span>
                    Primary Goals
                  </span>
                  <span className="text-slate-400 font-medium">+25%</span>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className={hasDeals ? "text-emerald-600" : "text-slate-300"}>
                      {hasDeals ? "✓" : "○"}
                    </span>
                    Offers & Deal-Breakers
                  </span>
                  <span className="text-slate-400 font-medium">+25%</span>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className={hasMemory ? "text-emerald-600" : "text-slate-300"}>
                      {hasMemory ? "✓" : "○"}
                    </span>
                    AI Memory Ingested
                  </span>
                  <span className="text-slate-400 font-medium">+25%</span>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className={hasFiles ? "text-emerald-600" : "text-slate-300"}>
                      {hasFiles ? "✓" : "○"}
                    </span>
                    Pitch Decks / Resumes
                  </span>
                  <span className="text-slate-400 font-medium">+25%</span>
                </div>
              </div>
            </div>

            {/* Quick Helper */}
            <div className="glass-card-elevated p-5 space-y-2 border border-purple-100 bg-purple-50/50 text-left">
              <div className="text-xs font-black uppercase text-purple-900 tracking-wider">
                🔒 Privacy & Access
              </div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Files and exports uploaded here are stored in your private encrypted vault. Your Twin extracts insights to negotiate on your behalf, but your raw files are never sent to third parties without your approval.
              </p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

