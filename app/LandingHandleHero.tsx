"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function LandingHandleHero({
  realFaces = []
}: {
  realFaces?: Array<{
    id: string;
    name: string;
    avatar_url: string;
    handle: string | null;
  }>;
} = {}) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  const handleStart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (busy) return;
    setBusy(true);
    if (handle.trim()) {
      try {
        sessionStorage.setItem(
          "syncedin.signupIntent",
          JSON.stringify({ profile_url: handle.trim(), platform: "linkedin" })
        );
      } catch {
        /* private mode */
      }
    }
    router.push(`/login?next=${encodeURIComponent("/onboarding?welcome=1")}`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-12 sm:pb-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
      
      {/* Left Column: Hero Copy & CTA */}
      <div className="lg:col-span-6 space-y-5 sm:space-y-6 text-left">
        
        {/* Version Badge Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100/70 border border-purple-200 text-purple-800 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
          <span>SyncedIn v2 — AI networking, rebuilt</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
          Your personal <br className="hidden sm:block" />
          <span className="purple-gradient-text">AI networking agent</span>
        </h1>

        {/* Paragraph Copy */}
        <p className="text-slate-600 text-sm sm:text-lg leading-relaxed font-normal max-w-xl">
          SyncedIn builds an AI Twin of your professional self in about 60 seconds. It meets other people's Twins, filters thousands of profiles, and introduces you only to the recruiters, founders, mentors and collaborators genuinely worth your time — with the reason and the first message already written.
        </p>

        {/* CTA Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <Link
            href="/login?next=%2Fonboarding%3Fwelcome%3D1"
            className="btn-purple-pill py-3 px-6 text-center text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25"
          >
            <span>Build my AI Twin</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>

          <Link
            href="/match-lab"
            className="btn-secondary-pill py-3 px-6 text-center text-sm sm:text-base"
          >
            <span>See a live demo</span>
          </Link>
        </div>

        {/* Quick Input Bar */}
        <form onSubmit={handleStart} className="pt-2 max-w-lg flex flex-col sm:flex-row items-stretch gap-2">
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="Paste your LinkedIn URL or handle..."
            className="flex-1 h-12 px-4 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-purple-600 shadow-sm"
          />
          <button
            type="submit"
            className="h-12 px-6 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Claim Handle
          </button>
        </form>

        {/* Micro-trust bullets */}
        <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="text-purple-600 font-bold">⚡</span> ~60 second setup
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-purple-600 font-bold">🛡️</span> You approve every intro
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-purple-600 font-bold">⚡</span> No forms, no cold outreach
          </span>
        </div>

      </div>

      {/* Right Column: Live Interactive Dashboard Widget */}
      <div className="lg:col-span-6 relative mt-4 lg:mt-0">
        
        {/* Glow backdrop */}
        <div className="absolute -top-10 -right-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Browser Window Card */}
        <div className="glass-card-elevated p-5 sm:p-7 relative z-10 space-y-4 sm:space-y-5">
          
          {/* Window dots & path header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
            </div>
            <span className="text-[11px] sm:text-xs">syncedin.app / dashboard</span>
          </div>

          {/* Twin Intelligence Box */}
          <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-100 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold tracking-wider text-slate-700 uppercase">
              <span>TWIN INTELLIGENCE</span>
              <span className="text-purple-700 text-sm font-extrabold">86%</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-2.5 rounded-full bg-purple-200/70 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full w-[86%]" />
            </div>

            {/* Sub metrics */}
            <div className="grid grid-cols-4 gap-1 sm:gap-2 pt-1 text-center border-t border-purple-100/80">
              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Career</div>
                <div className="text-xs font-black text-slate-800">82%</div>
              </div>
              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Projects</div>
                <div className="text-xs font-black text-slate-800">76%</div>
              </div>
              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Skills</div>
                <div className="text-xs font-black text-slate-800">78%</div>
              </div>
              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Comm</div>
                <div className="text-xs font-black text-slate-800">70%</div>
              </div>
            </div>
          </div>

          {/* Match Card 1 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-100 hover:border-purple-200 transition-all shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&q=80"
                  alt="Sarah Chen"
                  width={36}
                  height={36}
                  loading="lazy"
                  decoding="async"
                  className="w-9 h-9 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Sarah Chen</div>
                  <div className="text-[11px] sm:text-xs text-slate-500">Founder & CEO · Loomlane AI</div>
                </div>
              </div>
              <span className="px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                94%
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-2.5 rounded-xl">
              "Hi Sarah — our AI Twins noticed we're both building agentic products, from opposite ends of the stack. I'd love to compare notes on evals."
            </p>
          </div>

          {/* Match Card 2 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-100 hover:border-purple-200 transition-all shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&q=80"
                  alt="Marcus Hale"
                  width={36}
                  height={36}
                  loading="lazy"
                  decoding="async"
                  className="w-9 h-9 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Marcus Hale</div>
                  <div className="text-[11px] sm:text-xs text-slate-500">Technical Recruiter · Northbeam Talent</div>
                </div>
              </div>
              <span className="px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                91%
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-2.5 rounded-xl">
              "Hi Marcus — my AI Twin flagged your open AI infra roles as a strong fit for what I've shipped. Worth a short call?"
            </p>
          </div>

          {/* Overnight Activity Toast */}
          <div className="p-3 rounded-xl bg-purple-700 text-white text-xs font-medium flex items-center justify-between shadow-lg shadow-purple-600/20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] sm:text-xs">Your Twin screened 1,284 profiles overnight</span>
            </div>
            <span className="font-bold text-[11px]">Active</span>
          </div>

        </div>

      </div>

    </div>
  );
}
