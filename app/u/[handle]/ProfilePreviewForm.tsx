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
  { label: "🤝 Co-Founder Fit", text: "I'm a senior full-stack engineer exploring early-stage AI startups. Looking for a high-velocity domain co-founder." },
  { label: "💼 Seed Investment", text: "We invest pre-seed/seed checks ($250k–$1M) in applied AI, devtools, and agent platforms with strong technical founders." },
  { label: "⚡ Partnership", text: "Building enterprise AI distribution and looking for complementary product teams to partner on joint pilots." },
];

export function ProfilePreviewForm({ handle, name }: ProfilePreviewFormProps) {
  const [pitch, setPitch] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Score count-up animation
  useEffect(() => {
    if (!result || typeof result.score !== "number") return;
    setDisplayedScore(0);
    const target = result.score;
    const duration = 600;
    const stepTime = 25;
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
        body: JSON.stringify({ handle, context: pitch.trim() }),
      });

      const data = await res.json();

      if (res.status === 429 || data.error === "limit_reached") {
        setRateLimited(true);
        setResult({
          score: null,
          headline: "Preview Limit Reached",
          green_flag: "You've used your guest preview queries.",
          fit_note: "Sign up to unlock continuous AI Twin screening and unlimited matches.",
          win_win: data.message || "Create your twin to screen unlimited inbound opportunities.",
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

  // If match result is available
  if (result) {
    const isHigh = (result.score ?? 0) >= 75;
    const scoreColor = isHigh ? "var(--green)" : "var(--amber-bright)";

    return (
      <div className="mt-4 p-5 rounded-xl border border-[var(--border-bright)] bg-[var(--panel-solid)] shadow-lg animate-in fade-in duration-300">
        {/* Header with Score */}
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
          {result.score !== null ? (
            <div
              className="w-14 h-14 rounded-full flex flex-col items-center justify-center font-bold font-mono shadow-inner border-2"
              style={{
                borderColor: scoreColor,
                background: "var(--panel-2)",
                color: scoreColor
              }}
            >
              <span className="text-lg leading-none">{displayedScore}</span>
              <span className="text-[9px] uppercase tracking-wider opacity-80">% FIT</span>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--panel-2)] border border-[var(--border)] text-xl">
              ⚡
            </div>
          )}
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--amber-bright)]">
              AI Twin Screening Verdict
            </div>
            <h3 className="text-base font-bold text-[var(--text)] mt-0.5">
              {result.headline}
            </h3>
          </div>
        </div>

        {/* Structured Insights Grid */}
        <div className="mt-4 space-y-3">
          {/* Green Flag */}
          {result.green_flag && (
            <div className="p-3.5 rounded-lg bg-[var(--panel-2)] border border-[var(--border)] flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5">🟢</span>
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--green)] block">
                  Why This Works (Green Flag)
                </span>
                <p className="text-sm text-[var(--text)] mt-0.5 leading-relaxed">
                  {result.green_flag}
                </p>
              </div>
            </div>
          )}

          {/* Win-Win Action */}
          {result.win_win && (
            <div className="p-3.5 rounded-lg bg-[var(--panel-2)] border border-[var(--border)] flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5">⚡</span>
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--amber-bright)] block">
                  High-Leverage Win-Win
                </span>
                <p className="text-sm text-[var(--text)] mt-0.5 leading-relaxed">
                  {result.win_win}
                </p>
              </div>
            </div>
          )}

          {/* Fit Nuance / Note */}
          {result.fit_note && (
            <div className="p-3 rounded-lg bg-[var(--panel)] border border-[var(--border)] flex items-start gap-2.5 opacity-90">
              <span className="text-sm leading-none mt-0.5">🔍</span>
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-dim)] block">
                  Working-Style / Alignment Note
                </span>
                <p className="text-xs text-[var(--text-dim)] mt-0.5 leading-relaxed">
                  {result.fit_note}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="mt-5 pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row gap-2.5">
          <Link
            href={ctaLink}
            className="retro-btn retro-btn-primary flex-1 text-center py-2.5 text-sm font-bold"
          >
            {rateLimited
              ? "⚡ Build Your Own AI Twin →"
              : `Connect with ${name} on SyncdIn →`}
          </Link>
          <button
            onClick={() => {
              setResult(null);
              setRateLimited(false);
              setPitch("");
            }}
            className="retro-btn text-xs py-2 px-4"
          >
            ↺ Pitch a Different Angle
          </button>
        </div>
      </div>
    );
  }

  // Calm, steady loading state
  if (loading) {
    return (
      <div className="mt-4 p-7 rounded-xl border border-[var(--border-bright)] bg-[var(--panel-solid)] text-center">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-[var(--amber)] border-t-transparent animate-spin mb-3" />
        <div className="text-xs font-mono uppercase tracking-widest text-[var(--amber-bright)] mb-1">
          Screening Inbound Pitch
        </div>
        <p className="text-sm font-medium text-[var(--text)]">
          Evaluating compatibility against {name}'s twin goals and preferences...
        </p>
      </div>
    );
  }

  // Form State
  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
      {/* Quick Prompt Chips */}
      <div>
        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
          Quick starter ideas:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STARTER_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPitch(p.text)}
              className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--amber)] hover:text-[var(--text)] transition-colors text-[var(--text-dim)] cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Pitch Textarea */}
      <div className="relative">
        <textarea
          rows={3}
          placeholder={`Pitch ${name}'s AI Twin: Who you are, what you're building, and how you want to collaborate...`}
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          className="retro-input w-full resize-none text-sm leading-relaxed"
          disabled={loading}
          required
        />
        <div className="flex justify-between items-center mt-1.5 px-1">
          <span className="text-[11px] font-mono text-[var(--text-dim)]">
            🔒 Evaluated private-first by AI Twin
          </span>
          <span className="text-[11px] font-mono text-[var(--text-dim)]">
            {pitch.length}/2000
          </span>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !pitch.trim()}
        className="retro-btn retro-btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2"
      >
        <span>⚡ Pitch {name}'s AI Twin</span>
        <span className="text-xs opacity-75 font-normal">· Instant Compatibility Verdict</span>
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
      onClick={handleCopy}
      className="retro-btn"
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
