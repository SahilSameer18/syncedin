"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "../../Avatar";
import { SocialIconRow } from "../../SocialIconRow";

type Socials = {
  linkedin_url: string | null;
  x_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  website_url?: string | null;
} | null;

export function MemberCard({
  id,
  name,
  avatarUrl,
  handle,
  isHost,
  about,
  wants,
  offers,
  socials,
  viewerSignedIn,
  isSelf,
  signupHref
}: {
  id: string;
  name: string;
  avatarUrl: string | null;
  handle: string | null;
  isHost: boolean;
  about: string | null;
  wants: string | null;
  offers: string | null;
  socials: Socials;
  viewerSignedIn: boolean;
  isSelf: boolean;
  signupHref: string;
}) {
  const [collab, setCollab] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/collab-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_user_id: id })
      });
      const j = await res.json().catch(() => ({}) as any);
      setCollab(
        j?.collaboration ||
          j?.detail ||
          "Couldn't generate the win-win right now — try again."
      );
    } catch {
      setCollab("Couldn't generate the win-win right now — try again.");
    } finally {
      setLoading(false);
    }
  }

  const Row = ({ label, value }: { label: string; value: string | null }) =>
    value ? (
      <div className="mt-2.5">
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-dim)"
          }}
        >
          {label}
        </div>
        <div
          className="text-xs leading-relaxed mt-0.5 line-clamp-3"
          style={{ color: "var(--text)" }}
        >
          {value}
        </div>
      </div>
    ) : null;

  return (
    <div
      className="retro-panel retro-panel-hover flex flex-col justify-between p-4 sm:p-5"
      style={{
        borderRadius: "var(--radius)",
        background: "var(--panel-solid)",
        border: isHost ? "1px solid var(--amber)" : "1px solid var(--border)"
      }}
    >
      <div>
        <div className="flex items-center gap-3">
          <Avatar id={id} name={name} avatarUrl={avatarUrl} size={44} />
          <div className="min-w-0 flex-1">
            <div
              className="font-bold text-sm truncate"
              style={{ color: "var(--text)" }}
            >
              {name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {isHost && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--amber-bright)"
                  }}
                >
                  host
                </span>
              )}
              {socials && <SocialIconRow urls={socials} size={13} gap={4} />}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Row label="About" value={about} />
          <Row label="Wants / Needs" value={wants} />
          <Row label="Offers" value={offers} />
          {!about && !wants && !offers && (
            <div className="mt-2 text-xs italic" style={{ color: "var(--text-dim)" }}>
              Twin still forming — check back soon.
            </div>
          )}
        </div>
      </div>

      {/* Collaboration / Win-Win Section */}
      <div
        className="mt-4 pt-3 border-t flex flex-col justify-end"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--green)"
          }}
        >
          🧊 Shared Potential
        </div>

        {isSelf ? (
          <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
            This is you — others will see their win-win with you here.
          </div>
        ) : !viewerSignedIn ? (
          <div className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
            <Link
              href={signupHref}
              style={{ color: "var(--amber-bright)", fontWeight: 700, textDecoration: "none" }}
            >
              Sign up
            </Link>{" "}
            to auto-generate your shared win-win potential with {name.split(/\s+/)[0]}.
          </div>
        ) : collab ? (
          <div className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--text)" }}>
            {collab}
          </div>
        ) : (
          <button
            type="button"
            onClick={reveal}
            disabled={loading}
            className="retro-btn retro-btn-primary w-full mt-2 text-xs font-semibold py-2 justify-center flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? "Finding the win-win…" : "✨ Reveal our win-win"}
          </button>
        )}
      </div>
    </div>
  );
}
