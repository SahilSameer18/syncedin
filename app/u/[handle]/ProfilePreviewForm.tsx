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
    label: "⚡ Partnership",
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

  // Smooth analytical score count-up animation
  useEffect(() => {
    if (!result || typeof result.score !== "number") return;
    setDisplayedScore(0);
    const target = result.score;
    const duration = 500;
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

      const data = await res.json();

      if (res.status === 429 || data.error === "limit_reached") {
        setRateLimited(true);
        setResult({
          score: null,
          headline: "Preview Limit Reached",
          green_flag: "You've used your allocated guest preview queries for this session.",
          fit_note: "Sign up to unlock continuous AI Twin screening and autonomous matchmaking.",
          win_win: data.message || "Create your twin to screen unlimited inbound opportunities."
        });
      } else if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setResult({
          score: typeof data.score === "number" ? data.score : 78,
          headline: data.headline || "Compatibility Analysis",
          green_flag: data.green_flag || "Complementary goals and domain synergy.",
          fit_note: data.fit_note || "Verify timeline and working styles.",
          win_win: data.win_win || data.winwin || "High mutual leverage opportunity.",
          first_step: data.first_step || "Reach out to start a conversation."
        });
      }
    } catch (err: any) {
      setError("Failed to connect to the twin screening engine. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const ctaLink = `/login?next=/u/${handle}`;

  // =========================================================================
  // State 1: Match Result (Analytical Compatibility Brief)
  // =========================================================================
  if (result) {
    const isHigh = (result.score ?? 0) >= 75;
    const isModerate = (result.score ?? 0) >= 50 && (result.score ?? 0) < 75;
    const scoreColor = isHigh
      ? "var(--green)"
      : isModerate
      ? "var(--amber-bright)"
      : "var(--text-dim)";
    const tierLabel = isHigh
      ? "Strong Alignment"
      : isModerate
      ? "Moderate Alignment"
      : "Exploratory Fit";

    return (
      <div className="mt-4 rounded-xl border border-[var(--border-bright)] bg-[var(--panel-solid)] p-5 sm:p-6 shadow-sm transition-all duration-300">
        {/* Analytical Score & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-4">
            {result.score !== null ? (
              <div
                className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-mono font-bold border transition-colors duration-300 shrink-0"
                style={{
                  borderColor: scoreColor,
                  background: "var(--panel-2)",
                  color: scoreColor
                }}
              >
                <span className="text-xl leading-none font-extrabold tracking-tight">
                  {displayedScore}
                </span>
                <span className="text-[9px] uppercase tracking-wider opacity-75 mt-0.5">
                  % Match
                </span>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[var(--panel-2)] border border-[var(--border)] text-lg shrink-0">
                🔒
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="retro-label text-[11px]">
                  AI Twin Screening Analysis
                </span>
                {result.score !== null && (
                  <span
                    className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border"
                    style={{
                      borderColor: scoreColor,
                      color: scoreColor,
                      background: "var(--panel-2)"
                    }}
                  >
                    {tierLabel}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--text)] mt-1 tracking-tight">
                {result.headline}
              </h3>
            </div>
          </div>
        </div>

        {/* Structured Insights Grid */}
        <div className="mt-5 space-y-3.5">
          {/* Green Flag / Why This Works */}
          {result.green_flag && (
            <div className="p-3.5 sm:p-4 rounded-lg bg-[var(--panel-2)] border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--green)" }}
                />
                <span
                  className="text-xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: "var(--green)" }}
                >
                  Strategic Alignment (Green Flag)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text)] leading-relaxed pl-4">
                {result.green_flag}
              </p>
            </div>
          )}

          {/* Win-Win Synergy */}
          {result.win_win && (
            <div className="p-3.5 sm:p-4 rounded-lg bg-[var(--panel-2)] border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--amber-bright)" }}
                />
                <span
                  className="text-xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: "var(--amber-bright)" }}
                >
                  Mutual Value Creation (Win-Win)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text)] leading-relaxed pl-4">
                {result.win_win}
              </p>
            </div>
          )}

          {/* Fit Note / Operational Considerations */}
          {result.fit_note && (
            <div className="p-3.5 sm:p-4 rounded-lg bg-[var(--panel)] border border-[var(--border)] opacity-95">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--text-dim)" }}
                />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  Alignment &amp; Timeline Note
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] leading-relaxed pl-4">
                {result.fit_note}
              </p>
            </div>
          )}

          {/* First Step (if available) */}
          {result.first_step && (
            <div className="p-3 rounded-lg bg-[var(--panel)] border border-[var(--border)] flex items-start gap-2.5">
              <span className="text-xs font-mono font-bold text-[var(--amber-bright)] shrink-0 mt-0.5">
                →
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)] block">
                  Recommended Next Step
                </span>
                <p className="text-xs text-[var(--text)] mt-0.5">
                  {result.first_step}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-6 pt-5 border-t border-[var(--border)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Link
            href={ctaLink}
            className="retro-btn retro-btn-primary flex-1 text-center py-2.5 px-4 text-xs sm:text-sm font-bold"
          >
            {rateLimited
              ? "Build Your Own AI Twin →"
              : `Connect with ${name} on SyncdIn →`}
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setRateLimited(false);
              setPitch("");
            }}
            className="retro-btn text-xs py-2.5 px-4 text-center cursor-pointer"
          >
            ↺ Pitch a Different Angle
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // State 2: Loading State (Calm, Professional Progress)
  // =========================================================================
  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-[var(--border-bright)] bg-[var(--panel-solid)] p-8 text-center shadow-sm">
        <div
          className="inline-block w-7 h-7 rounded-full border-2 border-t-transparent animate-spin mb-3.5"
          style={{
            borderColor: "var(--amber-bright)",
            borderTopColor: "transparent"
          }}
        />
        <div className="retro-label text-xs tracking-wider">
          Screening Pitch Compatibility
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-dim)] mt-1.5 max-w-md mx-auto leading-relaxed">
          Evaluating alignment against {name}'s stored goals, stage, and deal preferences...
        </p>
      </div>
    );
  }

  // =========================================================================
  // State 3: Initial Form State
  // =========================================================================
  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {/* Quick Prompt Chips */}
      <div>
        <div className="retro-label text-[11px] mb-2">
          Quick starter ideas:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STARTER_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPitch(p.text)}
              className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--amber-bright)] hover:text-[var(--text)] transition-colors text-[var(--text-dim)] cursor-pointer text-left"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Pitch Textarea */}
      <div className="space-y-1.5">
        <textarea
          rows={3}
          placeholder={`Pitch ${name}'s AI Twin: Who you are, what you're building, and how you want to collaborate...`}
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          className="retro-input w-full resize-none text-xs sm:text-sm leading-relaxed p-3"
          disabled={loading}
          required
        />
        <div className="flex justify-between items-center px-0.5 text-[11px] font-mono text-[var(--text-dim)]">
          <span className="flex items-center gap-1">
            <span>🔒</span>
            <span>Evaluated private-first by AI Twin</span>
          </span>
          <span>{pitch.length}/2000</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="p-3 rounded-lg border text-xs"
          style={{
            background: "var(--panel-2)",
            borderColor: "var(--red)",
            color: "var(--red)"
          }}
        >
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !pitch.trim()}
        className="retro-btn retro-btn-primary w-full py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
      >
        <span>⚡ Pitch {name}'s AI Twin</span>
        <span className="text-xs opacity-80 font-normal hidden sm:inline">
          · Instant Compatibility Verdict
        </span>
      </button>
    </form>
  );
}

export function ShareButton({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = `${window.location.origin}/u/${handle}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="retro-btn cursor-pointer"
      style={{
        fontSize: 12,
        color: copied ? "var(--green)" : undefined,
        borderColor: copied ? "var(--green)" : undefined,
        transition: "all 0.15s ease"
      }}
    >
      {copied ? "✅ copied!" : "🔗 share profile"}
    </button>
  );
}
