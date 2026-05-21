import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";

/**
 * PERSONAL INTELLIGENCE — Jack's vision: every user gets a generated,
 * deeply-personal page that turns their twin context into:
 *   - AI-generated images (viral-style "make me as X" series)
 *   - Movie + book recommendations with their own "why I liked it" notes
 *   - A personalized merch line (image-gen on archetype)
 *   - A personalized song
 *   - A life path blueprint
 *   - Initial plot ideas if they wanted to write a book / make a movie
 *   - If they have a business, a "potential huge success" projection
 *
 * V1 ships the scaffold with placeholder cards so the URL is real and
 * we can iterate per section. Each card has a clear "what this becomes"
 * description so the user understands the promise before the generators
 * land.
 *
 * Generators come online behind individual feature flags / endpoints
 * (each section's "generate" button hits a server route that we'll
 * implement incrementally — task #158 tracks the full build-out).
 */
export const dynamic = "force-dynamic";

export default async function PersonalIntelligencePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/personal-intelligence");

  const service = createServiceClient();
  const [{ data: profile }, { data: twin }] = await Promise.all([
    service
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle(),
    service
      .from("twin_profiles")
      .select("goals, deal_preferences, ai_export_blob")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const firstName =
    ((profile as any)?.display_name || "").split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    "you";
  const hasTwin = Boolean((twin as any)?.goals);

  const cards: {
    key: string;
    eyebrow: string;
    title: string;
    blurb: string;
    accent: string;
    icon: string;
  }[] = [
    {
      key: "images",
      eyebrow: "Images 2.0",
      title: `Generate ${firstName}-themed images`,
      blurb:
        "Viral-style portrait series built from your real context — your background, your work, your style. Pick a prompt, get a set you can post anywhere.",
      accent: "#1f8bff",
      icon: "🎨"
    },
    {
      key: "merch",
      eyebrow: "Merch",
      title: "A merch line that's actually you",
      blurb:
        "Auto-generated t-shirt + hoodie + sticker designs from your twin's archetype. Print-ready files, no design skill needed.",
      accent: "#6b2dc9",
      icon: "👕"
    },
    {
      key: "song",
      eyebrow: "Audio",
      title: "Your personal song",
      blurb:
        "Generated track that captures your story arc — tempo, lyrics, and feel pulled from your twin context. Shareable as a personal anthem.",
      accent: "#d83bff",
      icon: "🎵"
    },
    {
      key: "blueprint",
      eyebrow: "Life Path",
      title: "Your life path blueprint",
      blurb:
        "A visual map of where you've been, where the network thinks you're headed, and the highest-leverage next moves to get there.",
      accent: "#22c55e",
      icon: "🗺️"
    },
    {
      key: "movies",
      eyebrow: "Recommendations",
      title: "Movies you should watch (and why)",
      blurb:
        "Curated picks based on your bio + tastes. Tell us why you loved one and the next 5 sharpen up.",
      accent: "#f97316",
      icon: "🎬"
    },
    {
      key: "books",
      eyebrow: "Recommendations",
      title: "Books you should read (and why)",
      blurb:
        "Same loop for reading. The longer you tell your twin what landed and why, the more useful the next list becomes.",
      accent: "#eab308",
      icon: "📚"
    },
    {
      key: "creative",
      eyebrow: "Your story",
      title: "If you wrote a book, this would be the plot",
      blurb:
        "Starter outline for a memoir, novel, or screenplay built from the most distinctive parts of your story. Three structural options to pick from.",
      accent: "#ec4899",
      icon: "✍️"
    },
    {
      key: "business",
      eyebrow: "Business projection",
      title: "What if your venture takes off?",
      blurb:
        "If you mentioned a business in your twin context, we sketch the potential huge-success path: TAM, GTM, the 18-month milestone arc.",
      accent: "#10b981",
      icon: "🚀"
    }
  ];

  return (
    <AppShell>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#1f8bff",
            marginBottom: 8
          }}
        >
          Personal intelligence
        </div>
        <h1
          className="retro-h1"
          style={{ fontSize: 30, letterSpacing: "-0.01em", margin: 0 }}
        >
          The non-networking things your twin can do for you.
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 14,
            color: "var(--text-dim)",
            maxWidth: 680,
            lineHeight: 1.55
          }}
        >
          Your twin already has the richest context on you that any model
          has ever had — bio, footprint, goals, voice. That same context
          unlocks a long tail of personal generations: images, merch, a
          song, a life path, recommendations, plot ideas, and business
          projections. Each card below ships as we build it.
        </p>
        {!hasTwin && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(31, 139, 255, 0.06)",
              border: "1px solid rgba(31, 139, 255, 0.30)",
              fontSize: 13,
              color: "var(--text)"
            }}
          >
            Heads up: most of these generators want a fleshed-out twin.{" "}
            <a
              href="/onboarding"
              style={{
                color: "#1f8bff",
                fontWeight: 700,
                textDecoration: "underline"
              }}
            >
              Finish onboarding
            </a>{" "}
            for the best results.
          </div>
        )}
      </header>

      <style>{`
        .pi-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }
        @media (min-width: 740px) {
          .pi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (min-width: 1100px) {
          .pi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        .pi-card {
          position: relative;
          padding: 18px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--panel-solid);
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 200px;
          transition: transform 0.15s ease, box-shadow 0.15s ease,
            border-color 0.15s ease;
        }
        .pi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 40px -18px rgba(15, 23, 42, 0.18);
        }
        .pi-card .icon {
          font-size: 28px;
          line-height: 1;
        }
        .pi-card .eyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .pi-card h3 {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.005em;
          margin: 0;
          line-height: 1.25;
        }
        .pi-card p {
          font-size: 13px;
          line-height: 1.55;
          color: var(--text-dim);
          margin: 0;
          flex-grow: 1;
        }
        .pi-card .soon {
          margin-top: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          font-size: 11px;
          font-weight: 700;
          color: var(--text-dim);
          align-self: flex-start;
        }
      `}</style>

      <section className="pi-grid">
        {cards.map((c) => (
          <article key={c.key} className="pi-card">
            <span className="icon" aria-hidden="true">
              {c.icon}
            </span>
            <span className="eyebrow" style={{ color: c.accent }}>
              {c.eyebrow}
            </span>
            <h3>{c.title}</h3>
            <p>{c.blurb}</p>
            <span className="soon">Shipping soon</span>
          </article>
        ))}
      </section>

      <p
        style={{
          marginTop: 24,
          fontSize: 11,
          color: "var(--text-dim)",
          textAlign: "center"
        }}
      >
        Have a generator you want first? Drop a note via the feedback
        widget on your dashboard — the most-requested ones ship first.
      </p>
    </AppShell>
  );
}
