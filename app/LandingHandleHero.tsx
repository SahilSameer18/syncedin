"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo, type BrandKey } from "./BrandLogo";

/**
 * Elite/modern landing hero. Single conversion surface:
 *   - Social-proof row + 3 face avatars (warm trust)
 *   - Bold sans headline
 *   - Tight subhead
 *   - Platform pill row (Instagram / TikTok / X / LinkedIn / YouTube)
 *   - One @handle input
 *   - Oversized blue CTA
 *   - Micro-trust copy
 *
 * Submit flow: paste handle → POST to /api/bulk-create-invites
 * (single-contact, unauthed-safe path) to ensure we route the user
 * to /login with a `next=/[slug]` so the demo-conversation lands
 * the moment they sign in. If unauthed, we just route to
 * /login?next=/onboarding so they start a twin first.
 *
 * Per Jack: "we need to look more modern and elite."
 */
type Platform = {
  key: BrandKey;
  label: string;
  prefix: string;
  placeholder: string;
};

const PLATFORMS: Platform[] = [
  {
    key: "instagram",
    label: "Instagram",
    prefix: "instagram.com/",
    placeholder: "yourhandle"
  },
  {
    key: "x",
    label: "X",
    prefix: "x.com/",
    placeholder: "yourhandle"
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    prefix: "linkedin.com/in/",
    placeholder: "your-handle"
  },
  {
    key: "facebook",
    label: "Facebook",
    prefix: "facebook.com/",
    placeholder: "yourhandle"
  }
];

export function LandingHandleHero() {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>(PLATFORMS[2]); // LinkedIn default
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    const h = handle.replace(/^@+/, "").trim();
    if (!h || busy) return;
    setBusy(true);
    setErr("");
    try {
      // Build the synthetic profile URL from the chosen platform.
      const profileUrl = `https://${platform.prefix}${h}`;
      // Stash the intended URL so the post-login onboarding flow can
      // prefill scrape context from it immediately.
      try {
        sessionStorage.setItem(
          "syncedin.signupIntent",
          JSON.stringify({ profile_url: profileUrl, platform: platform.key })
        );
      } catch {
        /* private mode */
      }
      // Route to login with a redirect back to onboarding so the new
      // user immediately gets their twin scaffolded from this URL.
      router.push(
        `/login?next=${encodeURIComponent("/onboarding?welcome=1")}`
      );
    } catch (e: any) {
      setErr(e?.message || "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="lh-hero">
      <style>{`
        .lh-hero {
          max-width: 720px;
          margin: 0 auto;
          padding: 56px 24px 80px;
          color: var(--text);
        }
        .lh-proof {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
        }
        .lh-avatars { display: inline-flex; }
        .lh-avatars img {
          width: 36px; height: 36px; border-radius: 999px;
          border: 2.5px solid var(--panel-solid);
          object-fit: cover;
          margin-left: -10px;
        }
        .lh-avatars img:first-child { margin-left: 0; }
        .lh-proof-text {
          display: flex; flex-direction: column; gap: 2px;
        }
        .lh-proof-headline {
          font-size: 16px; font-weight: 800; letter-spacing: -0.01em;
        }
        .lh-proof-sub {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; color: var(--text-dim);
        }
        .lh-stars { color: #fbbf24; letter-spacing: 1px; font-size: 13px; }

        .lh-h1 {
          font-size: clamp(40px, 6vw, 64px);
          font-weight: 900;
          letter-spacing: -0.025em;
          line-height: 1.02;
          margin: 0;
          color: var(--text);
        }
        .lh-sub {
          margin-top: 22px;
          font-size: 17px;
          line-height: 1.5;
          color: var(--text-dim);
        }
        .lh-sub strong { color: var(--text); font-weight: 700; }

        .lh-platforms {
          display: flex; flex-wrap: wrap; gap: 8px;
          margin-top: 32px;
        }
        .lh-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px;
          border-radius: 999px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            transform 0.12s ease;
        }
        .lh-pill:hover { border-color: var(--text); }
        .lh-pill.active {
          background: var(--text);
          color: var(--bg);
          border-color: var(--text);
        }

        .lh-input-wrap {
          position: relative;
          margin-top: 14px;
        }
        .lh-input-prefix {
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-dim);
          font-size: 18px;
          pointer-events: none;
        }
        .lh-input {
          width: 100%;
          padding: 18px 18px 18px 38px;
          font-size: 17px;
          border-radius: 14px;
          border: 1.5px solid var(--border);
          background: transparent;
          color: var(--text);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .lh-input:focus {
          outline: none;
          border-color: #1f8bff;
          box-shadow: 0 0 0 4px rgba(31, 139, 255, 0.14);
        }

        .lh-cta {
          margin-top: 14px;
          width: 100%;
          padding: 19px 22px;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.005em;
          color: #fff;
          background: #1f59ff;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: transform 0.12s ease, box-shadow 0.18s ease;
          box-shadow: 0 12px 30px -10px rgba(31, 89, 255, 0.55);
        }
        .lh-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 36px -10px rgba(31, 89, 255, 0.65);
        }
        .lh-cta:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }
        .lh-cta .arrow { transition: transform 0.15s ease; }
        .lh-cta:hover .arrow { transform: translateX(3px); }

        .lh-microcopy {
          margin-top: 14px;
          font-size: 13px;
          color: var(--text-dim);
          text-align: center;
        }

        .lh-error {
          margin-top: 10px;
          font-size: 13px;
          color: #ef4444;
          text-align: center;
        }
      `}</style>

      {/* Social proof */}
      <div className="lh-proof">
        <div className="lh-avatars" aria-hidden="true">
          <img
            src="https://api.dicebear.com/9.x/notionists/svg?seed=marina"
            alt=""
          />
          <img
            src="https://api.dicebear.com/9.x/notionists/svg?seed=darius"
            alt=""
          />
          <img
            src="https://api.dicebear.com/9.x/notionists/svg?seed=ari"
            alt=""
          />
        </div>
        <div className="lh-proof-text">
          <span className="lh-proof-headline">
            40+ founders syncing
          </span>
          <span className="lh-proof-sub">
            <span className="lh-stars">★★★★★</span>
            <span>4.9 average</span>
          </span>
        </div>
      </div>

      <h1 className="lh-h1">
        Your twin already knows
        <br />
        the deal you should be making.
      </h1>
      <p className="lh-sub">
        Paste your handle. We build a digital twin of you in 30 seconds —
        then it talks to other people&apos;s twins to find the highest
        win-win between you, before either of you spends a minute on
        a call.
      </p>

      {/* Platform pills */}
      <div className="lh-platforms" role="tablist">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={platform.key === p.key}
            onClick={() => setPlatform(p)}
            className={`lh-pill ${platform.key === p.key ? "active" : ""}`}
          >
            <BrandLogo brand={p.key} size={14} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      <div className="lh-input-wrap">
        <span className="lh-input-prefix">@</span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void go();
            }
          }}
          placeholder={platform.placeholder}
          className="lh-input"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <button
        type="button"
        onClick={go}
        disabled={!handle.trim() || busy}
        className="lh-cta"
      >
        <span>{busy ? "building…" : "Build my twin"}</span>
        <span className="arrow" aria-hidden="true">→</span>
      </button>

      <p className="lh-microcopy">
        Free. No commitment. Your twin learns your voice — you stay in
        control of every message.
      </p>

      {err && <p className="lh-error">{err}</p>}
    </section>
  );
}
