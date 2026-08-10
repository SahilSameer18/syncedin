import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "./Wordmark";
import { LandingHandleHero } from "./LandingHandleHero";
import { FaqSection } from "./FaqSection";
import { TrackBeacon } from "./TrackBeacon";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  let realFaces: Array<{
    id: string;
    name: string;
    avatar_url: string;
    handle: string | null;
  }> = [];
  try {
    const service = createServiceClient();
    const { data: rows } = await service
      .from("profiles")
      .select("id, display_name, email, avatar_url, handle, last_active_at")
      .not("avatar_url", "is", null)
      .not("avatar_url", "ilike", "%dicebear%")
      .not("avatar_url", "ilike", "%robohash%")
      .not("avatar_url", "ilike", "%gravatar%")
      .order("last_active_at", { ascending: false, nullsFirst: false })
      .limit(8);
    realFaces = ((rows ?? []) as any[])
      .filter((r) => (r.display_name || r.email))
      .slice(0, 5)
      .map((r) => ({
        id: r.id as string,
        name: (r.display_name as string) || (r.email as string).split("@")[0],
        avatar_url: r.avatar_url as string,
        handle: (r.handle as string) ?? null
      }));
  } catch {
    /* fallback */
  }

  return (
    <main className="min-h-screen text-slate-900 selection:bg-purple-600 selection:text-white relative bg-[#f6f5ff]">
      <TrackBeacon meta={{ door: "landing" }} />

      {/* High-Contrast Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          
          {/* Left Brand Logo & Main Nav Links */}
          <div className="flex items-center gap-6 sm:gap-10">
            <Wordmark size="lg" href="/" />
            
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
              <Link href="/article" className="hover:text-purple-600 transition-colors">
                How it works
              </Link>
              <Link href="/twin" className="hover:text-purple-600 transition-colors">
                AI Twin
              </Link>
              <Link href="/match-lab" className="hover:text-purple-600 transition-colors">
                Product
              </Link>
              <Link href="#faq" className="hover:text-purple-600 transition-colors">
                FAQ
              </Link>
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3.5">
            <Link
              href="/login"
              className="text-sm font-bold text-slate-700 hover:text-purple-600 transition-colors px-2 py-1"
            >
              Sign in
            </Link>
            <Link
              href="/login?next=%2Fonboarding%3Fwelcome%3D1"
              className="btn-purple-pill text-xs sm:text-sm py-2.5 px-4 sm:px-5 whitespace-nowrap shadow-md shadow-purple-600/30"
            >
              Build my AI Twin
            </Link>
          </div>

        </div>
      </header>

      {/* Hero Conversion Surface */}
      <LandingHandleHero realFaces={realFaces} />

      {/* How it Works Grid Section */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
          <span className="px-3.5 py-1 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
            HOW IT WORKS
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Designed for high-velocity builders
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-medium">
            Your AI Twin acts as your personal scout, filter, and negotiator 24/7.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          
          <div className="glass-card-elevated p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 font-black text-lg flex items-center justify-center">
              01
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              60-Second Setup
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Connect your profile or paste your handle. Your Twin scaffolds your career focus, current projects, and ideal counterpart criteria automatically.
            </p>
          </div>

          <div className="glass-card-elevated p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 font-black text-lg flex items-center justify-center">
              02
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              768-Dim Vector Matching
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Our AI embedding engine continuously evaluates semantic complementarity across thousands of founders, investors, and engineers.
            </p>
          </div>

          <div className="glass-card-elevated p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-black text-lg flex items-center justify-center">
              03
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Double-Opt-In Intros
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Twins chat autonomously to establish mutual alignment. You get a pre-drafted intro with exact reasons why the match is worth your time.
            </p>
          </div>

        </div>
      </section>

      {/* Split 2-Column Q&A Section */}
      <FaqSection />

      {/* High-Contrast Vibrant Bottom CTA Card */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-purple-700 via-purple-800 to-indigo-900 text-white shadow-2xl shadow-purple-900/30 space-y-6 border border-purple-400/40">
          <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Build your AI Twin in 60 seconds
          </h3>
          <p className="text-purple-100 text-base sm:text-lg max-w-xl mx-auto font-medium leading-relaxed">
            Stop wasting time on cold DMs. Let your AI Twin introduce you to people genuinely worth talking to.
          </p>
          <div className="pt-4 flex justify-center">
            <Link
              href="/login?next=%2Fonboarding%3Fwelcome%3D1"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-purple-950 font-black text-base hover:bg-slate-100 transition-all shadow-2xl shadow-black/20 hover:scale-105"
            >
              <span>Build my AI Twin →</span>
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
