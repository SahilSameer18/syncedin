"use client";

import { useState } from "react";
import Link from "next/link";

interface ProfilePreviewFormProps {
  handle: string;
  name: string;
}

export function ProfilePreviewForm({ handle, name }: ProfilePreviewFormProps) {
  const [aboutYou, setAboutYou] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aboutYou.trim() && !lookingFor.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setRateLimited(false);

    try {
      const context = `About me: ${aboutYou}\nWhat I'm looking for: ${lookingFor}`;
      const res = await fetch("/api/profile-preview-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, context }),
      });

      const data = await res.json();

      if (res.status === 429 || data.error === "limit_reached") {
        setRateLimited(true);
        setResult(data.message);
      } else if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setResult(data.winwin);
      }
    } catch (err: any) {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const ctaLink = `/login?next=/u/${handle}`;

  // If a result has been generated (success or rate limited), show the result + CTA gate
  if (result) {
    return (
      <div className="mt-4 p-4 rounded-md border border-[var(--border)] bg-[var(--panel-2)]">
        <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>
          {result}
        </p>
        <div className="mt-4">
          <Link href={ctaLink} className="retro-btn retro-btn-primary w-full text-center block">
            {rateLimited ? "Create your own twin →" : "Want the full thing? Sign up →"}
          </Link>
          <button
            onClick={() => { setResult(null); setRateLimited(false); }}
            className="retro-btn mt-2 w-full text-center"
            style={{ fontSize: 12 }}
          >
            ← try a different message
          </button>
        </div>
      </div>
    );
  }

  // Initial Form state
  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div>
        <input
          type="text"
          placeholder="About you (e.g. Founder at a devtool startup)"
          value={aboutYou}
          onChange={(e) => setAboutYou(e.target.value)}
          className="retro-input w-full"
          disabled={loading}
          required
        />
      </div>
      <div>
        <input
          type="text"
          placeholder="What you're looking for (e.g. Seed funding)"
          value={lookingFor}
          onChange={(e) => setLookingFor(e.target.value)}
          className="retro-input w-full"
          disabled={loading}
          required
        />
      </div>
      
      {error && <p className="text-red-500 text-xs">{error}</p>}
      
      <button
        type="submit"
        disabled={loading || !aboutYou.trim() || !lookingFor.trim()}
        className="retro-btn retro-btn-primary w-full"
      >
        {loading ? "thinking..." : "See our match"}
      </button>
    </form>
  );
}
