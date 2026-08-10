"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface MatchResult {
  score: number | null;
  headline: string;
  green_flag: string;
  fit_note: string;
  win_win: string;
  first_step?: string;
}

interface ProfilePreviewFormProps {
  handle: string;
  name: string;
}

const STARTER_PROMPTS = [
  {
    label: "🤝 Co-Founder Fit",
    text: "I'm a senior full-stack engineer exploring early-stage AI startups. Looking for a high-velocity domain co-founder."
  },
  {
    label: "💼 Seed Investment",
    text: "We invest pre-seed/seed checks ($250k–$1M) in applied AI, devtools, and agent platforms with strong technical founders."
  },
  {
    label: "⚡ Strategic Partnership",
    text: "Building enterprise AI distribution and looking for complementary product teams to partner on joint pilots."
  }
];

export function ProfilePreviewForm({ handle, name }: ProfilePreviewFormProps) {
  const [pitch, setPitch] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!result || typeof result.score !== "number") return;
    setDisplayedScore(0);
    const target = result.score;
    const duration = 600;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = target / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setDisplayedScore(target);
        clearInterval(timer);
      } else {
        setDisplayedScore(Math.floor(current));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [result]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pitch.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setRateLimited(false);

    try {
      const res = await fetch("/api/profile-preview-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, context: pitch.trim() })
      });

      if (res.status === 429) {
        setRateLimited(true);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to calculate match preview.");
      }

      const data: MatchResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clean-card p-6 sm:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-purple-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>⚡ Test Synergy with {name}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Pitch your goals to preview real-time AI vector compatibility.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
          AI Twin Sandbox
        </span>
      </div>

      {/* Starter Chips */}
      <div className="flex flex-wrap gap-2">
        {STARTER_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setPitch(p.text)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-50/60 hover:bg-purple-100 text-purple-800 border border-purple-200 transition-all text-left"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          placeholder={`What are you working on or looking for? Pitch your goals to ${name}'s AI twin...`}
          rows={3}
          className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-purple-600 transition-all resize-none"
        />

        <button
          type="submit"
          disabled={loading || !pitch.trim()}
          className="w-full btn-purple-pill text-sm py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-600/20"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Simulating AI Synergy...</span>
            </span>
          ) : (
            <span>Simulate AI Match Score</span>
          )}
        </button>
      </form>

      {/* Rate Limit Alert */}
      {rateLimited && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          You've reached the guest preview limit. <Link href={`/login?next=/u/${handle}`} className="underline font-bold">Sign in to SyncedIn</Link> to run unlimited comparisons.
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {error}
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="p-6 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-4 animate-fadeIn">
          
          <div className="flex items-center justify-between pb-3 border-b border-purple-200/60">
            <div>
              <div className="text-2xl font-black text-purple-900">
                {displayedScore}% <span className="text-xs font-semibold text-purple-700">Match Fit</span>
              </div>
              <p className="text-xs font-bold text-slate-800 mt-0.5">{result.headline}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-purple-600/30">
              {displayedScore}%
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <div><strong className="text-emerald-700">🟢 Green Flag:</strong> {result.green_flag}</div>
            <div><strong className="text-purple-700">⚡ Synergy Fit:</strong> {result.fit_note}</div>
            <div><strong className="text-indigo-700">🤝 Win-Win:</strong> {result.win_win}</div>
          </div>

          <div className="pt-3 border-t border-purple-200/60 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Want to connect with {name}?</span>
            <Link
              href={`/login?next=${encodeURIComponent(`/conversations/new?to=${handle}`)}`}
              className="btn-purple-pill text-xs py-2 px-4 whitespace-nowrap"
            >
              Start Conversation
            </Link>
          </div>

        </div>
      )}

    </div>
  );
}

export function ShareButton({ name, handle }: { name: string; handle: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : `https://syncedin.app/u/${handle}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name} on SyncedIn`,
          text: `Check out ${name}'s AI Twin portfolio on SyncedIn!`,
          url
        });
        return;
      } catch {
        /* fallback */
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="btn-secondary-pill text-xs py-1.5 px-4 flex items-center gap-1.5"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      <span>{copied ? "Link Copied!" : "Share Profile"}</span>
    </button>
  );
}
