"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { GlobeHeroVisual } from "./GlobeHeroVisual";

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
          SyncedIn builds an AI Twin of your professional self in about 60 seconds. It meets other people&apos;s Twins globally, filters thousands of profiles, and introduces you only to the founders, recruiters, mentors and collaborators genuinely worth your time.
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
            className="flex-1 h-12 px-4 rounded-xl bg-[#f3f0ff] border border-purple-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-purple-600 focus:bg-white shadow-sm"
          />
          <button
            type="submit"
            className="h-12 px-6 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition-colors whitespace-nowrap shadow-md"
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
            <span className="text-purple-600 font-bold">🌐</span> Global AI Twin Network
          </span>
        </div>

      </div>

      {/* Right Column: 3D Interactive Network Globe Visual */}
      <div className="lg:col-span-6 relative mt-4 lg:mt-0">
        <GlobeHeroVisual />
      </div>

    </div>
  );
}
