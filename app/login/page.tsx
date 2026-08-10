import Link from "next/link";
import {
  login,
  signInWithPassword,
  signUpWithPassword
} from "./actions";
import { Wordmark } from "../Wordmark";
import { OAuthButtons } from "./OAuthButtons";
import { createServiceClient } from "@/lib/supabase/server";
import { RealFacesStrip, type FaceRow } from "../[slug]/RealFacesStrip";

export default async function LoginPage({
  searchParams
}: {
  searchParams: {
    sent?: string;
    error?: string;
    detail?: string;
    invite?: string;
    conference?: string;
    exists?: string;
    next?: string;
  };
}) {
  const sent = searchParams.sent === "1";
  const exists = searchParams.exists === "1";
  const detail = searchParams.detail
    ? decodeURIComponent(searchParams.detail)
    : null;
  const nextTarget = searchParams.next || "";

  let faces: FaceRow[] = [];
  try {
    const service = createServiceClient();
    const { data: rows } = await service
      .from("profiles")
      .select("id, display_name, avatar_url, handle, portfolio_about, email")
      .not("avatar_url", "is", null)
      .not("display_name", "is", null)
      .neq("is_test_persona", true)
      .limit(40);
    const candidates = ((rows ?? []) as any[]).filter(
      (r) => (r.avatar_url || "").length > 8
    );
    const seeded = [...candidates].sort((a, b) =>
      (a.id as string).localeCompare(b.id as string)
    );
    faces = seeded.slice(0, 8).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      handle: r.handle,
      headline:
        (r.portfolio_about as string | null)?.split("\n")[0]?.slice(0, 110) ??
        null
    }));
  } catch {
    /* fallback */
  }

  return (
    <main className="min-h-screen bg-[#f6f5ff] text-slate-900 grid grid-cols-12 min-h-screen overflow-hidden">
      
      {/* LEFT COLUMN: Sophisticated Dark Onyx Panel (DESKTOP ONLY) */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-slate-950 text-white relative overflow-hidden flex-col justify-between p-12 select-none border-r border-slate-800">
        
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Brand Header */}
        <div className="relative z-20 flex items-center justify-between">
          <Wordmark size="lg" href="/" darkText={false} />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AI Network Active
          </span>
        </div>

        {/* Center Live AI Twin Match Showcase Card */}
        <div className="relative z-20 my-auto max-w-lg w-full mx-auto space-y-6">
          
          <div className="space-y-2 text-left">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-900 text-purple-400 border border-slate-800 uppercase">
              AUTONOMOUS AI MATCHING
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-100">
              Meet collaborators worth your time
            </h2>
            <p className="text-xs text-slate-400 font-normal">
              Your AI Twin negotiates pre-meeting alignment so you skip cold DMs.
            </p>
          </div>

          {/* Clean Dark Onyx Showcase Card */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            
            {/* Header Status */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <span className="text-slate-400 font-mono text-[11px]">TWIN INTELLIGENCE</span>
              <span className="font-bold text-emerald-400">86% MATCH FIT</span>
            </div>

            {/* Match Sample Card 1 */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                    alt="Sarah Chen"
                    className="w-8 h-8 rounded-full object-cover border border-slate-700"
                  />
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-100 leading-tight">Sarah Chen</div>
                    <div className="text-[10px] text-slate-400">Founder & CEO · Loomlane AI</div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  94% FIT
                </span>
              </div>
            </div>

            {/* Match Sample Card 2 */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                    alt="Marcus Hale"
                    className="w-8 h-8 rounded-full object-cover border border-slate-700"
                  />
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-100 leading-tight">Marcus Hale</div>
                    <div className="text-[10px] text-slate-400">Technical Recruiter · Northbeam Talent</div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  91% FIT
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* Bottom Feature Badges */}
        <div className="relative z-20 flex items-center justify-between text-xs text-slate-400 font-medium pt-6 border-t border-slate-800">
          <span>⚡ ~60 Second Setup</span>
          <span>🛡️ You Approve Every Intro</span>
          <span>⚡ 768-Dim Vector Engine</span>
        </div>

      </div>

      {/* RIGHT COLUMN: Auth Form Surface (VISIBLE ON ALL DEVICES) */}
      <div className="col-span-12 lg:col-span-6 xl:col-span-5 flex flex-col justify-between p-6 sm:p-12 overflow-y-auto relative bg-[#f6f5ff]">
        
        {/* Top Back Link & Mobile Logo */}
        <div className="flex items-center justify-between pb-4">
          <Link href="/" className="text-xs font-bold text-slate-600 hover:text-purple-600 transition-colors flex items-center gap-1">
            ← Back to website
          </Link>
          <div className="lg:hidden">
            <Wordmark size="md" href="/" darkText={true} />
          </div>
        </div>

        {/* Form Container */}
        <div className="my-auto py-6 space-y-6 max-w-md w-full mx-auto">
          
          <div className="space-y-1.5 text-left">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {nextTarget.includes("twin") ? "Access Your AI Twin" : "Welcome to SyncedIn"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              {nextTarget.includes("twin") ? "Sign in to manage your AI Twin representation" : "Sign in or create your personal AI Twin account"}
            </p>
          </div>

          {/* Primary Google Auth Button */}
          <OAuthButtons
            invite={searchParams.invite}
            conference={searchParams.conference}
            next={nextTarget}
          />

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-slate-200" />
            <span className="absolute bg-[#f6f5ff] px-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              or magic link
            </span>
          </div>

          {/* Magic Link Form */}
          <form className="space-y-3">
            <input type="hidden" name="invite" value={searchParams.invite ?? ""} />
            <input type="hidden" name="conference" value={searchParams.conference ?? ""} />
            <input type="hidden" name="next" value={nextTarget} />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@domain.com"
              className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-purple-600 shadow-sm transition-all"
            />
            <button
              formAction={login}
              className="w-full h-11 rounded-xl btn-purple-pill text-xs font-bold shadow-md shadow-purple-600/20"
            >
              Email Me a Magic Link
            </button>
          </form>

          {sent && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center font-semibold">
              ✓ Check your inbox — we sent your instant sign-in link!
            </div>
          )}

          {exists && (
            <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1">
              <p className="font-bold">Account Found</p>
              <p className="text-slate-600">
                We emailed a sign-in link to your address. Open it to get straight in, or use your password below.
              </p>
            </div>
          )}

          {/* Password Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-slate-200" />
            <span className="absolute bg-[#f6f5ff] px-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              or password
            </span>
          </div>

          {/* Email + Password Form */}
          <form className="space-y-3">
            <input type="hidden" name="invite" value={searchParams.invite ?? ""} />
            <input type="hidden" name="conference" value={searchParams.conference ?? ""} />
            <input type="hidden" name="next" value={nextTarget} />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@domain.com"
              className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-purple-600 shadow-sm transition-all"
            />
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="password (8+ characters)"
              className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-purple-600 shadow-sm transition-all"
            />
            <div className="flex gap-2">
              <button
                formAction={signInWithPassword}
                className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
              >
                Sign In
              </button>
              <button
                formAction={signUpWithPassword}
                className="flex-1 h-11 rounded-xl bg-white border border-slate-200 hover:border-purple-300 text-slate-800 font-bold text-xs transition-colors"
              >
                Create Account
              </button>
            </div>
          </form>

          {searchParams.error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
              <p className="font-bold">Authentication Error</p>
              {detail && <p className="text-slate-600">{detail}</p>}
            </div>
          )}

        </div>

        {/* Right Footer Links & Member Strip */}
        <div className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-500">
            <Link href="/privacy" className="hover:text-purple-600 transition-colors">Privacy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-purple-600 transition-colors">Terms</Link>
            <span>•</span>
            <Link href="/support" className="hover:text-purple-600 transition-colors">Support</Link>
            <span>•</span>
            <a href="mailto:support@syncedin.app" className="hover:text-purple-600 transition-colors">Contact</a>
          </div>

          {faces.length > 0 && (
            <div className="w-full">
              <RealFacesStrip faces={faces} />
            </div>
          )}
        </div>

      </div>

    </main>
  );
}
