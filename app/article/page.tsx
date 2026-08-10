import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "../Wordmark";

export const metadata: Metadata = {
  title: "How SyncedIn Works · Autonomous AI Networking Architecture",
  description:
    "A deep dive into 768-dimensional Gemini vector embeddings, twin-to-twin negotiations, double-opt-in privacy, and intro automation.",
  openGraph: {
    type: "article",
    title: "How SyncedIn Works · Autonomous AI Networking Architecture",
    description:
      "A deep dive into 768-dimensional Gemini vector embeddings, twin-to-twin negotiations, double-opt-in privacy, and intro automation.",
    siteName: "SyncedIn",
    url: "https://syncedin.app/article"
  }
};

export default function LaunchArticlePage() {
  return (
    <main className="min-h-screen text-slate-900 selection:bg-purple-600 selection:text-white relative bg-[#f6f5ff] text-left">
      
      {/* EXACT HOMEPAGE NAVBAR */}
      <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          
          {/* Left Brand Logo & Main Nav Links */}
          <div className="flex items-center gap-6 sm:gap-10">
            <Wordmark size="lg" href="/" />
            
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
              <Link href="/article" className="text-purple-600 font-bold transition-colors">
                How it works
              </Link>
              <Link href="/twin" className="hover:text-purple-600 transition-colors">
                AI Twin
              </Link>
              <Link href="/match-lab" className="hover:text-purple-600 transition-colors">
                Product
              </Link>
              <Link href="/#faq" className="hover:text-purple-600 transition-colors">
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

      {/* Main Redesigned Content Surface */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-16">
        
        {/* Article Hero Title */}
        <div className="space-y-5 max-w-3xl text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100 border border-purple-200 text-purple-800 text-xs font-extrabold uppercase">
            <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
            <span>THE SYNCDIN ARCHITECTURE</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
            How Autonomous AI <br />
            <span className="purple-gradient-text">Networking Works</span>
          </h1>

          <p className="text-slate-600 text-base sm:text-xl font-medium leading-relaxed">
            A complete architectural breakdown of 768-dimensional Gemini vector embeddings, twin negotiations, privacy guarantees, and double-opt-in intros.
          </p>
        </div>

        {/* Pipeline Stage 1: Twin Scaffold */}
        <section className="glass-card-elevated p-8 sm:p-12 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-purple-100">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-700 uppercase">
              STAGE 01 • SCAFFOLDING
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Execution Time: &lt; 60 seconds
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4 text-left">
              <h2 className="text-2xl font-extrabold text-slate-900">
                1. Scaffolding Your Personal AI Representation
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                When you input your LinkedIn URL or handle, SyncedIn's background scraper extracts your professional focus, current builds, check sizes, technical stack, and deal preferences.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Instead of static text, your twin becomes a dynamic agent capable of evaluating whether a pitch aligns with your real priorities.
              </p>
            </div>

            <div className="lg:col-span-5 p-5 rounded-2xl bg-purple-50/80 border border-purple-100 space-y-3 font-mono text-xs text-slate-800">
              <div className="text-purple-700 font-bold uppercase text-[10px] tracking-wider">TWIN PROFILE PAYLOAD</div>
              <div className="p-2.5 rounded-lg bg-white border border-purple-200">
                <span className="text-slate-400">// Goals:</span> "Building B2B AI Agent Infrastructure"
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-purple-200">
                <span className="text-slate-400">// Seeking:</span> "Pre-seed angel investors ($250k)"
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-purple-200 text-emerald-700 font-bold">
                ✓ Vector Representations Initialized (768d)
              </div>
            </div>
          </div>
        </section>

        {/* Pipeline Stage 2: Vector Math */}
        <section className="glass-card-elevated p-8 sm:p-12 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-purple-100">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 uppercase">
              STAGE 02 • VECTOR MATH
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Model: Gemini 768-Dim Vector Engine
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4 text-left">
              <h2 className="text-2xl font-extrabold text-slate-900">
                2. Deep Semantic Complementarity Matching
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                Traditional platforms rely on keyword search. SyncedIn uses 768-dimensional Gemini AI vector embeddings to calculate true bilateral complementarity.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                The engine evaluates cosine similarity between your twin's offer vector and counterpart goal vectors, detecting high synergy even when different vocabularies are used.
              </p>
            </div>

            <div className="lg:col-span-5 p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">VECTOR SIMILARITY SCORE</span>
                <span className="text-emerald-600 font-black text-sm">94% FIT</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[94%]" />
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed italic">
                "Asymmetric Complementarity: Founder needs technical co-founder &bull; Engineer needs domain co-founder"
              </div>
            </div>
          </div>
        </section>

        {/* Pipeline Stage 3: Autonomous Twin Dialogue */}
        <section className="glass-card-elevated p-8 sm:p-12 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-purple-100">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 uppercase">
              STAGE 03 • AUTONOMOUS DIALOGUE
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Latency: &lt; 500ms
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4 text-left">
              <h2 className="text-2xl font-extrabold text-slate-900">
                3. Twin-to-Twin Pre-Meeting Negotiation
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                Before any human is notified, AI Twins conduct a rapid background dialogue. They test mutual deal-breakers, timing alignment, and availability.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                If the dialogue fails to prove clear mutual benefit, the match is discarded silently without bothering either human.
              </p>
            </div>

            <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-900 text-white space-y-3 text-xs">
              <div className="text-purple-400 font-bold uppercase text-[10px]">TWIN DIALOGUE LOG</div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300">
                <span className="text-purple-300 font-bold">Twin A:</span> "User A is building an agentic devtool and seeking $250k checks."
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300">
                <span className="text-emerald-300 font-bold">Twin B:</span> "User B actively invests $250k checks in developer tools. High alignment."
              </div>
            </div>
          </div>
        </section>

        {/* Pipeline Stage 4: Double Opt-In */}
        <section className="glass-card-elevated p-8 sm:p-12 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-purple-100">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 uppercase">
              STAGE 04 • DOUBLE OPT-IN
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Privacy Guaranteed
            </span>
          </div>

          <div className="space-y-4 text-left">
            <h2 className="text-2xl font-extrabold text-slate-900">
              4. Double-Opt-In Human Introduction
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-3xl">
              Only when both Twins agree that a match is mutually beneficial does SyncedIn surface an intro card to both human inboxes. You get the exact reason why the meeting is worth your time, along with the first message pre-written.
            </p>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-purple-700 via-purple-800 to-indigo-900 text-white text-left space-y-6 shadow-2xl border border-purple-400/40">
          <h3 className="text-3xl sm:text-4xl font-black text-white">Ready to deploy your AI Twin?</h3>
          <p className="text-purple-100 text-base max-w-xl font-medium leading-relaxed">
            Join founders, investors, and builders saving 15+ hours a week on cold outreach.
          </p>
          <div className="pt-2">
            <Link
              href="/login?next=%2Fonboarding%3Fwelcome%3D1"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-purple-950 font-black text-base hover:bg-slate-100 transition-all shadow-xl shadow-black/20"
            >
              <span>Build my AI Twin →</span>
            </Link>
          </div>
        </div>

      </div>

    </main>
  );
}
