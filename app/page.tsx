import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "./Wordmark";
import { LandingHandleHero } from "./LandingHandleHero";

/**
 * Public home page — completely redesigned May 2026 per Jack: "we
 * need to look more modern and elite." Replaces the retro-panel
 * cassette-futurism block with a clean white hero, social proof,
 * platform picker, and a single oversized CTA. Three-card "how it
 * works" row sits underneath for context without crowding the
 * conversion surface.
 *
 * Signed-in users still bounce to /dashboard.
 */
export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main>
      <style>{`
        .lh-page {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
        }
        .lh-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 32px;
          max-width: 1180px;
          margin: 0 auto;
        }
        .lh-topbar-links {
          display: inline-flex;
          align-items: center;
          gap: 22px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-dim);
        }
        .lh-topbar-links a {
          color: var(--text-dim);
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .lh-topbar-links a:hover { color: var(--text); }
        .lh-topbar-cta {
          padding: 9px 16px;
          border-radius: 999px;
          background: var(--text);
          color: var(--bg);
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
        }

        .lh-how {
          max-width: 1080px;
          margin: 40px auto 0;
          padding: 0 24px 96px;
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(0, 1fr);
        }
        @media (min-width: 800px) {
          .lh-how { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        .lh-how-card {
          padding: 26px;
          border-radius: 18px;
          border: 1px solid var(--border);
          background: var(--panel-solid);
          transition:
            transform 0.18s ease,
            box-shadow 0.22s ease,
            border-color 0.18s ease;
        }
        .lh-how-card:hover {
          transform: translateY(-3px);
          border-color: rgba(31, 89, 255, 0.4);
          box-shadow: 0 22px 50px -28px rgba(15, 23, 42, 0.22);
        }
        .lh-how-k {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px; height: 32px;
          border-radius: 999px;
          background: rgba(31, 89, 255, 0.10);
          color: #1f59ff;
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .lh-how-card h3 {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.005em;
          margin: 0 0 6px;
        }
        .lh-how-card p {
          font-size: 14px;
          line-height: 1.55;
          color: var(--text-dim);
          margin: 0;
        }
      `}</style>

      <div className="lh-page">
        {/* Top nav — minimal */}
        <header className="lh-topbar">
          <Wordmark size="sm" href={null} />
          <nav className="lh-topbar-links">
            <a href="/article">How it works</a>
            <a href="/hypernetwork">Network</a>
            <Link href="/login" className="lh-topbar-cta">
              Sign in
            </Link>
          </nav>
        </header>

        {/* Hero — handle picker, the only conversion surface above the fold */}
        <LandingHandleHero />

        {/* Manifesto line — the soul of the project. Jack: "under
            this lets put the prior copy we made about what if the real
            friends we make was the superintelligence along the way."
            Big serif italic so it reads as a thesis statement, not
            another feature card. */}
        <section
          style={{
            maxWidth: 880,
            margin: "12px auto 0",
            padding: "32px 32px 8px",
            textAlign: "center"
          }}
        >
          <p
            style={{
              fontSize: "clamp(22px, 3.4vw, 32px)",
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: "-0.015em",
              fontStyle: "italic",
              color: "var(--text)",
              margin: 0
            }}
          >
            What if the real superintelligence was the friends we
            make along the way
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "0.6ch",
                height: "0.95em",
                marginLeft: 2,
                verticalAlign: "-0.12em",
                background:
                  "linear-gradient(135deg, #1f59ff 0%, #6b2dc9 100%)",
                animation: "lh-cursor 1.05s steps(2) infinite"
              }}
            />
          </p>
          <style>{`
            @keyframes lh-cursor {
              0%, 100% { opacity: 1; }
              50%      { opacity: 0; }
            }
          `}</style>
        </section>

        {/* How it works — three crisp cards */}
        <section className="lh-how">
          {[
            {
              k: "1",
              t: "Build your twin",
              d: "Paste a profile URL or your existing AI memory. We extract goals, voice, dealbreakers, and recent wins into a working clone."
            },
            {
              k: "2",
              t: "Twins talk for you",
              d: "Two twins run a full conversation toward a concrete win-win. Edit any message and the rest regenerates around your edit."
            },
            {
              k: "3",
              t: "You walk in synced",
              d: "Once both twins agree, you and the other person meet already aligned on the deal. No 30-min discovery calls, no missed angles."
            }
          ].map((c) => (
            <article key={c.k} className="lh-how-card">
              <div className="lh-how-k">{c.k}</div>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
